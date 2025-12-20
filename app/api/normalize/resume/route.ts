import { NextRequest, NextResponse } from "next/server";
import { extractResumeDataFromText } from "@/lib/extract/extractResumeDataFromText";

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text) {
            return NextResponse.json(
                { ok: false, error: "テキストが空です。" },
                { status: 400 }
            );
        }

        const result = await extractResumeDataFromText(text);

        if (result.ok) {
            return NextResponse.json({
                ok: true,
                resumeData: result.resumeData,
                warnings: result.warnings,
                confidence: result.confidence,
            });
        } else {
            return NextResponse.json(
                {
                    ok: false,
                    error: result.error,
                    debug: process.env.NODE_ENV !== "production" ? result.debug : undefined
                },
                { status: 422 }
            );
        }
    } catch (error: any) {
        console.error("API normalize/resume error:", error);
        return NextResponse.json(
            { ok: false, error: error.message || "予期せぬエラーが発生しました。" },
            { status: 500 }
        );
    }
}
