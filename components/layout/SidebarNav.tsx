"use client";

import React from "react";
import { User, Briefcase, GraduationCap, Award, FileText, Settings, Sparkles, CheckCircle2 } from "lucide-react";

const navItems = [
    { id: "profile", label: "基本情報", icon: User },
    { id: "work", label: "職務経歴", icon: Briefcase },
    { id: "education", label: "学歴", icon: GraduationCap },
    { id: "skills", label: "スキル・知識", icon: Settings },
    { id: "certifications", label: "免許・資格", icon: Award },
    { id: "pr", label: "自己PR・動機", icon: FileText },
    { id: "ai", label: "AI一括入力", icon: Sparkles, highlight: true },
];

interface Props {
    activeSection: string;
    onSectionChange: (id: string) => void;
    completion: Record<string, boolean>;
}

export const SidebarNav: React.FC<Props> = ({ activeSection, onSectionChange, completion }) => {
    return (
        <nav className="w-64 border-r border-zinc-200 bg-white h-full flex flex-col p-4">
            <div className="space-y-1">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeSection === item.id;
                    const isComplete = completion[item.id];

                    return (
                        <button
                            key={item.id}
                            onClick={() => onSectionChange(item.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${isActive
                                    ? "bg-indigo-50 text-indigo-700 shadow-sm"
                                    : "text-zinc-600 hover:bg-zinc-50"
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`${isActive ? "text-indigo-600" : "text-zinc-400"} ${item.highlight ? "text-amber-500" : ""}`}>
                                    <Icon size={20} />
                                </div>
                                <span className={`text-sm font-medium ${isActive ? "font-semibold" : ""}`}>
                                    {item.label}
                                </span>
                            </div>
                            {isComplete && !isActive && (
                                <CheckCircle2 size={16} className="text-emerald-500" />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="mt-auto p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">完成度</span>
                    <span className="text-xs font-bold text-indigo-600">65%</span>
                </div>
                <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-[65%]" />
                </div>
            </div>
        </nav>
    );
};
