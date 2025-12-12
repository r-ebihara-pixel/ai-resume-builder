// lib/utils/text.tsx
import React from "react";

/**
 * Wrap only digit segments (half-width and full-width) in
 * <span className="font-mincho-num"> so that numbers use a Mincho font.
 */
export function renderWithMinchoDigits(
    text: string | null | undefined
): React.ReactNode {
    if (!text) return null;

    const parts = String(text).split(/([0-9０-９]+)/);

    return parts.map((part, index) => {
        if (!part) return null;

        // Digits only (half-width or full-width)
        if (/^[0-9０-９]+$/.test(part)) {
            return (
                <span key={index} className="font-mincho-num">
                    {part}
                </span>
            );
        }

        // Non-digit segments: return as-is
        return <React.Fragment key={index}>{part}</React.Fragment>;
    });
}
