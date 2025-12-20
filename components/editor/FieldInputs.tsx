"use client";

import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    help?: string;
}

export const FieldInput: React.FC<InputProps> = ({ label, help, className = "", ...props }) => {
    return (
        <div className="space-y-1.5 flex-1">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">
                {label}
            </label>
            <input
                className={`w-full h-11 px-4 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-zinc-300 ${className}`}
                {...props}
            />
            {help && <p className="text-[11px] text-zinc-400 px-1">{help}</p>}
        </div>
    );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label: string;
    help?: string;
}

export const FieldTextarea: React.FC<TextareaProps> = ({ label, help, className = "", ...props }) => {
    return (
        <div className="space-y-1.5 flex-1">
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">
                {label}
            </label>
            <textarea
                className={`w-full p-4 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-zinc-300 min-h-[120px] resize-y ${className}`}
                {...props}
            />
            {help && <p className="text-[11px] text-zinc-400 px-1">{help}</p>}
        </div>
    );
};
