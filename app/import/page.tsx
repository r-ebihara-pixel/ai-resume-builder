"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle, Download, FileText } from "lucide-react";
import Link from "next/link";
import type { ParsedApplicant } from "@/types/applicant";
import { parseJobMediaText, detectSourceType, type SourceType } from "@/lib/jobMediaParser";

const SOURCE_LABELS: Record<SourceType, string> = {
    "doda": "DODA",
    "mynavi": "マイナビ転職",
    "en": "エン転職",
    "woman-type": "女の転職type",
    "airwork-indeed": "Airwork / Indeed",
    "generic": "汎用フォーマット",
    "unknown": "不明",
};

export default function ImportPage() {
    const router = useRouter();
    const [rawText, setRawText] = useState("");
    const [detectedSource, setDetectedSource] = useState<SourceType | null>(null);
    const [manualSource, setManualSource] = useState<SourceType | null>(null);
    const [parsed, setParsed] = useState<ParsedApplicant | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Auto-detect source when text changes
    useEffect(() => {
        if (!rawText.trim()) {
            setDetectedSource(null);
            return;
        }

        const detected = detectSourceType(rawText);
        setDetectedSource(detected);

        // Reset manual selection if auto-detection succeeds
        if (detected !== "unknown") {
            setManualSource(null);
        }
    }, [rawText]);

    const handleParse = () => {
        if (!rawText.trim()) return;

        setLoading(true);
        setError(null);
        setParsed(null);

        try {
            const source = manualSource || detectedSource || "generic";
            const result = parseJobMediaText(rawText, source);

            console.log("[Import] Parsed result:", result);
            setParsed(result);
        } catch (err) {
            console.error(err);
            setError("データの解析中にエラーが発生しました。もう一度お試しください。");
        } finally {
            setLoading(false);
        }
    };

    const handleApply = () => {
        if (!parsed) return;
        // localStorageに保存
        localStorage.setItem("latestApplicant", JSON.stringify(parsed));
        // 履歴書作成画面へ遷移
        alert("履歴書フォームにデータを渡しました。履歴書画面を開きます。");
        router.push("/");
    };

    const showManualSelector = detectedSource === "unknown";
    const effectiveSource = manualSource || detectedSource;

    return (
        <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
            <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
                <div className="max-w-4xl mx-auto flex items-center gap-4">
                    <Link href="/" className="text-gray-500 hover:text-gray-700 transition">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-xl font-bold text-gray-800">応募データ取り込み（コピペ）</h1>
                </div>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-8">
                <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <p className="text-sm text-gray-600">
                            DODA、マイナビ転職、エン転職、女の転職type、Airwork、Indeedなどの応募者詳細画面から、プロフィール情報をコピーして貼り付けてください。
                        </p>

                        {/* Source detection badge */}
                        {effectiveSource && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ml-4 ${effectiveSource === "unknown"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                                }`}>
                                <FileText size={14} />
                                {SOURCE_LABELS[effectiveSource]}
                            </div>
                        )}
                    </div>

                    <textarea
                        className="w-full h-64 p-4 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 font-mono"
                        placeholder="ここにテキストを貼り付けてください..."
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                    />

                    {/* Manual source selector (shown only if unknown) */}
                    {showManualSelector && rawText.trim() && (
                        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <p className="text-sm text-yellow-800 font-semibold mb-3">
                                ⚠️ 媒体を自動判別できませんでした。以下から選択してください：
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {(["doda", "mynavi", "en", "woman-type", "airwork-indeed", "generic"] as SourceType[]).map((source) => (
                                    <button
                                        key={source}
                                        onClick={() => setManualSource(source)}
                                        className={`px-4 py-2 text-sm rounded-lg border-2 transition ${manualSource === source
                                            ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                                            : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                                            }`}
                                    >
                                        {SOURCE_LABELS[source]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={handleParse}
                            disabled={loading || !rawText.trim()}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : null}
                            自動解析する
                        </button>
                    </div>

                    <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-gray-500">
                            ※ 個人情報はお使いのブラウザローカルのみに保存されます
                        </p>
                        <div className="flex gap-2">
                            <Link
                                href="/pdf-import"
                                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                            >
                                <Download size={14} />
                                PDF取り込みはこちら
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2 mb-6">
                        <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                        <p className="text-sm">{error}</p>
                    </div>
                )}

                {/* Success & Preview */}
                {parsed && (
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle className="text-green-600" size={24} />
                            <h2 className="text-lg font-bold text-gray-800">解析完了</h2>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
                            <dl className="space-y-2 text-sm">
                                {parsed.name && (
                                    <div className="flex gap-2">
                                        <dt className="font-semibold text-gray-700 w-24">氏名:</dt>
                                        <dd className="text-gray-900">{parsed.name}</dd>
                                    </div>
                                )}
                                {parsed.kana && (
                                    <div className="flex gap-2">
                                        <dt className="font-semibold text-gray-700 w-24">フリガナ:</dt>
                                        <dd className="text-gray-900">{parsed.kana}</dd>
                                    </div>
                                )}
                                {parsed.birthday && (
                                    <div className="flex gap-2">
                                        <dt className="font-semibold text-gray-700 w-24">生年月日:</dt>
                                        <dd className="text-gray-900">{parsed.birthday}</dd>
                                    </div>
                                )}
                                {parsed.gender && (
                                    <div className="flex gap-2">
                                        <dt className="font-semibold text-gray-700 w-24">性別:</dt>
                                        <dd className="text-gray-900">{parsed.gender}</dd>
                                    </div>
                                )}
                                {parsed.email && (
                                    <div className="flex gap-2">
                                        <dt className="font-semibold text-gray-700 w-24">メール:</dt>
                                        <dd className="text-gray-900">{parsed.email}</dd>
                                    </div>
                                )}
                                {parsed.phone && (
                                    <div className="flex gap-2">
                                        <dt className="font-semibold text-gray-700 w-24">電話:</dt>
                                        <dd className="text-gray-900">{parsed.phone}</dd>
                                    </div>
                                )}
                                {parsed.postalCode && (
                                    <div className="flex gap-2">
                                        <dt className="font-semibold text-gray-700 w-24">郵便番号:</dt>
                                        <dd className="text-gray-900">〒{parsed.postalCode}</dd>
                                    </div>
                                )}
                                {parsed.address && (
                                    <div className="flex gap-2">
                                        <dt className="font-semibold text-gray-700 w-24">住所:</dt>
                                        <dd className="text-gray-900">{parsed.address}</dd>
                                    </div>
                                )}
                            </dl>
                        </div>

                        <button
                            onClick={handleApply}
                            className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2"
                        >
                            <CheckCircle size={20} />
                            このデータで履歴書を作成する
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}
