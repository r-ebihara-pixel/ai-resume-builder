// app/api/import-from-pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { ParsedApplicant } from "@/types/applicant";
import { parseApplicant } from "@/lib/parseApplicantFromText";
import { extractTextFromPdfByOcr } from "@/lib/ocr";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            console.warn("[PDF IMPORT] No file uploaded");
            return NextResponse.json(
                { ok: false, error: "No file uploaded", parsed: null },
                { status: 400 }
            );
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const text = await extractTextFromPdfByOcr(buffer);

        if (!text || !text.trim()) {
            console.warn("[PDF IMPORT] OCR returned empty text");
            return NextResponse.json(
                { ok: false, error: "OCR returned empty text", parsed: null },
                { status: 200 }
            );
        }

        // Guard sensitive data logging - only in development
        if (process.env.NODE_ENV === "development") {
            console.log("[PDF IMPORT] OCR TEXT HEAD:", text.slice(0, 300));
        }

        const parsed = parseApplicant(text);

        if (process.env.NODE_ENV === "development") {
            console.log("[PDF IMPORT] parsed applicant:", {
                name: parsed.name,
                birthday: parsed.birthday,
                address: parsed.address,
            });
        }

        return NextResponse.json(
            { ok: true, error: null, parsed },
            { status: 200 }
        );
    } catch (err) {
        console.error("[PDF IMPORT] ERROR:", err);
        return NextResponse.json(
            { ok: false, error: "Unexpected error during PDF import", parsed: null },
            { status: 500 }
        );
    }
}
