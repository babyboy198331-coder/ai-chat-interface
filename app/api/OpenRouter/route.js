// Allowlist of models the client may request — never trust raw client input
const MODELS = {
  "deepseek-v3.2": "deepseek/deepseek-v3.2",
  "gemma-4-31b":   "google/gemma-4-31b-it:free",
  "llama-3.3-70b": "meta-llama/llama-3.3-70b-instruct",
  "ministral-8b":  "mistralai/ministral-8b-2512",
};

const DEFAULT_MODEL = "deepseek-v3.2";

export async function POST(req) {
  try {
    const { messages, model } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const modelSlug = MODELS[model] ?? MODELS[DEFAULT_MODEL];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://deep-seek-clone-wine.vercel.app",
        "X-Title": "Nimbus AI",
      },
      body: JSON.stringify({
        model: modelSlug,
        messages,
        stream: true,
      }),
      signal: req.signal, // propagate client aborts upstream
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("OpenRouter error:", response.status, errBody);
      return new Response(
        JSON.stringify({ error: `Upstream error (${response.status}).` }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
