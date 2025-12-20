"use client";

import React from "react";

interface Props {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

export const SectionCard: React.FC<Props> = ({ title, description, icon, children, actions }) => {
    return (
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden mb-6">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {icon && <div className="text-zinc-400">{icon}</div>}
                    <div>
                        <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
                        {description && <p className="text-sm text-zinc-500">{description}</p>}
                    </div>
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            <div className="p-6">{children}</div>
        </div>
    );
};
