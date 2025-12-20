import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ResumeData } from "@/types/resume";

type ExtractionResult =
    | { ok: true; resumeData: ResumeData; warnings?: string[]; confidence?: number }
    | { ok: false; error: string; debug?: any };

function formatPhoneForDisplay(phoneRaw: string): string {
    const digits = phoneRaw.replace(/[^\d]/g, "");
    if (digits.length === 11) return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    if (digits.length === 10) return digits.replace(/(\d{2,4})(\d{2,4})(\d{4})/, "$1-$2-$3");
    return phoneRaw;
}

function normalizeInput(text: string): string {
    if (!text) return "";
    let t = text.replace(/\r\n?/g, "\n");
    // 余計な空白行を軽く整える
    t = t.replace(/[ \t]+\n/g, "\n");
    return t;
}

function extractJsonObject(raw: string): string {
    const cleaned = raw.trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return cleaned.slice(start, end + 1);

    return cleaned;
}

function safeJsonParse<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
    try {
        const json = extractJsonObject(raw);
        const value = JSON.parse(json);
        return { ok: true, value };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? "JSON parse error" };
    }
}

function clampText(t: string, maxChars = 50000) {
    return t.length > maxChars ? t.slice(0, maxChars) : t;
}

function getGeminiModel() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: "gemini-flash-lite-latest",
    });
}

async function generateJson(model: ReturnType<typeof getGeminiModel>, prompt: string) {
    const res = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
        },
    });

    const text = res.response.text();
    return text;
}

// Helper to extract fields using regex to "lock" high-certainty data
function extractLockedFields(text: string) {
    const postalCodeMatch = text.match(/[〒]?(\d{3}-\d{4})/);
    const emailMatch = text.slice(0, 5000).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = text.match(/(0\d{1,4}-\d{1,4}-\d{3,4}|0[789]0\d{8})/);
    const birthdayMatch = text.match(/(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})[日]?/);

    let gender: "male" | "female" | "unspecified" | "" = "";
    if (text.includes("男性") || text.includes("男")) gender = "male";
    else if (text.includes("女性") || text.includes("女")) gender = "female";
    else if (text.includes("未記載") || text.includes("記載なし")) gender = "unspecified";

    return {
        postalCode: postalCodeMatch ? postalCodeMatch[1] : null,
        email: emailMatch ? emailMatch[0] : null,
        phone: phoneMatch ? phoneMatch[0].replace(/-/g, "") : null,
        birthday: birthdayMatch ? { year: birthdayMatch[1], month: birthdayMatch[2].padStart(2, '0'), day: birthdayMatch[3].padStart(2, '0') } : null,
        gender
    };
}

function hasNonEmptyArray(x: any): boolean {
    return Array.isArray(x) && x.length > 0;
}

function generateId() {
    return Math.random().toString(36).substring(2, 9);
}

export async function extractResumeDataFromText(text: string): Promise<ExtractionResult> {
    const normalized = clampText(normalizeInput(text));
    const locked = extractLockedFields(normalized);
    const model = getGeminiModel();
    const warnings: string[] = [];

    const prompt = `
あなたは世界最高の「履歴書データ抽出・正規化エンジン」です。
ユーザーが手動で作成したテキスト、求人媒体からコピー＆ペーストした情報、あるいはOCRで読み取った「非常に乱雑な生テキスト」を解析します。

目的:
入力テキストから、以下のJSON構造（ResumeData）に合致する情報を、可能な限り正確かつ漏れなく抽出してください。
情報の出所（ソース）を特定する必要はありません。文脈から意味を読み取り、構造化データに変換することに集中してください。

絶対ルール:
1. 出力はJSONのみ。余計な解説、markdownのコードフェンス(\`\`\`)は一切不要。
2. 不明な項目、テキスト中に存在しない項目は、削除せず「空文字("")」または「空配列([])」にしてください。
3. 文字の正規化: 
   - 「在籍期間：3年」などは期間だけを抜き出し、ラベルは削除。
   - 「東京都港区（〒105-0001）」のような括弧書きや郵便番号が混ざっている場合、それぞれ適切なフィールドに分離してください。
   - 「(株)」は「株式会社」に統一。
4. ふりがなの生成 (最重要):
   - 氏名(lastName, firstName)や住所(address.city等)に「ふりがな/カナ」が記載されていない場合でも、漢字の内容から推測して **必ず** \`lastNameKana\`, \`firstNameKana\`, \`address.kana\` を入力してください（全角カタカナ推奨）。
5. 重複の排除: 同じ経歴が複数回書かれている場合は、1つにまとめてください。

JSON構造と型定義:
{
  "resumeData": {
    "profile": {
      "lastName": "姓", "firstName": "名",
      "lastNameKana": "セイ", "firstNameKana": "メイ",
      "birthday": { "year": "YYYY", "month": "MM", "day": "DD" },
      "gender": "male" | "female" | "unspecified" | "",
      "phone": "09012345678 (ハイフンなし)",
      "email": "example@mail.com",
      "address": { "postalCode": "123-4567", "prefecture": "東京都", "city": "港区...", "block": "1-2-3", "building": "XXビル", "kana": "フリガナ" },
      "contactAddress": { "postalCode": "", "prefecture": "", "city": "", "block": "", "building": "", "kana": "", "phone": "", "email": "" }
    },
    "education": [
      { "schoolType": "大学/高校等", "schoolName": "XX学校", "department": "XX学科", "startDate": { "year": "YYYY", "month": "MM" }, "endDate": { "year": "YYYY", "month": "MM" }, "status": "graduated" | "expected" | "enrolled" | "dropout" | "" }
    ],
    "workHistory": [
      { 
        "companyName": "株式会社XX", 
        "startDate": { "year": "YYYY", "month": "MM" }, 
        "endDate": { "year": "YYYY", "month": "MM" }, 
        "isCurrent": false, 
        "description": "職務要約 (履歴書用)",
        "department": "所属部署",
        "position": "役職",
        "employmentType": "正社員/契約社員/派遣等",
        "businessDescription": "事業内容",
        "companyCapital": "資本金",
        "employeeCount": "従業員数",
        "responsibilities": "担当業務の詳細 (箇条書き推奨)",
        "achievements": "実績・成果",
        "environment": "使用ツール・技術スタック"
      }
    ],
    "certifications": [
      { "date": { "year": "YYYY", "month": "MM" }, "name": "資格名" }
    ],
    "selfPromotion": "自己PRテキスト",
    "motivation": "志望動機",
    "requests": "本人希望記入欄",
    "careerSummary": "全体の職務要約",
    "skillsSummary": "活かせる経験・知識・スキル",
    "careerPr": "自己PR (職務経歴書用)",
    "submissionDate": "YYYY/MM/DD",
    "photoUrl": ""
  },
  "warnings": ["解析中の懸念事項"],
  "confidence": 0.0
}

解析のヒント:
- 住所が一行の場合、「都道府県」「市区町村」「番地」「建物名」に分割してください。
- 学歴と職歴が混ざっている場合、整理してそれぞれの配列に振り分けてください。
- 職歴の「responsibilities」や「achievements」に、その会社での詳細な実績や業務内容を最大限抽出してください。

入力テキスト:
${normalized}
`.trim();

    const extractRaw = await generateJson(model, prompt);
    const extractParsed = safeJsonParse<{ resumeData: ResumeData, warnings: string[], confidence: number }>(extractRaw);

    if (!extractParsed.ok) {
        return { ok: false, error: `Extraction pass failed: ${extractParsed.error}`, debug: { raw: extractRaw } };
    }

    let data = extractParsed.value.resumeData;
    const llmWarnings = extractParsed.value.warnings || [];
    warnings.push(...llmWarnings);

    // 3. Post-Extraction Self-Correction
    // --- Correction: Postal code in city/block ---
    const addr = data.profile.address;
    if (!addr.postalCode && (addr.city || addr.block)) {
        // ... (existing regex check if any)
    }

    // --- Correction: Split prefecture from city if prefecture is empty ---
    if (!addr.prefecture && addr.city) {
        const prefMatch = addr.city.match(/^(北海道|.+?県|.+?府|東京都)(.*)$/);
        if (prefMatch) {
            addr.prefecture = prefMatch[1];
            addr.city = prefMatch[2].trim(); // Trim the remaining city part
            warnings.push(`住所の都道府県（${addr.prefecture}）を分離しました。`);
        }
    }

    const cityStr = addr.city || "";
    const blockStr = addr.block || "";
    const bldgStr = addr.building || "";

    // 1. Address Cleanup (Original logic, re-numbered)
    const addressKeys: (keyof typeof data.profile.address)[] = ['city', 'block', 'building'];
    addressKeys.forEach(key => {
        const val = data.profile.address[key];
        if (typeof val === 'string' && (val.includes('〒') || /\d{3}-\d{4}/.test(val))) {
            data.profile.address[key] = val.replace(/〒/g, '').replace(/\d{3}-\d{4}/g, '').trim();
            warnings.push(`住所の${key}欄から郵便番号を削除しました。`);
        }
    });

    // 2. Education Cleanup
    data.education?.forEach(edu => {
        const yearRegex = /20\d{2}/g;
        if (yearRegex.test(edu.schoolName)) {
            edu.schoolName = edu.schoolName.replace(yearRegex, '').trim();
            warnings.push(`学校名(${edu.schoolName})から年情報を削除しました。`);
        }
        if (yearRegex.test(edu.department)) {
            edu.department = edu.department.replace(yearRegex, '').trim();
            warnings.push(`学部学科(${edu.department})から年情報を削除しました。`);
        }
    });

    // 3. Work History Cleanup
    const labelWords = ["在籍期間", "雇用形態", "業種", "職務経歴", "最終ポジション", "役職", "社名"];
    data.workHistory?.forEach(work => {
        labelWords.forEach(word => {
            if (work.companyName.includes(word)) {
                const parts = work.companyName.split(word);
                work.companyName = parts[0].trim();
                const removedText = parts.slice(1).join(word).trim();
                work.description = (work.description + " " + word + removedText).trim();
                warnings.push(`会社名からラベル「${word}」を除去し、説明欄に移動しました。`);
            }
        });
    });

    // 4. Locked Fields Override
    if (locked.postalCode) data.profile.address.postalCode = locked.postalCode;
    if (locked.phone) data.profile.phone = formatPhoneForDisplay(locked.phone);
    if (locked.email) data.profile.email = locked.email;
    if (locked.birthday) data.profile.birthday = locked.birthday;
    if (locked.gender) data.profile.gender = locked.gender;

    // 5. ID Generation
    if (!data.education) data.education = [];
    data.education.forEach(edu => { if (!edu.id) edu.id = generateId(); });

    if (!data.workHistory) data.workHistory = [];
    data.workHistory.forEach(work => { if (!work.id) work.id = generateId(); });

    if (!data.certifications) data.certifications = [];
    data.certifications.forEach(cert => { if (!cert.id) cert.id = generateId(); });

    // Final Validation: Allow partial success (e.g. only profile)
    const hasEdu = hasNonEmptyArray(data.education);
    const hasWork = hasNonEmptyArray(data.workHistory);

    if (!hasEdu) warnings.push("学歴データが抽出できませんでした。手入力での確認をお願いします。");
    if (!hasWork) warnings.push("職歴データが抽出できませんでした。手入力での確認をお願いします。");

    // Check if we have ANY meaningful data (profile name or email or phone at least)
    const hasProfile = !!(data.profile.lastName || data.profile.email || data.profile.phone);
    if (!hasEdu && !hasWork && !hasProfile) {
        return { ok: false, error: "抽出失敗：有効なデータを読み取れませんでした。", debug: { raw: extractRaw } };
    }

    return {
        ok: true,
        resumeData: data,
        warnings: [...new Set(warnings)],
        confidence: extractParsed.value.confidence,
    };
}
