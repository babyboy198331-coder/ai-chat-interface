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

    if (!response.ok) {
      const error = await response.json();
      return new Response(JSON.stringify({ reply: "API error", error }), {
        status: response.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response.body) {
            const text = decoder.decode(chunk);
            controller.enqueue(encoder.encode(text));
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      reply: "Server error",
      error: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
