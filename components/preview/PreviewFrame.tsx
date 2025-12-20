"use client";

import React, { useEffect, useRef } from "react";
import { ResumeData } from "@/types/resume";

interface Props {
    data: ResumeData;
}

export const PreviewFrame: React.FC<Props> = ({ data }) => {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Sync data to iframe when it changes
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage(
                    { type: "RESUME_DATA_UPDATE", payload: data },
                    "*"
                );
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(timeoutId);
    }, [data]);

    return (
        <div className="w-full h-full bg-zinc-800 flex flex-col overflow-hidden shadow-inner">
            <div className="bg-zinc-900 border-b border-zinc-700 px-4 py-2 flex items-center justify-between">
                <span className="text-zinc-400 text-xs font-medium">PREVIEW</span>
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-zinc-100 p-8 flex justify-center">
                <iframe
                    ref={iframeRef}
                    src="/preview"
                    className="w-[210mm] h-[297mm] border-none shadow-2xl bg-white"
                    title="Resume Preview"
                />
            </div>
        </div>
    );
};
