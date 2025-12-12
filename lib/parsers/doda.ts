/**
 * DODA Format Parser
 * Parses resume/application text from DODA job media
 */

import type { ParsedApplicant } from "@/types/applicant";

/**
 * Detect if text is in DODA format
 */
export function isDodaFormat(lines: string[]): boolean {
    // DODA characteristics:
    // - Has 職務経歴, 職務要約, 学歴 sections
    // - Often has 姓名 in separate kanji/kana lines
    // - May have 語学力, 資格 sections
    return lines.some(line =>
        /職務要約|職務経歴書|DODA/.test(line)
    ) && lines.some(line =>
        /学歴|最終学歴/.test(line)
    );
}

/**
 * Extract name and kana from DODA format
 * DODA typically has separate lines for kana and kanji name
 */
function extractNameFromDoda(lines: string[]): { name?: string; kana?: string } {
    const result: { name?: string; kana?: string } = {};

    // Look for explicit labels
    const nameLineLab = lines.find(l => /^(氏名|姓名|お名前)[：:]\s*(.+)/.test(l));
    if (nameLineLab) {
        const match = nameLineLab.match(/^(氏名|姓名|お名前)[：:]\s*(.+)/);
        if (match) result.name = match[2].trim();
    }

    const kanaLineLab = lines.find(l => /^(フリガナ|ふりがな|カナ)[：:]\s*(.+)/.test(l));
    if (kanaLineLab) {
        const match = kanaLineLab.match(/^(フリガナ|ふりがな|カナ)[：:]\s*(.+)/);
        if (match) result.kana = match[2].trim();
    }

    // If no labels found, try first few lines
    if (!result.name && lines.length > 0) {
        // Assuming first non-label line might be name
        const firstLine = lines[0];
        if (!/^(氏名|フリガナ|生年月日|住所|電話)/.test(firstLine)) {
            result.name = firstLine.trim();
        }
    }

    return result;
}

/**
 * Extract birthdate, age, gender from DODA format
 */
function extractBirthFromDoda(lines: string[]): {
    birthday?: string;
    age?: string;
    gender?: string;
} {
    const result: { birthday?: string; age?: string; gender?: string } = {};

    const birthLine = lines.find(l => /生年月日|年齢/.test(l));
    if (birthLine) {
        // Extract date
        const dateMatch = birthLine.match(/(\d{4})[年\/\-](\d{1,2})[月\/\-](\d{1,2})/);
        if (dateMatch) {
            const year = dateMatch[1].padStart(4, "0");
            const month = dateMatch[2].padStart(2, "0");
            const day = dateMatch[3].padStart(2, "0");
            result.birthday = `${year}-${month}-${day}`;
        }

        // Extract age
        const ageMatch = birthLine.match(/(\d{2})\s*歳/);
        if (ageMatch) result.age = ageMatch[1];

        // Extract gender
        if (/男性/.test(birthLine)) result.gender = "男性";
        else if (/女性/.test(birthLine)) result.gender = "女性";
    }

    return result;
}

/**
 * Extract address and postal code from DODA format
 */
function extractAddressFromDoda(lines: string[]): {
    postalCode?: string;
    address?: string;
} {
    const result: { postalCode?: string; address?: string } = {};

    const addrIdx = lines.findIndex(l => /^(住所|現住所)[：:]/.test(l));
    if (addrIdx !== -1) {
        // Get current line and possibly next lines
        const addrLines = [
            lines[addrIdx].replace(/^(住所|現住所)[：:]/, "").trim(),
            lines[addrIdx + 1],
            lines[addrIdx + 2]
        ].filter(Boolean);

        const fullText = addrLines.join(" ");

        // Extract postal code
        const postalMatch = fullText.match(/〒?\s*(\d{3})-?(\d{4})/);
        if (postalMatch) {
            result.postalCode = `${postalMatch[1]}${postalMatch[2]}`;
        }

        // Extract address (remove postal code)
        let addr = fullText.replace(/〒?\s*\d{3}-?\d{4}/, "").trim();
        if (addr) result.address = addr;
    }

    return result;
}

/**
 * Extract email from text
 */
function extractEmail(text: string): string | undefined {
    const match = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return match ? match[0] : undefined;
}

/**
 * Extract phone from text
 */
function extractPhone(text: string): string | undefined {
    const match = text.match(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/);
    return match ? match[0].replace(/[-\s]/g, "") : undefined;
}

/**
 * Extract section content between labels
 */
function extractSection(
    lines: string[],
    startLabel: string,
    endLabels: string[]
): string | undefined {
    const startIdx = lines.findIndex(l => l.includes(startLabel));
    if (startIdx === -1) return undefined;

    let endIdx = lines.length;
    for (const endLabel of endLabels) {
        const idx = lines.findIndex((l, i) => i > startIdx && l.includes(endLabel));
        if (idx !== -1 && idx < endIdx) endIdx = idx;
    }

    const sectionLines = lines.slice(startIdx + 1, endIdx).filter(l => l.trim());
    return sectionLines.length > 0 ? sectionLines.join("\n") : undefined;
}

/**
 * Main DODA parser
 */
export function parseDoda(
    lines: string[],
    rawText: string
): Partial<ParsedApplicant> {
    const result: Partial<ParsedApplicant> = {
        rawText,
    };

    const joined = lines.join("\n");

    // 1) Name & kana
    const name = extractNameFromDoda(lines);
    if (name.name) result.name = name.name;
    if (name.kana) result.kana = name.kana;

    // 2) Birth, age, gender
    const birth = extractBirthFromDoda(lines);
    if (birth.birthday) result.birthday = birth.birthday;
    if (birth.age) result.age = birth.age;
    if (birth.gender) result.gender = birth.gender;

    // 3) Address & postal
    const addr = extractAddressFromDoda(lines);
    if (addr.postalCode) result.postalCode = addr.postalCode;
    if (addr.address) result.address = addr.address;

    // 4) Email & phone
    const email = extractEmail(joined);
    if (email) result.email = email;

    const phone = extractPhone(joined);
    if (phone) result.phone = phone;

    // 5) Education raw
    const educationRaw = extractSection(lines, "学歴", ["職歴", "職務経歴", "資格", "語学力"]);
    if (educationRaw) result.educationRaw = educationRaw;

    // 6) Work history raw
    const workHistoryRaw = extractSection(lines, "職務経歴", ["学歴", "資格", "志望動機", "自己PR"]) ||
        extractSection(lines, "職歴", ["学歴", "資格", "志望動機", "自己PR"]);
    if (workHistoryRaw) result.workHistoryRaw = workHistoryRaw;

    // 7) Licenses raw
    const licensesRaw = extractSection(lines, "資格", ["志望動機", "自己PR", "語学力"]);
    if (licensesRaw) result.licensesRaw = licensesRaw;

    // 8) Self PR
    const selfPrRaw = extractSection(lines, "自己PR", ["志望動機", "希望条件"]);
    if (selfPrRaw) result.selfPr = selfPrRaw;

    // 9) Motivation
    const motivationRaw = extractSection(lines, "志望動機", ["自己PR", "希望条件"]);
    if (motivationRaw) result.motivation = motivationRaw;

    return result;
}
