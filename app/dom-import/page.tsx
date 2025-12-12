"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedApplicant } from "@/types/applicant";

export default function DomImportPage() {
    const router = useRouter();
    const [message, setMessage] = useState("データを取り込み中です…");

    useEffect(() => {
        try {
            const cookieStr = document.cookie
                .split("; ")
                .find((c) => c.startsWith("domImport="));

            if (!cookieStr) {
                setMessage("取り込めるデータが見つかりませんでした。");
                return;
            }

            const raw = decodeURIComponent(cookieStr.split("=")[1]);
            const { parsed } = JSON.parse(raw) as {
                sessionId: string;
                parsed: ParsedApplicant;
            };

            // localStorage に保存（既存フローを再利用）
            localStorage.setItem("latestApplicant", JSON.stringify(parsed));

            // Cookie を削除
            document.cookie =
                "domImport=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";

            setMessage("履歴書フォームにデータを渡しました。画面を移動します…");

            setTimeout(() => {
                router.push("/");
            }, 1000);
        } catch (e) {
            console.error(e);
            setMessage("取り込み中にエラーが発生しました。");
        }
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="bg-white p-6 rounded shadow text-sm text-gray-700">
                {message}
            </div>
        </div>
    );
}
