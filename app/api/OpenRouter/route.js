export async function POST(req) {
  try {
    const { messages } = await req.json();

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "My Chat App"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3-8b-instruct",
        messages
      })
    });

    const data = await res.json();

    return Response.json({
      reply: data?.choices?.[0]?.message?.content || "No response"
    });

  } catch (err) {
    return Response.json(
      { reply: "Server error", error: err.message },
      { status: 500 }
    );
  }
}