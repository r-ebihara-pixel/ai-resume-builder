import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

function calculateAge(birthStr: string): number {
    const today = new Date();
    const birth = new Date(birthStr);
    if (isNaN(birth.getTime())) return 0;
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

export async function POST(req: NextRequest) {
    try {
        const { resumeData, meetingNotes, targetCompany, targetPosition, summary, strengths, concerns, matchReason } = await req.json();

        if (!meetingNotes?.trim() && !resumeData) {
            return NextResponse.json(
                { ok: false, error: "面談メモまたは候補者データが必要です。" },
                { status: 400 }
            );
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        // Build candidate context from resumeData
        const profile = resumeData?.profile ?? {};
        const fullName = `${profile.lastName ?? ""} ${profile.firstName ?? ""}`.trim();
        const birthStr = profile.birthday
            ? `${profile.birthday.year}-${String(profile.birthday.month).padStart(2, "0")}-${String(profile.birthday.day).padStart(2, "0")}`
            : "";
        const age = birthStr ? calculateAge(birthStr) : 0;
        const ageStr = age > 0 ? `${age}歳` : "";

        const workHistory: Array<{
            companyName?: string;
            startDate?: { year?: string; month?: string };
            endDate?: { year?: string; month?: string };
            isCurrent?: boolean;
            position?: string;
            department?: string;
            employmentType?: string;
            businessDescription?: string;
            responsibilities?: string;
            achievements?: string;
        }> = resumeData?.workHistory ?? [];
        const educationHistory: Array<{
            schoolName?: string;
            startDate?: { year?: string; month?: string };
            graduationDate?: { year?: string; month?: string };
            faculty?: string;
            department?: string;
            status?: string;
        }> = resumeData?.educationHistory ?? [];
        const certifications: Array<{
            name?: string;
            date?: { year?: string; month?: string };
        }> = resumeData?.certifications ?? [];

        const workLines = workHistory.map((w) => {
            const sy = w.startDate?.year ?? "";
            const sm = w.startDate?.month ?? "";
            const ey = w.isCurrent ? "" : w.endDate?.year ?? "";
            const em = w.isCurrent ? "" : w.endDate?.month ?? "";
            const period = `${sy ? sy + "年" : ""}${sm ? sm + "月" : ""}〜${w.isCurrent ? "現在" : ey ? ey + "年" + (em ? em + "月" : "") : ""}`;
            const lines = [`・${period}　${w.companyName ?? ""}　${w.position ?? ""}${w.department ? "（" + w.department + "）" : ""}${w.employmentType ? "【" + w.employmentType + "】" : ""}`];
            if (w.businessDescription) lines.push(`　事業内容：${w.businessDescription}`);
            if (w.responsibilities) lines.push(`　担当業務：${w.responsibilities}`);
            if (w.achievements) lines.push(`　実績：${w.achievements}`);
            return lines.join("\n");
        }).join("\n");

        const eduLines = educationHistory.map((e) => {
            const sy = e.startDate?.year ?? "";
            const gy = e.graduationDate?.year ?? "";
            const gm = e.graduationDate?.month ?? "";
            return `・${sy ? sy + "年〜" : ""}${gy ? gy + "年" + (gm ? gm + "月" : "") : ""}　${e.schoolName ?? ""}　${e.faculty ?? ""}${e.department ?? ""}　${e.status ?? ""}`;
        }).join("\n");

        const certLines = certifications.map((c) => {
            const cy = c.date?.year ?? "";
            const cm = c.date?.month ?? "";
            return `・${cy ? cy + "年" + (cm ? cm + "月" : "") + "　" : ""}${c.name ?? ""}`;
        }).join("\n");

        const prompt = `あなたは転職エージェントのプロフェッショナルです。以下の情報を元に、企業の採用担当者へ送る推薦文を作成してください。

【候補者基本情報】
氏名：${fullName}${ageStr ? "（" + ageStr + "）" : ""}
${profile.address ? "居住地：" + profile.address : ""}

【学歴】
${eduLines || "（データなし）"}

【職務経歴】
${workLines || "（データなし）"}

${certLines ? "【資格・免許】\n" + certLines : ""}

${resumeData?.careerSummary ? "【職務要約】\n" + resumeData.careerSummary : ""}

${resumeData?.skillsSummary ? "【スキル・経験】\n" + resumeData.skillsSummary : ""}

${resumeData?.selfPromotion ? "【自己PR】\n" + resumeData.selfPromotion : ""}

【推薦先企業・ポジション】
企業名：${targetCompany || "（未入力）"}
ポジション：${targetPosition || "（未入力）"}

${meetingNotes?.trim() ? "【面談メモ・議事録】\n" + meetingNotes.trim() : ""}

${summary?.trim() ? "【エージェント総評のヒント】\n" + summary.trim() : ""}
${strengths?.trim() ? "【推したいポイントのヒント】\n" + strengths.trim() : ""}
${concerns?.trim() ? "【留意点のヒント】\n" + concerns.trim() : ""}
${matchReason?.trim() ? "【マッチ理由のヒント】\n" + matchReason.trim() : ""}

---

【推薦文の作成ルール】
- 転職エージェントが企業の採用担当者へ送る推薦文として書く
- 面談メモの内容を最大限に活かし、候補者の人物像・強みを具体的に表現する
- 履歴書・職務経歴書の内容とも整合性を保つ
- 以下のセクション構成で作成する（各セクション名は【】で囲む）：
  - 候補者名と年齢
  - 【総評】
  - 【特に評価しているポイント】
  - 【ご経歴の概要】（職歴を箇条書きで）
  - 【貴社ポジションとのマッチ理由】
  - 【ご留意いただきたい点】
  - 締めの一文
- 自然なビジネス日本語で、温かみのある文体にする
- 推薦文の本文のみ出力（説明文・マークダウン記法は不要）
- 各セクションは適度な長さで、全体で800〜1200字程度を目安にする`;

        const result = await model.generateContent({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });

        const text = result.response.text().trim();

        return NextResponse.json({ ok: true, text });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "予期せぬエラーが発生しました。";
        console.error("API recommendation/generate error:", error);
        return NextResponse.json(
            { ok: false, error: message },
            { status: 500 }
        );
    }
}
