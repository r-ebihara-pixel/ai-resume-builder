/**
 * Mynavi Format Parser
 * Parses resume/application text from Mynavi job media
 */

import type { ParsedApplicant } from "@/types/applicant";

/**
 * Detect if text is in Mynavi format
 */
export function isMynaviFormat(lines: string[]): boolean {
    // Mynavi characteristics:
    // - Has プロフィールの編集, 希望勤務地, 希望転職時期
    // - Has 専門学校 or 大学 under 学歴
    // - Has 1社目, 2社目 in work history
    return lines.some(line =>
        /プロフィールの編集|希望勤務地|希望転職時期|マイナビ/.test(line)
    ) || (
            lines.some(l => /学歴/.test(l)) &&
            lines.some(l => /専門学校|大学/.test(l)) &&
            lines.some(l => /1社目|2社目/.test(l))
        );
}

/**
 * Extract name and kana from Mynavi format
 * Mynavi often has: 東郷 早南美(トウゴウ サナミ)
 */
function extractNameFromMynavi(lines: string[]): { name?: string; kana?: string } {
    const result: { name?: string; kana?: string } = {};

    // Look for pattern: Kanji(Kana)
    const combinedPattern = /^([^\(（]+)[（(]([^\)）]+)[)）]/;

    for (const line of lines.slice(0, 10)) { // Check first 10 lines
        const match = line.match(combinedPattern);
        if (match) {
            result.name = match[1].trim();
            result.kana = match[2].trim();
            break;
        }
    }

    // Fallback: look for explicit labels
    if (!result.name) {
        const nameLine = lines.find(l => /^(氏名|姓名)[：:]\s*(.+)/.test(l));
        if (nameLine) {
            const match = nameLine.match(/^(氏名|姓名)[：:]\s*(.+)/);
            if (match) result.name = match[2].trim();
        }
    }

    if (!result.kana) {
        const kanaLine = lines.find(l => /^(フリガナ|ふりがな)[：:]\s*(.+)/.test(l));
        if (kanaLine) {
            const match = kanaLine.match(/^(フリガナ|ふりがな)[：:]\s*(.+)/);
            if (match) result.kana = match[2].trim();
        }
    }

    return result;
}

/**
 * Extract birthdate, age, gender from Mynavi format
 */
function extractBirthFromMynavi(lines: string[]): {
    birthday?: string;
    age?: string;
    gender?: string;
} {
    const result: { birthday?: string; age?: string; gender?: string } = {};

    const birthLine = lines.find(l => /生年月日/.test(l));
    if (birthLine) {
        // Extract date: yyyy年mm月dd日 or yyyy/mm/dd
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
 * Extract address and postal code from Mynavi format
 */
function extractAddressFromMynavi(lines: string[]): {
    postalCode?: string;
    address?: string;
} {
    const result: { postalCode?: string; address?: string } = {};

    const addrIdx = lines.findIndex(l => /^(住所|現住所)[：:]?/.test(l) || /^〒/.test(l));
    if (addrIdx !== -1) {
        // Get current line and next few lines
        const addrLines = [
            lines[addrIdx],
            lines[addrIdx + 1],
            lines[addrIdx + 2],
            lines[addrIdx + 3]
        ].filter(Boolean);

        const fullText = addrLines.join(" ");

        // Extract postal code
        const postalMatch = fullText.match(/〒?\s*(\d{3})-?(\d{4})/);
        if (postalMatch) {
            result.postalCode = `${postalMatch[1]}${postalMatch[2]}`;
        }

        // Extract address (remove postal code and label)
        let addr = fullText
            .replace(/^(住所|現住所)[：:]?/, "")
            .replace(/〒?\s*\d{3}-?\d{4}/, "")
            .trim();
        if (addr) result.address = addr;
    }

    return result;
}

/**
 * Extract email from lines
 */
function extractEmail(lines: string[]): string | undefined {
    const emailLine = lines.find(l => /PCアドレス|携帯アドレス|メールアドレス|E-?mail/i.test(l));
    if (emailLine) {
        const match = emailLine.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        return match ? match[0] : undefined;
    }

    // Fallback: search entire text
    const joined = lines.join("\n");
    const match = joined.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    return match ? match[0] : undefined;
}

/**
 * Extract phone from lines
 */
function extractPhone(lines: string[]): string | undefined {
    const phoneLine = lines.find(l => /携帯電話|電話番号/.test(l));
    if (phoneLine) {
        const match = phoneLine.match(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/);
        return match ? match[0].replace(/[-\s]/g, "") : undefined;
    }

    // Fallback
    const joined = lines.join("\n");
    const match = joined.match(/0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4}/);
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
 * Main Mynavi parser
 */
export function parseMynavi(
    lines: string[],
    rawText: string
): Partial<ParsedApplicant> {
    const result: Partial<ParsedApplicant> = {
        rawText,
    };

    // 1) Name & kana
    const name = extractNameFromMynavi(lines);
    if (name.name) result.name = name.name;
    if (name.kana) result.kana = name.kana;

    // 2) Birth, age, gender
    const birth = extractBirthFromMynavi(lines);
    if (birth.birthday) result.birthday = birth.birthday;
    if (birth.age) result.age = birth.age;
    if (birth.gender) result.gender = birth.gender;

    // 3) Address & postal
    const addr = extractAddressFromMynavi(lines);
    if (addr.postalCode) result.postalCode = addr.postalCode;
    if (addr.address) result.address = addr.address;

    // 4) Email & phone
    const email = extractEmail(lines);
    if (email) result.email = email;

    const phone = extractPhone(lines);
    if (phone) result.phone = phone;

    // 5) Education raw
    const educationRaw = extractSection(lines, "学歴", ["職務経歴", "資格", "語学"]) ||
        extractSection(lines, "最終学歴", ["職務経歴", "資格", "語学"]);
    if (educationRaw) result.educationRaw = educationRaw;

    // 6) Work history raw
    const workHistoryRaw = extractSection(lines, "職務経歴", ["学歴", "資格", "志望動機", "自己PR"]);
    if (workHistoryRaw) result.workHistoryRaw = workHistoryRaw;

    // 7) Licenses raw
    const licensesRaw = extractSection(lines, "資格", ["志望動機", "自己PR", "語学"]);
    if (licensesRaw) result.licensesRaw = licensesRaw;

    // 8) Self PR
    const selfPrRaw = extractSection(lines, "自己PR", ["志望動機", "希望条件"]);
    if (selfPrRaw) result.selfPr = selfPrRaw;

    // 9) Motivation
    const motivationRaw = extractSection(lines, "志望動機", ["自己PR", "希望条件"]);
    if (motivationRaw) result.motivation = motivationRaw;

    return result;
}
