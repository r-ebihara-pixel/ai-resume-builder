"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export async function generateSelfPr(keywords: string[]) {
    if (!apiKey) {
        // Mock response for demo purposes when API key is missing
        return `(デモ用) AI生成機能はAPIキー設定後に有効になります。\n\n【生成例】\n私の強みは「${keywords.join("、")}」です。これまでの経験を活かし、貴社のインフラエンジニアとして貢献したいと考えています。常に新しい技術を学び、チームの課題解決に積極的に取り組む姿勢を大切にしています。`;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

        const prompt = `
      あなたはプロのキャリアアドバイザーです。
      以下のキーワードを元に、中途採用の面接官に響く魅力的な「自己PR」を300文字程度で作成してください。
      キーワード: ${keywords.join(", ")}
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw new Error("AI生成中にエラーが発生しました。");
    }
}

export async function generateMotivation(targetRole: string, background: string) {
    if (!apiKey) {
        // Mock response for demo purposes when API key is missing
        return `(デモ用) AI生成機能はAPIキー設定後に有効になります。\n\n【生成例】\n私はこれまで${background}の経験を積んできましたが、ITインフラの重要性を痛感し、${targetRole}への転身を決意しました。貴社の充実した研修制度と高い技術力に惹かれ、未経験からでも早期に戦力となれるよう努力いたします。`;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
      あなたはプロのキャリアアドバイザーです。
      以下の背景を持つ求職者が、未経験から「${targetRole}」（インフラエンジニア）を志望する際の、
      熱意とポテンシャルを伝える「志望動機」を300文字程度で作成してください。
      背景: ${background}
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("AI Generation Error:", error);
        throw new Error("AI生成中にエラーが発生しました。");
    }
}
