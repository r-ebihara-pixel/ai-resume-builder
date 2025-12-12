export type ParsedApplicant = {
    // 基本情報
    name?: string;        // 氏名（漢字）
    kana?: string;        // 氏名フリガナ
    birthday?: string;
    age?: string;         // 年齢
    gender?: string;
    email?: string;
    phone?: string;
    address?: string;     // 住所（漢字）
    postalCode?: string;  // 郵便番号
    addressKana?: string; // 住所フリガナ

    // 学歴・職歴・資格（テキストで丸ごと or 構造化もOK）
    educationRaw?: string;
    workHistoryRaw?: string;
    licensesRaw?: string;

    // 志望動機・自己PR・本人希望
    motivation?: string;
    selfPr?: string;
    requests?: string;

    rawText: string;      // 元テキスト（DOM版でも空文字でOK）
};
