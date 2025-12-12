/**
 * Job Media Parser Coordinator
 * Detects source format and routes to appropriate parser
 */

import type { ParsedApplicant } from "@/types/applicant";
import { parseApplicant } from "./parseApplicantFromText";
import { isDodaFormat, parseDoda } from "./parsers/doda";
import { isMynaviFormat, parseMynavi } from "./parsers/mynavi";
import { isEnTenshokuFormat, parseEnTenshoku } from "./parsers/enTenshoku";
import { isWomanTypeFormat, parseWomanType } from "./parsers/womanType";
import { isAirworkIndeedFormat, parseAirworkIndeed } from "./parsers/airworkIndeed";

export type SourceType =
    | "doda"
    | "mynavi"
    | "en"
    | "woman-type"
    | "airwork-indeed"
    | "generic"
    | "unknown";

/**
 * Normalize imported text into clean lines
 */
export function normalizeImportedText(text: string): string[] {
    let t = text;

    // Normalize line breaks
    t = t.replace(/\r\n?/g, "\n");

    // Normalize full-width spaces
    t = t.replace(/\u3000/g, " ");

    // Collapse multiple spaces
    t = t.replace(/[ \t]+/g, " ");

    const lines = t
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    return lines;
}

/**
 * Detect source type from raw text
 * Returns the detected job media format
 */
export function detectSourceType(rawText: string): SourceType {
    const text = rawText.replace(/\r\n?/g, "\n");

    // Check Airwork/Indeed first (single-line format)
    if (isAirworkIndeedFormat(text)) return "airwork-indeed";

    // Normalize for line-based detection
    const lines = normalizeImportedText(text);

    // Check other formats in priority order
    if (isDodaFormat(lines)) return "doda";
    if (isMynaviFormat(lines)) return "mynavi";
    if (isEnTenshokuFormat(lines)) return "en";
    if (isWomanTypeFormat(lines)) return "woman-type";

    // If we find typical resume structure, it's generic
    const hasName = lines.some(l => /氏名|お名前|名前/.test(l));
    const hasAddress = lines.some(l => /住所|現住所/.test(l));
    if (hasName || hasAddress) return "generic";

    return "unknown";
}

/**
 * Generic fallback parser for unknown formats
 * Uses the existing generic parser
 */
function parseGenericFallback(rawText: string): ParsedApplicant {
    return parseApplicant(rawText);
}

/**
 * Parse job media text with auto-detection or manual source selection
 * @param rawText - Raw text from job media
 * @param manualSource - Optional manual source type override
 * @returns Parsed applicant data
 */
export function parseJobMediaText(
    rawText: string,
    manualSource?: SourceType
): ParsedApplicant {
    const source = manualSource || detectSourceType(rawText);

    let result: Partial<ParsedApplicant>;

    switch (source) {
        case "doda":
            const linesDoda = normalizeImportedText(rawText);
            result = parseDoda(linesDoda, rawText);
            break;

        case "mynavi":
            const linesMynavi = normalizeImportedText(rawText);
            result = parseMynavi(linesMynavi, rawText);
            break;

        case "en":
            const linesEn = normalizeImportedText(rawText);
            result = parseEnTenshoku(linesEn, rawText);
            break;

        case "woman-type":
            const linesWoman = normalizeImportedText(rawText);
            result = parseWomanType(linesWoman, rawText);
            break;

        case "airwork-indeed":
            // Airwork/Indeed is single-line, don't normalize into lines
            const compressedText = rawText.replace(/\r\n?/g, "").trim();
            result = parseAirworkIndeed(compressedText, rawText);
            break;

        case "generic":
        default:
            // Use existing generic parser
            result = parseGenericFallback(rawText);
            break;
    }

    // Ensure source is set and return as ParsedApplicant
    const parsedApplicant = {
        ...result,
        rawText,
    } as ParsedApplicant;

    // Save to localStorage
    if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("latestApplicant", JSON.stringify(parsedApplicant));
    }

    return parsedApplicant;
}

