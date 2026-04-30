import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { messages } = await req.json();

    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { reply: "Server error: Missing DeepSeek API key." },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages
      })
    });

    const data = await response.json();

    return NextResponse.json({
      reply: data?.choices?.[0]?.message?.content || "No response from DeepSeek."
    });

  } catch (error) {
    console.error("DeepSeek API Error:", error);
    return NextResponse.json(
      { reply: "Error: Unable to reach DeepSeek API." },
      { status: 500 }
    );
  }
}
