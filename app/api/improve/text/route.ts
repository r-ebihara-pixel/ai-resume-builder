import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function extractJsonObject(raw: string): string {
    const cleaned = raw.trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return cleaned.slice(start, end + 1);
    return cleaned;
}

export async function POST(req: NextRequest) {
    try {
        const { motivation, selfPr } = await req.json();

        if (!motivation?.trim() && !selfPr?.trim()) {
            return NextResponse.json(
                { ok: false, error: "改善する文章を入力してください。" },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

        const prompt = `あなたは転職エージェントの書類作成の専門家です。
以下の志望動機・自己PRを、より魅力的でプロフェッショナルな文章に書き直してください。

【ルール】
- 元の内容・事実・キーワードを変えない（職種・会社名・具体的なエピソードはそのまま保持）
- 具体性・説得力を高め、採用担当者に響く表現にする
- 自然な日本語ビジネス文体にする（硬すぎず読みやすく）
- 志望動機は400字以内、自己PRは400字以内に収める
- 入力が空の場合はそのフィールドも空文字で返す

【志望動機（元の文章）】
${motivation?.trim() || "（なし）"}

【自己PR（元の文章）】
${selfPr?.trim() || "（なし）"}

以下のJSON形式のみで出力してください（説明文・マークダウンは不要）:
{
  "motivation": "改善した志望動機",
  "selfPr": "改善した自己PR"
}`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const raw = result.response.text();
        const jsonStr = extractJsonObject(raw);
        const parsed = JSON.parse(jsonStr);

        return NextResponse.json({
            ok: true,
            motivation: parsed.motivation ?? "",
            selfPr: parsed.selfPr ?? "",
        });
    } catch (error: any) {
        console.error("API improve/text error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "予期せぬエラーが発生しました。" },
            { status: 500 }
        );
    }
}
