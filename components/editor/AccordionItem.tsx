"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Trash2, Copy, GripVertical } from "lucide-react";

interface Props {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    onDelete?: () => void;
    onDuplicate?: () => void;
    isOpenDefault?: boolean;
}

export const AccordionItem: React.FC<Props> = ({
    title,
    subtitle,
    children,
    onDelete,
    onDuplicate,
    isOpenDefault = false,
}) => {
    const [isOpen, setIsOpen] = useState(isOpenDefault);

    return (
        <div className="border border-zinc-200 rounded-xl overflow-hidden mb-3 bg-white transition-all hover:border-zinc-300">
            <div
                className={`flex items-center justify-between p-4 cursor-pointer select-none ${isOpen ? "bg-zinc-50 border-b border-zinc-100" : ""
                    }`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="text-zinc-300">
                        <GripVertical size={18} />
                    </div>
                    <div>
                        <h4 className="text-sm font-bold text-zinc-900">{title || "新規項目"}</h4>
                        {subtitle && <p className="text-xs text-zinc-500 font-medium">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {onDuplicate && (
                        <button
                            onClick={onDuplicate}
                            className="p-2 text-zinc-400 hover:text-indigo-600 transition-colors"
                            title="複製"
                        >
                            <Copy size={16} />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={onDelete}
                            className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                            title="削除"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                    <div className="h-4 w-px bg-zinc-200 mx-1" />
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="p-1 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                        {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>
            </div>
            {isOpen && <div className="p-5 animate-in slide-in-from-top-2 duration-200">{children}</div>}
        </div>
    );
};
