/**
 * En-Tenshoku Format Parser
 * Parses resume/application text from En-Tenshoku job media
 */

import type { ParsedApplicant } from "@/types/applicant";

/**
 * Detect if text is in En-Tenshoku format
 */
export function isEnTenshokuFormat(lines: string[]): boolean {
    return lines.some((line) =>
        /(応募先|面接希望日時|プロフィール|キャリアデータ|職務経歴詳細)/.test(line)
    );
}

/**
 * Parsed name structure
 */
type ParsedName = {
    lastName?: string;
    firstName?: string;
    lastNameKana?: string;
    firstNameKana?: string;
};

/**
 * Extract name from En-Tenshoku top lines
 * Line 1: Furigana (katakana)
 * Line 2: Name in kanji with gender/age info
 */
function extractNameFromEn(lines: string[]): ParsedName {
    const result: ParsedName = {};

    if (lines.length < 2) return result;

    const furiganaLine = lines[0];
    const secondLine = lines[1];

    // 1) Furigana line: typically only katakana + spaces
    if (/^[ァ-ヴー\s]+$/.test(furiganaLine)) {
        const kanaParts = furiganaLine.split(/\s+/).filter(Boolean);
        if (kanaParts.length >= 2) {
            result.lastNameKana = kanaParts[0];
            result.firstNameKana = kanaParts.slice(1).join(" ");
        } else if (kanaParts.length === 1) {
            result.lastNameKana = kanaParts[0];
        }
    }

    // 2) Name in Kanji from line 2
    // Example: "小宮山 智美 女性  23歳 離職中 神奈川県在住 配偶者：なし"
    const nameMatch = secondLine.match(/^(\S+)\s+(\S+)/);
    if (nameMatch) {
        result.lastName = nameMatch[1];
        result.firstName = nameMatch[2];
    }

    return result;
}

/**
 * Parsed birth info structure
 */
type ParsedBirth = {
    year?: string;
    month?: string;
    day?: string;
    age?: string;
    gender?: string;
};

/**
 * Extract birthdate, age, gender from profile section
 * Example: "氏名・性別・年齢 小宮山智美 23歳 女性（2002年 7月16日生）"
 */
function extractBirthFromEn(lines: string[]): ParsedBirth {
    const result: ParsedBirth = {};

    const line = lines.find((l) =>
        l.startsWith("氏名・性別・年齢")
    );
    if (!line) return result;

    // 1) Age
    const ageMatch = line.match(/(\d+)歳/);
    if (ageMatch) {
        result.age = ageMatch[1];
    }

    // 2) Gender
    const genderMatch = line.match(/(男性|女性)/);
    if (genderMatch) {
        result.gender = genderMatch[1];
    }

    // 3) Birthdate in parentheses: "（2002年 7月16日生）"
    const dateMatch = line.match(/（(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日?生/);
    if (dateMatch) {
        result.year = dateMatch[1];
        result.month = dateMatch[2];
        result.day = dateMatch[3];
    }

    return result;
}

/**
 * Parsed address structure
 */
type ParsedAddress = {
    postalCode?: string;
    prefecture?: string;
    cityAndStreet?: string;
};

/**
 * Extract address and postal code from profile section
 * Example: "現住所 〒 2450014  神奈川県 横浜市泉区中田南 5丁目29番5号 (中田駅)"
 */
function extractAddressFromEn(lines: string[]): ParsedAddress {
    const result: ParsedAddress = {};
    const line = lines.find((l) => l.startsWith("現住所"));
    if (!line) return result;

    // Remove label
    let text = line.replace(/^現住所\s*/, "").trim();

    // Postal code "〒 2450014" or "〒 245-0014"
    const postalRegex = /〒\s*(\d{3})-?(\d{4})/;
    const m = text.match(postalRegex);
    if (m) {
        result.postalCode = `${m[1]}${m[2]}`;
        text = text.replace(postalRegex, "").trim();
    }

    // Remove bracket info like "(中田駅)"
    text = text.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();

    // Now we expect something like "神奈川県 横浜市泉区中田南 5丁目29番5号"
    const parts = text.split(/\s+/);
    const prefIndex = parts.findIndex((p) => /[都道府県]$/.test(p));
    if (prefIndex >= 0) {
        result.prefecture = parts[prefIndex];
        const cityStreet = parts.slice(prefIndex + 1).join(" ");
        if (cityStreet) result.cityAndStreet = cityStreet;
    } else if (parts.length > 0) {
        // fallback
        result.prefecture = parts[0];
        result.cityAndStreet = parts.slice(1).join(" ");
    }

    return result;
}

/**
 * Parsed education structure
 */
type ParsedEducation = {
    schoolName: string;
    department?: string;
    endYear?: string;
    endMonth?: string;
    status?: string;
};

/**
 * Extract education from En-Tenshoku
 * Prefers "最終学歴" line, falls back to line after "学歴"
 * Example: "最終学歴 湘北短期大学総合ビジネス・情報学科 文理区分理系2025年（令和7年）卒業"
 */
function extractEducationFromEn(lines: string[]): ParsedEducation[] {
    const result: ParsedEducation[] = [];

    // Prefer 最終学歴 line if present
    let line = lines.find((l) => l.startsWith("最終学歴"));
    if (!line) {
        // fall back to line right after "学歴"
        const idx = lines.findIndex((l) => l === "学歴");
        if (idx !== -1 && idx + 1 < lines.length) {
            line = lines[idx + 1];
        }
    }
    if (!line) return result;

    // Remove label "最終学歴"
    line = line.replace(/^最終学歴\s*/, "").trim();

    // Extract graduation year, e.g. "2025年（令和7年）卒業"
    const yearMatch = line.match(/(\d{4})年/);
    if (!yearMatch) return result;
    const endYear = yearMatch[1];

    // Try to extract status (e.g. 卒業)
    const statusMatch = line.match(/卒業|修了|中退/);
    const status = statusMatch ? statusMatch[0] : "卒業";

    // Remove date + status from line to isolate school + department
    line = line.replace(/(\d{4})年（[^）]*）?(卒業|修了|中退)?/, "").trim();

    // Example after cleaning: "湘北短期大学総合ビジネス・情報学科 文理区分理系"
    const schoolMatch = line.match(/(.+?(高等学校|高校|大学|短期大学|専門学校))(.*)/);
    if (!schoolMatch) return result;

    const schoolName = schoolMatch[1].trim(); // 湘北短期大学
    let rest = schoolMatch[3].trim();         // 総合ビジネス・情報学科 文理区分理系

    let department: string | undefined;
    const deptMatch = rest.match(/(.+?学科|.+?学部|.+?コース)/);
    if (deptMatch) {
        department = deptMatch[1].trim();
    }

    result.push({
        schoolName,
        department,
        endYear,
        status,
    });

    return result;
}

/**
 * Extract a section by label
 * Returns text between label and next known section label
 */
function extractSection(
    lines: string[],
    label: string,
    nextLabels: string[]
): string | undefined {
    const idx = lines.findIndex((line) => line.startsWith(label));
    if (idx === -1) return undefined;

    const bodyLines: string[] = [];
    for (let i = idx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (nextLabels.some((l) => line.startsWith(l))) break;
        bodyLines.push(line);
    }

    if (bodyLines.length === 0) return undefined;
    return bodyLines.join("\n");
}

/**
 * Main En-Tenshoku parser
 * Populates ParsedApplicant with extracted data
 */
export function parseEnTenshoku(
    lines: string[],
    rawText: string
): Partial<ParsedApplicant> {
    const result: Partial<ParsedApplicant> = {
        rawText,
    };

    // 1) Extract name and furigana from top 2 lines
    const name = extractNameFromEn(lines);
    if (name.lastName) result.name = `${name.lastName} ${name.firstName || ""}`.trim();
    if (name.lastNameKana && name.firstNameKana) {
        result.kana = `${name.lastNameKana} ${name.firstNameKana}`;
    } else if (name.lastNameKana) {
        result.kana = name.lastNameKana;
    }

    // 2) Extract birthdate, age, gender from profile section
    const birth = extractBirthFromEn(lines);
    if (birth.year && birth.month && birth.day) {
        const year = birth.year.padStart(4, "0");
        const month = birth.month.padStart(2, "0");
        const day = birth.day.padStart(2, "0");
        result.birthday = `${year}-${month}-${day}`;
    }
    if (birth.gender) result.gender = birth.gender;

    // 3) Extract address and postal code
    const addr = extractAddressFromEn(lines);
    if (addr.postalCode) result.postalCode = addr.postalCode;

    // Combine prefecture and city for address field
    if (addr.prefecture || addr.cityAndStreet) {
        const parts = [];
        if (addr.prefecture) parts.push(addr.prefecture);
        if (addr.cityAndStreet) parts.push(addr.cityAndStreet);
        result.address = parts.join(" ");
    }

    // 4) Extract education
    const eduList = extractEducationFromEn(lines);
    if (eduList.length > 0) {
        const edu = eduList[0]; // Use first/latest education
        const parts = [edu.schoolName];
        if (edu.department) parts.push(edu.department);
        if (edu.endYear) parts.push(`${edu.endYear}年${edu.status || "卒業"}`);
        result.educationRaw = parts.join(" ");
    }

    // 5) Extract Self PR
    const nextLabels = [
        "希望条件",
        "希望職種",
        "希望勤務地",
        "語学スキル",
        "保有資格",
        "職務経歴",
    ];
    const selfPr = extractSection(lines, "自己PR", nextLabels);
    if (selfPr) {
        result.selfPr = selfPr;
    }

    return result;
}
