export async function POST(req) {
  try {
    const { messages } = await req.json();

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://deep-seek-clone-wine.vercel.app",
        "X-Title": "My Chat App",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages,
        stream: true
      }),
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);

          // Split SSE lines
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            const json = line.replace("data:", "").trim();
            if (json === "[DONE]") continue;

            try {
              const parsed = JSON.parse(json);
              const token = parsed?.choices?.[0]?.delta?.content;

              if (token) {
                controller.enqueue(encoder.encode(token));
              }
            } catch (err) {
              // ignore malformed chunks
            }
          }
        }

        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}


