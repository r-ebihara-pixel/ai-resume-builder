/**
 * Woman-type (女の転職type) Format Parser
 * Parses resume/application text from 女の転職 job media
 */

import type { ParsedApplicant } from "@/types/applicant";

/**
 * Detect if text is in Woman-type format
 */
export function isWomanTypeFormat(lines: string[]): boolean {
    return (
        lines.some((line) => line.startsWith("フリガナ")) &&
        lines.some((line) => line.includes("職務経歴（概略）"))
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
 * Extract name and furigana from Woman-type format
 * Example:
 *   フリガナ  ナカヤマ ミオ
 *   氏名  中山 美生
 */
function extractNameFromWomanType(lines: string[]): ParsedName {
    const result: ParsedName = {};

    const furiganaLine = lines.find((l) => l.startsWith("フリガナ"));
    const nameLine = lines.find((l) => l.startsWith("氏名"));

    if (furiganaLine) {
        // Remove label "フリガナ"
        const text = furiganaLine.replace(/^フリガナ\s*/, "").trim();
        const parts = text.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            result.lastNameKana = parts[0];
            result.firstNameKana = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
            result.lastNameKana = parts[0];
        }
    }

    if (nameLine) {
        const text = nameLine.replace(/^氏名\s*/, "").trim();
        const parts = text.split(/\s+/).filter(Boolean);
        if (parts.length >= 2) {
            result.lastName = parts[0];
            result.firstName = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
            result.lastName = parts[0];
        }
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
 * Extract birthdate, age, gender from Woman-type format
 * Example: "生年月日  1999年06月12日 (満26歳) 性別  女性"
 */
function extractBirthFromWomanType(lines: string[]): ParsedBirth {
    const result: ParsedBirth = {};
    const line = lines.find((l) => l.startsWith("生年月日"));
    if (!line) return result;

    // Remove label
    let text = line.replace(/^生年月日\s*/, "").trim();

    // Date: yyyy年mm月dd日
    const dateMatch = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
    if (dateMatch) {
        result.year = dateMatch[1];
        result.month = dateMatch[2];
        result.day = dateMatch[3];
    }

    // Age: (満26歳)
    const ageMatch = text.match(/満(\d+)歳/);
    if (ageMatch) {
        result.age = ageMatch[1];
    }

    // Gender: after "性別"
    const genderMatch = text.match(/性別\s+(\S+)/);
    if (genderMatch) {
        result.gender = genderMatch[1];
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
 * Extract address and postal code from Woman-type format
 * Example:
 *   現住所  〒6740062
 *   兵庫県明石市大久保町谷八木1311101
 */
function extractAddressFromWomanType(lines: string[]): ParsedAddress {
    const result: ParsedAddress = {};

    const idx = lines.findIndex((l) => l.startsWith("現住所"));
    if (idx === -1) return result;

    // Look at current line (after label) and next 2 lines
    const following = [
        lines[idx].replace(/^現住所\s*/, "").trim(),
        lines[idx + 1],
        lines[idx + 2],
    ].filter(Boolean);

    const postalRegex = /〒\s*(\d{3})-?(\d{4})/;

    let addressLine: string | undefined;

    for (const line of following) {
        const m = line.match(postalRegex);
        if (m) {
            result.postalCode = `${m[1]}${m[2]}`;
            // If there is text after postal code on the same line, treat it as address
            const after = line.replace(postalRegex, "").trim();
            if (after) {
                addressLine = after;
            }
            continue;
        }

        // If no postal code but line is non-empty, it's probably the address line.
        if (!postalRegex.test(line) && !addressLine && line.length > 0) {
            addressLine = line.trim();
        }
    }

    if (addressLine) {
        const parts = addressLine.split(/\s+/);
        const prefIndex = parts.findIndex((p) => /[都道府県]$/.test(p));
        if (prefIndex >= 0) {
            result.prefecture = parts[prefIndex];
            const cityStreet = parts.slice(prefIndex + 1).join(" ");
            if (cityStreet) result.cityAndStreet = cityStreet;
        } else if (parts.length > 0) {
            result.prefecture = parts[0];
            result.cityAndStreet = parts.slice(1).join(" ");
        }
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
 * Extract education from Woman-type format
 * Example: "2021年03月  神戸医療福祉大学 健康スポーツコミュニケーション学会 卒業 (最終学歴:大学卒業)"
 */
function extractEducationFromWomanType(lines: string[]): ParsedEducation[] {
    const result: ParsedEducation[] = [];

    const idx = lines.findIndex((l) => l === "学歴");
    if (idx === -1) return result;

    // Read lines until "職務経歴（概略）" or empty
    for (let i = idx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("職務経歴（概略）")) break;
        if (!line) continue;

        // Look for yyyy年mm月
        const dateMatch = line.match(/(\d{4})年(\d{1,2})月/);
        if (!dateMatch) continue;

        const endYear = dateMatch[1];
        const endMonth = dateMatch[2];

        let text = line.replace(/(\d{4})年(\d{1,2})月/, "").trim();

        // Extract status (卒業, 中退, 修了, etc.)
        let status: string | undefined;
        const statusMatch = text.match(/(卒業|修了|中退)/);
        if (statusMatch) {
            status = statusMatch[1];
            text = text.replace(statusMatch[1], "").trim();
        }

        // Remove "(最終学歴:大学卒業)" or similar
        text = text.replace(/（[^）]*）/g, "").trim();

        // Now try to split into "schoolName" + "department"
        // Example: "神戸医療福祉大学 健康スポーツコミュニケーション学会"
        const schoolMatch = text.match(
            /(.+?(高等学校|高校|大学|短期大学|専門学校))\s*(.*)/
        );
        if (!schoolMatch) continue;

        const schoolName = schoolMatch[1].trim();
        const rest = schoolMatch[3].trim();
        const department = rest || undefined;

        result.push({
            schoolName,
            department,
            endYear,
            endMonth,
            status: status ?? "卒業",
        });
    }

    return result;
}

/**
 * Parsed work history structure
 */
type ParsedWork = {
    startYear?: string;
    startMonth?: string;
    endYear?: string;
    endMonth?: string;
    isCurrent?: boolean;
    companyName: string;
};

/**
 * Extract work history from Woman-type format
 * Example: "2024年11月～現在就業中  ファクトリージャパングループ"
 */
function extractWorkHistoryFromWomanType(lines: string[]): ParsedWork[] {
    const result: ParsedWork[] = [];

    const idx = lines.findIndex((l) => l.includes("職務経歴（概略）"));
    if (idx === -1) return result;

    for (let i = idx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line === "以上") break;

        // Example: "2024年11月～現在就業中  ファクトリージャパングループ"
        const match = line.match(
            /(\d{4})年(\d{1,2})月～(?:\s*(現在就業中)|\s*(\d{4})年(\d{1,2})月)\s+(.*)/
        );
        if (!match) continue;

        const startYear = match[1];
        const startMonth = match[2];
        const isCurrent = !!match[3];
        const endYear = match[4];
        const endMonth = match[5];
        const companyName = (match[6] || "").trim();

        result.push({
            startYear,
            startMonth,
            endYear,
            endMonth,
            isCurrent,
            companyName,
        });
    }

    return result;
}

/**
 * Main Woman-type parser
 * Populates ParsedApplicant with extracted data
 */
export function parseWomanType(
    lines: string[],
    rawText: string
): Partial<ParsedApplicant> {
    const result: Partial<ParsedApplicant> = {
        rawText,
    };

    // 1) Extract name and furigana
    const name = extractNameFromWomanType(lines);
    if (name.lastName) result.name = `${name.lastName} ${name.firstName || ""}`.trim();
    if (name.lastNameKana && name.firstNameKana) {
        result.kana = `${name.lastNameKana} ${name.firstNameKana}`;
    } else if (name.lastNameKana) {
        result.kana = name.lastNameKana;
    }

    // 2) Extract birthdate, age, gender
    const birth = extractBirthFromWomanType(lines);
    if (birth.year && birth.month && birth.day) {
        const year = birth.year.padStart(4, "0");
        const month = birth.month.padStart(2, "0");
        const day = birth.day.padStart(2, "0");
        result.birthday = `${year}-${month}-${day}`;
    }
    if (birth.gender) result.gender = birth.gender;

    // 3) Extract address and postal code
    const addr = extractAddressFromWomanType(lines);
    if (addr.postalCode) result.postalCode = addr.postalCode;

    // Combine prefecture and city for address field
    if (addr.prefecture || addr.cityAndStreet) {
        const parts = [];
        if (addr.prefecture) parts.push(addr.prefecture);
        if (addr.cityAndStreet) parts.push(addr.cityAndStreet);
        result.address = parts.join(" ");
    }

    // 4) Extract education
    const eduList = extractEducationFromWomanType(lines);
    if (eduList.length > 0) {
        // Combine all education entries into educationRaw
        const eduTexts = eduList.map(edu => {
            const parts = [];
            if (edu.endYear && edu.endMonth) parts.push(`${edu.endYear}年${edu.endMonth}月`);
            parts.push(edu.schoolName);
            if (edu.department) parts.push(edu.department);
            if (edu.status) parts.push(edu.status);
            return parts.join(" ");
        });
        result.educationRaw = eduTexts.join("\n");
    }

    // 5) Extract work history
    const workList = extractWorkHistoryFromWomanType(lines);
    if (workList.length > 0) {
        // Combine work history into workHistoryRaw
        const workTexts = workList.map(work => {
            const parts = [];
            if (work.startYear && work.startMonth) {
                const start = `${work.startYear}年${work.startMonth}月`;
                const end = work.isCurrent
                    ? "現在"
                    : work.endYear && work.endMonth
                        ? `${work.endYear}年${work.endMonth}月`
                        : "";
                parts.push(`${start}～${end}`);
            }
            parts.push(work.companyName);
            return parts.join(" ");
        });
        result.workHistoryRaw = workTexts.join("\n");
    }

    return result;
}
