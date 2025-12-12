export interface ResumeData {
  // 基本情報
  profile: {
    lastName: string;
    firstName: string;
    lastNameKana: string;
    firstNameKana: string;
    birthday: { year: string; month: string; day: string };
    gender: "male" | "female" | "unspecified" | "";
    phone: string;
    email: string;
    address: {
      postalCode: string;
      prefecture: string;
      city: string;
      block: string;
      building: string;
      kana: string;
    };
    contactAddress: {
      postalCode: string;
      prefecture: string;
      city: string;
      block: string;
      building: string;
      kana: string;
      phone: string;
      email: string;
    };
  };
  // 学歴（複数登録可）
  education: Array<{
    id: string;
    schoolType: string; // 高校/大学など
    schoolName: string;
    department: string; // 学部・学科
    startDate: { year: string; month: string };
    endDate: { year: string; month: string };
    status: "graduated" | "dropout" | "expected" | "enrolled" | ""; // 卒業区分
  }>;
  // 職歴（複数登録可）
  workHistory: Array<{
    id: string;
    companyName: string;
    startDate: { year: string; month: string };
    endDate: { year: string; month: string };
    isCurrent: boolean; // 在職中フラグ
    description: string; // 部署・役職など（履歴書用の簡潔な説明）

    // ★ 職務経歴書用の追加フィールド ★
    department?: string;          // 所属部署（例：営業第2部）
    position?: string;            // 役職・肩書き（例：主任、チームリーダー）
    employmentType?: string;      // 雇用形態（例：正社員、契約社員）
    businessDescription?: string; // 事業内容・会社概要
    companyCapital?: string;      // 資本金（例：1,000万円）
    employeeCount?: string;       // 従業員数（例：50名）
    responsibilities?: string;    // 担当業務・職務内容（詳細）
    achievements?: string;        // 実績・成果・改善内容
    environment?: string;         // 使用ツール・技術スタック・開発環境
  }>;
  // 資格・自己PR
  certifications: Array<{
    id: string;
    date: { year: string; month: string };
    name: string;
  }>;
  selfPromotion: string; // 自己PR（AI生成対象）
  motivation: string; // 志望動機
  requests: string; // 本人希望記入欄
  // その他
  submissionDate: string; // 提出日
  photoUrl?: string; // 写真データ

  // ★ 職務経歴書専用フィールド ★
  careerSummary?: string;   // 職務要約（経歴の概要）
  skillsSummary?: string;   // 活かせる経験・知識・スキル
  careerPr?: string;        // 自己PR（職務経歴書用、履歴書のselfPromotionとは別）
}

