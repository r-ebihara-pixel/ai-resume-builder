import { NextRequest, NextResponse } from "next/server";
import { parseApplicant } from "@/lib/parseApplicantFromText";

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();
        if (typeof text !== "string" || !text.trim()) {
            return NextResponse.json(
                { error: "text is required" },
                { status: 400 }
            );
        }

        const parsed = parseApplicant(text);
        return NextResponse.json(parsed);
    } catch (e) {
        console.error(e);
        return NextResponse.json(
            { error: "internal error" },
            { status: 500 }
        );
    }
}
