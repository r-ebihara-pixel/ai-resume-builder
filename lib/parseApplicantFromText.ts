import type { ParsedApplicant } from "@/types/applicant";

// ============================================
// Helper Functions
// ============================================

/**
 * Normalize imported text into clean lines
 */
function normalizeImportedText(text: string): string[] {
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
 * Extract Furigana for name and address
 * First occurrence → name Furigana
 * Second occurrence → address Furigana
 */
function extractFurigana(lines: string[]): {
    nameKana?: string;
    addressKana?: string;
} {
    const result: { nameKana?: string; addressKana?: string } = {};
    const furiganaIndices: number[] = [];

    lines.forEach((line, idx) => {
        if (/(フリガナ|ふりがな|カナ)/i.test(line)) {
            furiganaIndices.push(idx);
        }
    });

    const getNextNonEmpty = (start: number) => {
        for (let i = start + 1; i < lines.length; i++) {
            if (lines[i].trim().length > 0) return lines[i];
        }
        return "";
    };

    // First occurrence → name Furigana
    if (furiganaIndices.length >= 1) {
        const idx = furiganaIndices[0];
        const currentLine = lines[idx];

        // Check if Furigana is on the same line (after colon)
        const sameLineMatch = currentLine.match(/(フリガナ|ふりがな|カナ)[：:]\s*(.+)$/);
        if (sameLineMatch && sameLineMatch[2]) {
            result.nameKana = sameLineMatch[2].trim();
        } else {
            // Otherwise get next non-empty line
            result.nameKana = getNextNonEmpty(idx);
        }
    }

    // Second occurrence → address Furigana
    if (furiganaIndices.length >= 2) {
        const idx = furiganaIndices[1];
        const currentLine = lines[idx];

        const sameLineMatch = currentLine.match(/(フリガナ|ふりがな|カナ)[：:]\s*(.+)$/);
        if (sameLineMatch && sameLineMatch[2]) {
            result.addressKana = sameLineMatch[2].trim();
        } else {
            result.addressKana = getNextNonEmpty(idx);
        }
    }

    return result;
}

/**
 * Extract postal code from text
 * Matches patterns like: 〒123-4567, 1234567, 123-4567
 */
function extractPostalCode(lines: string[]): string | undefined {
    const regex = /〒?\s*(\d{3})-?(\d{4})/;

    for (const line of lines) {
        const m = line.match(regex);
        if (m) {
            return `${m[1]}${m[2]}`; // store as '1234567'
        }
    }
    return undefined;
}

/**
 * Parsed education line structure
 */
type ParsedEducationLine = {
    year?: string;
    month?: string;
    schoolName: string;
    status?: "入学" | "卒業" | "中退" | "";
};

/**
 * Parse a single education line
 * Example: "2015年4月 〇〇高等学校 入学"
 */
function parseEducationLine(line: string): ParsedEducationLine | null {
    // Look for yyyy年mm月
    const dateMatch = line.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
    const year = dateMatch?.[1];
    const month = dateMatch?.[2];

    // Keywords for education
    if (!/(高等学校|高校|中学校|大学|短期大学|専門学校)/.test(line)) {
        return null;
    }

    // Extract status
    let status: "入学" | "卒業" | "中退" | "" = "";
    if (/入学/.test(line)) status = "入学";
    else if (/卒業/.test(line)) status = "卒業";
    else if (/中退/.test(line)) status = "中退";

    // Extract school name (remove date and status)
    let schoolName = line
        .replace(/(\d{4})\s*年\s*(\d{1,2})\s*月/, "")
        .replace(/(入学|卒業|中退)/g, "")
        .trim();

    return {
        year,
        month,
        schoolName,
        status,
    };
}

/**
 * Extract all education lines from text
 */
function extractEducationFromLines(lines: string[]): ParsedEducationLine[] {
    const result: ParsedEducationLine[] = [];

    for (const line of lines) {
        const edu = parseEducationLine(line);
        if (edu) result.push(edu);
    }

    return result;
}

// ============================================
// Section Extraction (unchanged)
// ============================================

function extractSections(lines: string[]) {
    const sectionIndex: Partial<
        Record<"education" | "work" | "licenses" | "motivation" | "selfPr" | "requests", number>
    > = {};

    lines.forEach((line, idx) => {
        const l = line.replace(/\s/g, "");

        if (l.includes("学歴") && sectionIndex.education === undefined) {
            sectionIndex.education = idx;
        }
        if ((l.includes("職歴") || l.includes("職務経歴")) && sectionIndex.work === undefined) {
            sectionIndex.work = idx;
        }
        if (
            (l.includes("免許") || l.includes("資格")) &&
            sectionIndex.licenses === undefined
        ) {
            sectionIndex.licenses = idx;
        }
        if (l.includes("志望動機") && sectionIndex.motivation === undefined) {
            sectionIndex.motivation = idx;
        }
        if ((l.includes("自己PR") || l.includes("自己ＰＲ")) && sectionIndex.selfPr === undefined) {
            sectionIndex.selfPr = idx;
        }
        if (
            (l.includes("本人希望記入欄") || l.includes("本人希望") || l.includes("希望条件") || l.includes("備考")) &&
            sectionIndex.requests === undefined
        ) {
            sectionIndex.requests = idx;
        }
    });

    const keys: (keyof typeof sectionIndex)[] = [
        "education",
        "work",
        "licenses",
        "motivation",
        "selfPr",
        "requests",
    ];

    const result: {
        educationRaw?: string;
        workHistoryRaw?: string;
        licensesRaw?: string;
        motivation?: string;
        selfPr?: string;
        requests?: string;
    } = {};

    keys.forEach((key) => {
        const start = sectionIndex[key];
        if (start === undefined) return;

        const otherStarts = keys
            .map((k) => sectionIndex[k])
            .filter((idx): idx is number => typeof idx === "number" && idx > start);
        const end = otherStarts.length > 0 ? Math.min(...otherStarts) : lines.length;

        const bodyLines = lines
            .slice(start + 1, end)
            .filter((l) => l.trim().length > 0);
        const text = bodyLines.join("\n").trim();
        if (!text) return;

        if (key === "education") result.educationRaw = text;
        if (key === "work") result.workHistoryRaw = text;
        if (key === "licenses") result.licensesRaw = text;
        if (key === "motivation") result.motivation = text;
        if (key === "selfPr") result.selfPr = text;
        if (key === "requests") result.requests = text;
    });

    return result;
}

// ============================================
// Main Parser Function
// ============================================

export function parseApplicant(text: string): ParsedApplicant {
    console.log("[PARSE INPUT (HEAD)]", text.slice(0, 500));
    const rawText = text;

    // Use normalized lines
    const lines = normalizeImportedText(text);
    const joined = lines.join("\n");

    // 1) Email
    const emailMatch = joined.match(/[0-9A-Za-z._%+-]+@[0-9A-Za-z.-]+\.[A-Za-z]{2,}/);
    const email = emailMatch?.[0];

    // 2) Phone
    const phoneMatch = joined.match(/0\d{1,4}-?\d{1,4}-?\d{3,4}/);
    const phone = phoneMatch?.[0];

    // 3) Name (kanji)
    let name: string | undefined;
    const nameLine =
        lines.find((l) => l.match(/^(氏名|お名前|名前)[：:]/)) ??
        lines[0];

    if (nameLine) {
        const m = nameLine.match(/^(?:氏名|お名前|名前)[：:]\s*(.+)$/);
        name = (m ? m[1] : nameLine).trim();
        name = name.replace(/（.*?）/g, "").trim();
    }

    // 4) Furigana (improved extraction)
    const { nameKana, addressKana: addressKanaExtracted } = extractFurigana(lines);

    // Fallback to old method if new method doesn't find anything
    let kana = nameKana;
    if (!kana) {
        const kanaLine = lines.find((l) => l.match(/(フリガナ|ふりがな|カナ)[：:]/));
        if (kanaLine) {
            const m = kanaLine.match(/(フリガナ|ふりがな|カナ)[：:]\s*(.+)$/);
            if (m && m[2]) {
                kana = m[2].trim();
            }
        }
    }

    // 5) Birthday
    let birthday: string | undefined;
    const birthdayMatch =
        joined.match(
            /(19\d{2}|20\d{2})[\/年\.-](\d{1,2})[\/月\.-](\d{1,2})日?/
        ) ?? joined.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

    if (birthdayMatch) {
        const year = birthdayMatch[1].padStart(4, "0");
        const month = String(birthdayMatch[2]).padStart(2, "0");
        const day = String(birthdayMatch[3]).padStart(2, "0");
        birthday = `${year}-${month}-${day}`;
    }

    // 6) Postal Code (NEW)
    const postalCode = extractPostalCode(lines);

    // 7) Address (kanji & Furigana)
    let address: string | undefined;
    let addressKana: string | undefined = addressKanaExtracted;

    const addrIndex = lines.findIndex((l) => l.match(/(住所|現住所)[：:]/));
    if (addrIndex !== -1) {
        const current = lines[addrIndex].replace(/(住所|現住所)[：:]/, "").trim();
        const next = lines[addrIndex + 1] ?? "";
        address = (current + " " + next).trim();
    } else {
        const zipIndex = lines.findIndex((l) => l.match(/〒?\d{3}-\d{4}/));
        if (zipIndex !== -1) {
            address = lines.slice(zipIndex, zipIndex + 3).join(" ");
        }
    }

    // Fallback for address Furigana (old method)
    if (!addressKana) {
        const addrKanaLine = lines.find((l) =>
            l.match(/(住所フリガナ|住所（フリガナ）|住所ﾌﾘｶﾞﾅ|住所カナ)[：:]/)
        );
        if (addrKanaLine) {
            const m = addrKanaLine.match(
                /(住所フリガナ|住所（フリガナ）|住所ﾌﾘｶﾞﾅ|住所カナ)[：:]\s*(.+)$/
            );
            if (m && m[2]) {
                addressKana = m[2].trim();
            }
        }
    }

    // 8) Gender
    let gender: string | undefined;
    if (joined.includes("男性")) gender = "男性";
    if (joined.includes("女性")) gender = gender ?? "女性";

    // 9) Section extraction
    const sections = extractSections(lines);

    // 10) Education line extraction (NEW)
    const educationLines = extractEducationFromLines(lines);

    // If we found structured education lines, append them to educationRaw
    let finalEducationRaw = sections.educationRaw;
    if (educationLines.length > 0 && !sections.educationRaw) {
        finalEducationRaw = educationLines
            .map((e) => {
                const date = e.year && e.month ? `${e.year}年${e.month}月` : "";
                return `${date} ${e.schoolName} ${e.status}`.trim();
            })
            .join("\n");
    }

    return {
        name,
        kana,
        birthday,
        email,
        phone,
        address,
        postalCode,
        gender,
        addressKana,
        educationRaw: finalEducationRaw,
        workHistoryRaw: sections.workHistoryRaw,
        licensesRaw: sections.licensesRaw,
        motivation: sections.motivation,
        selfPr: sections.selfPr,
        requests: sections.requests,
        rawText,
    };
}
