"use client";

import { useMemo, useEffect, useState } from "react";
import { useResumeStore } from "@/lib/store/resumeStore";
import { Trash2, Save } from "lucide-react";

export function DraftStatus() {
    const updatedAt = useResumeStore((s) => s.updatedAt);
    const clearDraft = useResumeStore((s) => s.clearDraft);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const label = useMemo(() => {
        if (!updatedAt) return "保存データなし";
        return `最終保存: ${new Date(updatedAt).toLocaleString()}`;
    }, [updatedAt]);

    if (!mounted) return null;

    return (
        <div className="flex items-center gap-4 text-sm text-gray-600 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-200">
            <div className="flex items-center gap-1.5">
                <Save size={14} className={updatedAt ? "text-green-500" : "text-gray-400"} />
                <span>{label}</span>
            </div>
            {updatedAt > 0 && (
                <>
                    <div className="h-4 w-px bg-gray-300"></div>
                    <button
                        type="button"
                        onClick={() => {
                            if (confirm("入力内容をすべて削除して初期状態に戻しますか？")) {
                                clearDraft();
                            }
                        }}
                        className="flex items-center gap-1 text-red-500 hover:text-red-700 hover:underline"
                    >
                        <Trash2 size={14} />
                        削除
                    </button>
                </>
            )}
        </div>
    );
}
