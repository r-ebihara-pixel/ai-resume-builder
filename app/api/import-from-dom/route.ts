// app/api/import-from-dom/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { ParsedApplicant } from "@/types/applicant";

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as Partial<ParsedApplicant> & {
            medium?: string; // doda / mynavi / en など
        };

        // 必要最低限のチェック
        if (!body.name && !body.email && !body.phone) {
            return NextResponse.json(
                { error: "Not enough info" },
                { status: 400 }
            );
        }

        const parsed: ParsedApplicant = {
            name: body.name,
            kana: body.kana,
            birthday: body.birthday,
            gender: body.gender,
            email: body.email,
            phone: body.phone,
            address: body.address,
            addressKana: body.addressKana,
            educationRaw: body.educationRaw ?? "",
            workHistoryRaw: body.workHistoryRaw ?? "",
            licensesRaw: body.licensesRaw ?? "",
            motivation: body.motivation ?? "",
            selfPr: body.selfPr ?? "",
            requests: body.requests ?? "",
            rawText: body.rawText ?? "", // DOMからなら "" でもOK
        };

        // セッションIDっぽいものを発行（簡易版として Date.now + rand）
        const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

        // Cookie に詰める
        const res = NextResponse.json({ sessionId });
        res.cookies.set("domImport", JSON.stringify({ sessionId, parsed }), {
            httpOnly: false,  // クライアントJSから読めるように
            sameSite: "lax",
            path: "/",
        });

        return res;
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: "internal error" },
            { status: 500 }
        );
    }
}
