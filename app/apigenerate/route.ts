// app/api/generate/route.ts
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: Request) {
  const { prompt } = await request.json();

  const apiKey = process.env.GEMINI_API_KEY;

  // APIキーがない場合はモック文言を返す
  if (!apiKey) {
    return NextResponse.json({
      text: "【デモ用メッセージ】AI生成機能は GEMINI_API_KEY を設定すると有効になります。",
    });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      {
        text:
          "AI生成中にエラーが発生しました。お手数ですが、時間をおいて再度お試しください。",
      },
      { status: 500 }
    );
  }
}
