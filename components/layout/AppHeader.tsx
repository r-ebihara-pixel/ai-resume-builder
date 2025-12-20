"use client";

import React from "react";
import { Check, Cloud, Download, HelpCircle, Layout, Share2 } from "lucide-react";

interface Props {
    isSaving: boolean;
    onDownload: () => void;
}

export const AppHeader: React.FC<Props> = ({ isSaving, onDownload }) => {
    return (
        <header className="h-16 border-b border-zinc-200 bg-white flex items-center justify-between px-6 sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                    <Layout size={20} />
                </div>
                <span className="font-bold text-xl tracking-tight text-zinc-900">Resume.jp</span>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-sm text-zinc-500 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100">
                    {isSaving ? (
                        <>
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span>保存中...</span>
                        </>
                    ) : (
                        <>
                            <Check className="w-4 h-4 text-emerald-500" />
                            <span>保存済み</span>
                        </>
                    )}
                </div>

                <div className="h-6 w-px bg-zinc-200" />

                <div className="flex items-center gap-2">
                    <button className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors">
                        <Share2 size={20} />
                    </button>
                    <button className="p-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors">
                        <HelpCircle size={20} />
                    </button>
                    <button
                        onClick={onDownload}
                        className="ml-2 flex items-center gap-2 bg-zinc-900 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-zinc-800 transition-all shadow-sm active:scale-95"
                    >
                        <Download size={18} />
                        PDF出力
                    </button>
                </div>
            </div>
        </header>
    );
};
