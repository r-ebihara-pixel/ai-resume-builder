/**
 * Airwork / Indeed Format Parser
 * Parses single-line compressed resume text from Airwork/Indeed job media
 */

import type { ParsedApplicant } from "@/types/applicant";

/**
 * Detect if text is in Airwork/Indeed format
 * These are typically single-line with no breaks
 */
export function isAirworkIndeedFormat(text: string): boolean {
    return (
        /indeedemail\.com/.test(text) ||          // Indeed relay email
        /転居可能な地域/.test(text) ||            // Airwork-style label
        /個人情報詳細/.test(text)
    );
}

/**
 * Extract name and furigana from Airwork/Indeed pattern
 * Pattern: LastKanji(LastKana)FirstKanji(FirstKana)〒...
 * Example: "菊地（きくち）将之（まさゆき）〒236-0026..."
 */
function extractNameFromAirworkIndeed(text: string): { name?: string; kana?: string } {
    const result: { name?: string; kana?: string } = {};

    // Pattern: LastKanji(LastKana)FirstKanji(FirstKana)
    const m = text.match(/^([^\s〒]+?)（([^）]+)）([^\s〒]+?)（([^）]+)）/);
    if (!m) return result;

    const lastKanji = m[1];
    const lastKana = m[2];
    const firstKanji = m[3];
    const firstKana = m[4];

    result.name = `${lastKanji} ${firstKanji}`;
    result.kana = `${lastKana} ${firstKana}`;

    return result;
}

/**
 * Extract postal code and address from Airwork/Indeed text
 * Example: "〒236-0026神奈川県 横浜市金沢区 柳町5-2 シャラ八景館イースト106 abuv..."
 */
function extractAddressFromAirworkIndeed(text: string): {
    postalCode?: string;
    address?: string;
} {
    const result: { postalCode?: string; address?: string } = {};

    const postalRegex = /〒\s*(\d{3})-?(\d{4})/;
    const postalMatch = postalRegex.exec(text);
    if (!postalMatch) return result;

    result.postalCode = `${postalMatch[1]}${postalMatch[2]}`;

    // Take everything after postal code until email or phone
    const startAddrIdx = (postalMatch.index ?? 0) + postalMatch[0].length;

    const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+/;
    const emailMatch = emailRegex.exec(text);

    const phoneRegex = /\+81\s*\d{2}\s*\d{4}\s*\d{4}|0\d{1,3}-?\d{2,4}-?\d{4}/;
    const phoneMatch = phoneRegex.exec(text);

    const endAddrIdxCandidates = [emailMatch?.index, phoneMatch?.index]
        .filter((i): i is number => typeof i === "number" && i > startAddrIdx);
    const endAddrIdx =
        endAddrIdxCandidates.length > 0 ? Math.min(...endAddrIdxCandidates) : text.length;

    const addrRaw = text.slice(startAddrIdx, endAddrIdx).trim();
    result.address = addrRaw;

    return result;
}

/**
 * Extract email from text
 */
function extractEmail(text: string): string | undefined {
    const emailRegex = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]+/;
    const m = emailRegex.exec(text);
    return m ? m[0] : undefined;
}

/**
 * Extract phone from text
 * Handles both international (+81) and domestic formats
 */
function extractPhone(text: string): string | undefined {
    // Prefer international +81 format, convert to domestic
    const intl = text.match(/\+81\s*(\d{2})\s*(\d{4})\s*(\d{4})/);
    if (intl) {
        // Convert +81 80 xxxx yyyy -> 080xxxxyyyy
        return `0${intl[1]}${intl[2]}${intl[3]}`;
    }

    const jp = text.match(/0\d{1,3}-?\d{2,4}-?\d{4}/);
    if (jp) {
        return jp[0].replace(/-/g, "");
    }

    return undefined;
}

/**
 * Extract gender from text
 * Example: "個人情報詳細性別: 男性生年月日..."
 */
function extractGender(text: string): string | undefined {
    const m = text.match(/性別:\s*([^\s]+)/);
    return m ? m[1] : undefined;
}

/**
 * Extract birthday from text
 * Example: "生年月日: 1992-04-14"
 */
function extractBirthday(text: string): string | undefined {
    const m = text.match(/生年月日:\s*(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return undefined;
    return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Generic section extractor
 * Extracts text between a label and one of the end labels
 */
function extractSectionRaw(
    text: string,
    label: string,
    endLabels: string[]
): string | undefined {
    const startIdx = text.indexOf(label);
    if (startIdx === -1) return undefined;

    const searchStart = startIdx + label.length;

    let endIdx = text.length;
    for (const next of endLabels) {
        const idx = text.indexOf(next, searchStart);
        if (idx !== -1 && idx < endIdx) {
            endIdx = idx;
        }
    }

    const raw = text.slice(searchStart, endIdx).trim();
    return raw || undefined;
}

/**
 * Extract work history raw text
 * Between "職歴" and "学歴"
 */
function extractWorkHistoryRaw(text: string): string | undefined {
    return extractSectionRaw(text, "職歴", ["学歴", "スキル", "資格と免許"]);
}

/**
 * Extract education raw text
 * Between "学歴" and "スキル" or "資格と免許"
 */
function extractEducationRaw(text: string): string | undefined {
    return extractSectionRaw(text, "学歴", ["スキル", "資格と免許"]);
}

/**
 * Extract licenses raw text
 * From "資格と免許" to end
 */
function extractLicensesRaw(text: string): string | undefined {
    return extractSectionRaw(text, "資格と免許", []);
}

/**
 * Main Airwork/Indeed parser
 * Populates ParsedApplicant with extracted data
 */
export function parseAirworkIndeed(
    text: string,
    rawText: string
): Partial<ParsedApplicant> {
    const result: Partial<ParsedApplicant> = {
        rawText,
    };

    // 1) Name & kana
    const nameInfo = extractNameFromAirworkIndeed(text);
    if (nameInfo.name) result.name = nameInfo.name;
    if (nameInfo.kana) result.kana = nameInfo.kana;

    // 2) Address & postal
    const addrInfo = extractAddressFromAirworkIndeed(text);
    if (addrInfo.postalCode) result.postalCode = addrInfo.postalCode;
    if (addrInfo.address) result.address = addrInfo.address;

    // 3) Email & phone
    const email = extractEmail(text);
    if (email) result.email = email;

    const phone = extractPhone(text);
    if (phone) result.phone = phone;

    // 4) Gender & birthday
    const gender = extractGender(text);
    if (gender) result.gender = gender;

    const birthday = extractBirthday(text);
    if (birthday) result.birthday = birthday;

    // 5) Raw sections
    const workHistoryRaw = extractWorkHistoryRaw(text);
    if (workHistoryRaw) result.workHistoryRaw = workHistoryRaw;

    const educationRaw = extractEducationRaw(text);
    if (educationRaw) result.educationRaw = educationRaw;

    const licensesRaw = extractLicensesRaw(text);
    if (licensesRaw) result.licensesRaw = licensesRaw;

    // Note: Airwork/Indeed typically doesn't have explicit self PR or motivation sections
    // in the standard format, so we leave those undefined

    return result;
}
