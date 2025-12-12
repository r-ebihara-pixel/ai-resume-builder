"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PdfImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async () => {
        if (!file) return;

        setIsLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/import-from-pdf", {
                method: "POST",
                body: formData,
            });

            const json = await res.json();
            console.log("[PDF IMPORT] response json:", json);

            if (!json.ok || !json.parsed || !json.parsed.rawText) {
                setError(
                    json.error ??
                    "Failed to extract text from PDF. Please check OCR settings or try another PDF."
                );
                return;
            }

            // Save parsed applicant into localStorage
            localStorage.setItem("latestApplicant", JSON.stringify(json.parsed));
            console.log("[PDF IMPORT] saved to localStorage.latestApplicant");

            // Redirect to main resume builder
            window.location.href = "/";
        } catch (err) {
            console.error("[PDF IMPORT] client error:", err);
            setError("Unexpected error while importing PDF.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="bg-white p-6 rounded shadow max-w-md w-full space-y-4 text-sm">
                <h1 className="text-lg font-bold mb-2">PDF履歴書の取り込み</h1>
                <p className="text-gray-600">
                    紙の履歴書やPDFの履歴書をアップロードすると、内容を自動解析して履歴書フォームに反映します。
                </p>

                <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        setFile(f);
                        setError(null);
                    }}
                />

                <button
                    disabled={!file || isLoading}
                    onClick={handleSubmit}
                    className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50"
                >
                    {isLoading ? "解析中…" : "アップロードして解析する"}
                </button>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}
