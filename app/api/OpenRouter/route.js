import { MODELS, resolveUpstreamModel } from "../../config/models";

// --- Request limits -------------------------------------------------------
const MAX_MESSAGES = 60; // caps how much history gets forwarded upstream
const MAX_MESSAGE_LENGTH = 8000; // chars, per message
const MAX_TOTAL_LENGTH = 60000; // chars, across the whole conversation

// --- Rate limiting ---------------------------------------------------------
// Simple in-memory sliding-window limiter, keyed by client IP. This is
// process-local: fine for a single server/instance (e.g. one Vercel
// function instance, or a self-hosted box) but won't share state across
// multiple instances. Good enough to stop casual abuse of a public demo;
// swap for Redis/Upstash if you need it to hold across a fleet.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitHits = new Map(); // ip -> array of request timestamps

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (rateLimitHits.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  hits.push(now);
  rateLimitHits.set(ip, hits);

  // Opportunistic cleanup so the map doesn't grow unbounded.
  if (rateLimitHits.size > 5000) {
    for (const [key, timestamps] of rateLimitHits) {
      if (timestamps.every((t) => now - t >= RATE_LIMIT_WINDOW_MS)) {
        rateLimitHits.delete(key);
      }
    }
  }

  return hits.length > RATE_LIMIT_MAX_REQUESTS;
}

function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "No messages provided.";
  }
  if (messages.length > MAX_MESSAGES) {
    return `Too many messages (max ${MAX_MESSAGES}). Start a new chat.`;
  }

  let totalLength = 0;
  for (const m of messages) {
    if (!m || typeof m.content !== "string" || typeof m.role !== "string") {
      return "Malformed message in conversation.";
    }
    if (m.content.length > MAX_MESSAGE_LENGTH) {
      return `A message exceeds the ${MAX_MESSAGE_LENGTH}-character limit.`;
    }
    totalLength += m.content.length;
  }
  if (totalLength > MAX_TOTAL_LENGTH) {
    return "Conversation is too long for this request. Start a new chat.";
  }

  return null;
}

export async function POST(req) {
  try {
    if (!process.env.OPENROUTER_KEY) {
      console.error("OPENROUTER_KEY is not set.");
      return jsonError(
        "Server is missing its OpenRouter API key. Set OPENROUTER_KEY and restart.",
        500
      );
    }

    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return jsonError(
        "Too many requests. Please wait a moment and try again.",
        429
      );
    }

    const { messages, model } = await req.json();

    const validationError = validateMessages(messages);
    if (validationError) {
      return jsonError(validationError, 400);
    }

    const modelSlug = MODELS[model] ? model : undefined;
    const upstreamModel = resolveUpstreamModel(modelSlug);

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://deep-seek-clone-wine.vercel.app",
        "X-Title": "Nimbus AI",
      },
      body: JSON.stringify({
        model: upstreamModel,
        messages,
        stream: true,
      }),
      signal: req.signal, // propagate client aborts upstream
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("OpenRouter error:", response.status, errBody);
      return jsonError(`Upstream error (${response.status}).`, 502);
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        let buffer = "";

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // SSE events are newline-delimited; keep incomplete tail in buffer
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;

              const json = line.replace("data:", "").trim();
              if (json === "[DONE]") continue;

              try {
                const parsed = JSON.parse(json);
                const token = parsed?.choices?.[0]?.delta?.content;
                if (token) controller.enqueue(encoder.encode(token));
              } catch {
                // ignore malformed chunks
              }
            }
          }
        } catch {
          // client aborted — nothing to do
        } finally {
          controller.close();
        }
      },
      cancel() {
        // downstream consumer cancelled — release upstream connection
        response.body?.cancel?.();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    return jsonError(err.message, 500);
  }
}
