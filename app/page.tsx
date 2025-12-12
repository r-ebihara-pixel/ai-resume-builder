"use client";

import { useState, useRef, useEffect } from "react";
import { JOB_TEMPLATES, JobType } from "@/lib/data/jobTemplates";
import { generateText, UserInput } from "@/lib/generator";
import { Calendar, User, FileText, Wand2, Download, Copy, Loader2, Plus, Trash2, Search, BookOpen, MessageSquare } from "lucide-react";
import Link from "next/link";
import { ResumePreview } from "@/components/ResumePreview";
import { CareerSheetPreview } from "@/components/CareerSheetPreview";
import GraduationTableModal from "@/components/GraduationTableModal";
import { ResumeData } from "@/types/resume";
import { normalizeText, limitTextLength, MOTIVATION_MAX_LENGTH, REQUESTS_MAX_LENGTH, toHalfWidth } from "@/lib/textUtils";
import { RecommendationPreview } from "@/components/RecommendationPreview";

type PostalAddress = {
  prefecture: string;
  city: string;
  town: string;
  prefectureKana: string;
  cityKana: string;
  townKana: string;
};

async function fetchAddressByPostalCode(
  postalCode: string
): Promise<PostalAddress | null> {
  const normalized = postalCode.replace(/[^\d]/g, "");

  if (!normalized || normalized.length < 7) {
    alert("正しい7桁の郵便番号を入力してください");
    return null;
  }

  const res = await fetch(
    `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${normalized}`
  );

  if (!res.ok) {
    console.error("郵便番号APIの呼び出しに失敗しました");
    return null;
  }

  const data = await res.json();

  if (data.status !== 200 || !data.results || data.results.length === 0) {
    return null;
  }

  const r = data.results[0];

  const result: PostalAddress = {
    prefecture: r.address1 ?? "",
    city: (r.address2 ?? "") + (r.address3 ?? ""),
    town: "",
    prefectureKana: r.kana1 ?? "",
    cityKana: (r.kana2 ?? "") + (r.kana3 ?? ""),
    townKana: "",
  };

  return result;
}

function calculateAge(birthdateStr: string): number {
  if (!birthdateStr) return 0;

  const [yearStr, monthStr, dayStr] = birthdateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!year || !month || !day) return 0;

  const today = new Date();
  const birthDate = new Date(year, month - 1, day); // 月は0始まり

  let age = today.getFullYear() - birthDate.getFullYear();
  const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);

  // まだ今年の誕生日が来ていなければ -1
  if (today < thisYearBirthday) {
    age -= 1;
  }

  // マイナスにならないようガード
  return age < 0 ? 0 : age;
}

type Tab =
  | "basic"
  | "history"
  | "ai"
  | "career"
  | "recommendation"
  | "preview";

const initialResumeData: ResumeData = {
  profile: {
    lastName: "", firstName: "",
    lastNameKana: "", firstNameKana: "",
    birthday: { year: "", month: "", day: "" },
    gender: "",
    phone: "",
    email: "",
    address: { postalCode: "", prefecture: "", city: "", block: "", building: "", kana: "" },
    contactAddress: { postalCode: "", prefecture: "", city: "", block: "", building: "", kana: "", phone: "", email: "" },
  },
  education: [],
  workHistory: [],
  certifications: [],
  selfPromotion: "",
  motivation: "",
  requests: "",
  submissionDate: new Date().toISOString().split('T')[0].replace(/-/g, '/'),
  photoUrl: "",
};

type RecommendationInput = {
  targetCompany: string;
  targetPosition: string;
  summary: string;      // Agent's overall comment
  strengths: string;    // Strong points the agent wants to emphasize
  concerns: string;     // Risks / points to be aware of
  matchReason: string;  // Why this candidate matches this company/position
};

export default function ResumeBuilder() {
  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [previewMode, setPreviewMode] = useState<"resume" | "career" | "recommendation">("resume");
  const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData);
  const [isGraduationTableOpen, setIsGraduationTableOpen] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const recommendationPreviewRef = useRef<HTMLDivElement | null>(null);

  // AI Generator State
  const [selectedJob, setSelectedJob] = useState<JobType | "">("");
  const [input, setInput] = useState<UserInput>({});
  const [recommendationInput, setRecommendationInput] =
    useState<RecommendationInput>({
      targetCompany: "",
      targetPosition: "",
      summary: "",
      strengths: "",
      concerns: "",
      matchReason: "",
    });

  // Import Data Effect
  useEffect(() => {
    const loadImportedData = () => {
      const storedData = localStorage.getItem("latestApplicant");
      if (!storedData) return;

      try {
        const parsed = JSON.parse(storedData);
        console.log("[RESUME] loaded latestApplicant:", parsed);
        // 一度取り込んだら削除（リロードで何度も上書きしないように）
        localStorage.removeItem("latestApplicant");

        setResumeData((prev) => {
          const newProfile = { ...prev.profile };
          let hasProfileChanges = false;

          // --- 氏名 ---
          if (parsed.name && !prev.profile.lastName && !prev.profile.firstName) {
            const parts = parsed.name.split(/[\s　]+/);
            if (parts.length >= 2) {
              newProfile.lastName = parts[0];
              newProfile.firstName = parts.slice(1).join("");
            } else {
              newProfile.lastName = parsed.name;
            }
            hasProfileChanges = true;
          }

          // --- フリガナ（氏名） ---
          if (parsed.kana && !prev.profile.lastNameKana && !prev.profile.firstNameKana) {
            const parts = parsed.kana.split(/[\s　]+/);
            if (parts.length >= 2) {
              newProfile.lastNameKana = parts[0];
              newProfile.firstNameKana = parts.slice(1).join("");
            } else {
              newProfile.lastNameKana = parsed.kana;
            }
            hasProfileChanges = true;
          }

          // --- メール ---
          if (parsed.email && !prev.profile.email) {
            newProfile.email = parsed.email;
            hasProfileChanges = true;
          }

          // --- 電話 ---
          if (parsed.phone && !prev.profile.phone) {
            newProfile.phone = parsed.phone;
            hasProfileChanges = true;
          }

          // --- 生年月日 ---
          if (parsed.birthday) {
            const [y, m, d] = parsed.birthday.split("-");
            if (y && m && d) {
              newProfile.birthday = {
                year: y,
                month: String(parseInt(m, 10)),
                day: String(parseInt(d, 10)),
              };
              hasProfileChanges = true;
            }
          }

          // --- 性別 ---
          if (parsed.gender) {
            if (parsed.gender.includes("男性")) newProfile.gender = "male";
            else if (parsed.gender.includes("女性")) newProfile.gender = "female";
            hasProfileChanges = true;
          }

          // --- 住所（漢字） ---
          if (parsed.address && !prev.profile.address.prefecture && !prev.profile.address.city) {
            const prefMatch = parsed.address.match(/(北海道|.+?県|.+?府|東京都)/);
            if (prefMatch) {
              newProfile.address.prefecture = prefMatch[0];
              newProfile.address.city = parsed.address.replace(prefMatch[0], "").trim();
            } else {
              newProfile.address.city = parsed.address;
            }
            hasProfileChanges = true;
          }

          // --- 住所フリガナ ---
          if (parsed.addressKana && !prev.profile.address.kana) {
            newProfile.address.kana = parsed.addressKana;
            hasProfileChanges = true;
          }

          // --- 郵便番号 ---
          if (parsed.postalCode && !prev.profile.address.postalCode) {
            newProfile.address.postalCode = parsed.postalCode;
            hasProfileChanges = true;
          }

          // =========================
          // ここから profile 以外の項目
          // =========================

          // --- 学歴（educationRaw を 1レコードとして突っ込む簡易版） ---
          let newEducation = prev.education;
          if (parsed.educationRaw && prev.education.length === 0) {
            newEducation = [
              {
                id: crypto.randomUUID(),
                schoolType: "その他",
                schoolName: parsed.educationRaw, // まずは生テキストをそのまま
                department: "",
                startDate: { year: "", month: "" },
                endDate: { year: "", month: "" },
                status: "graduated",
              },
            ];
          }

          // --- 職歴（workHistoryRaw を description に入れる簡易版） ---
          let newWorkHistory = prev.workHistory;
          if (parsed.workHistoryRaw && prev.workHistory.length === 0) {
            newWorkHistory = [
              {
                id: crypto.randomUUID(),
                companyName: "",
                startDate: { year: "", month: "" },
                endDate: { year: "", month: "" },
                isCurrent: false,
                description: parsed.workHistoryRaw, // 生テキストを説明欄に
              },
            ];
          }

          // --- 免許・資格（licensesRaw を 1件にまとめて入れる簡易版） ---
          let newCerts = prev.certifications;
          if (parsed.licensesRaw && prev.certifications.length === 0) {
            newCerts = [
              {
                id: crypto.randomUUID(),
                date: { year: "", month: "" },
                name: parsed.licensesRaw,
              },
            ];
          }

          // --- 志望動機 / 自己PR / 本人希望 ---
          const newMotivation =
            !prev.motivation && parsed.motivation
              ? parsed.motivation
              : prev.motivation;

          const newSelfPromotion =
            !prev.selfPromotion && parsed.selfPr
              ? parsed.selfPr
              : prev.selfPromotion;

          const newRequests =
            !prev.requests && parsed.requests
              ? parsed.requests
              : prev.requests;

          // 何も変わらないなら、そのまま prev を返す
          const nothingChanged =
            !hasProfileChanges &&
            newEducation === prev.education &&
            newWorkHistory === prev.workHistory &&
            newCerts === prev.certifications &&
            newMotivation === prev.motivation &&
            newSelfPromotion === prev.selfPromotion &&
            newRequests === prev.requests;

          if (nothingChanged) return prev;

          return {
            ...prev,
            profile: newProfile,
            education: newEducation,
            workHistory: newWorkHistory,
            certifications: newCerts,
            motivation: newMotivation,
            selfPromotion: newSelfPromotion,
            requests: newRequests,
          };
        });
      } catch (e) {
        console.error("Failed to load imported data", e);
      }
    };

    loadImportedData();
  }, []);

  // --- Handlers ---

  const handleProfileChange = (field: keyof ResumeData["profile"], value: string) => {
    let newValue = value;
    if (field === 'phone') {
      newValue = toHalfWidth(value);
    }
    setResumeData(prev => ({ ...prev, profile: { ...prev.profile, [field]: newValue } }));
  };

  const handleBirthdayChange = (field: keyof ResumeData["profile"]["birthday"], value: string) => {
    setResumeData(prev => ({
      ...prev,
      profile: { ...prev.profile, birthday: { ...prev.profile.birthday, [field]: value } }
    }));
  };

  const handleAddressChange = (field: keyof ResumeData["profile"]["address"], value: string) => {
    let newValue = value;
    if (field === 'postalCode') {
      newValue = toHalfWidth(value);
    }
    setResumeData(prev => ({
      ...prev,
      profile: { ...prev.profile, address: { ...prev.profile.address, [field]: newValue } }
    }));
  };

  const handleContactAddressChange = (field: keyof ResumeData["profile"]["contactAddress"], value: string) => {
    let newValue = value;
    if (field === 'postalCode' || field === 'phone') {
      newValue = toHalfWidth(value);
    }
    setResumeData(prev => ({
      ...prev,
      profile: { ...prev.profile, contactAddress: { ...prev.profile.contactAddress, [field]: newValue } }
    }));
  };

  // Education Handlers
  const addEducation = () => {
    setResumeData(prev => ({
      ...prev,
      education: [...prev.education, {
        id: crypto.randomUUID(),
        schoolType: "大学",
        schoolName: "",
        department: "",
        startDate: { year: "", month: "" },
        endDate: { year: "", month: "" },
        status: "graduated"
      }]
    }));
  };

  const removeEducation = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }));
  };

  const handleEducationChange = (index: number, field: string, value: any) => {
    let newValue = value;
    if (typeof value === 'string' && (field.includes('year') || field.includes('month'))) {
      newValue = toHalfWidth(value);
    }
    setResumeData(prev => {
      const newEdu = [...prev.education];
      if (field.includes(".")) {
        const [parent, child] = field.split(".");
        // @ts-ignore
        newEdu[index][parent] = { ...newEdu[index][parent], [child]: newValue };
      } else {
        // @ts-ignore
        newEdu[index][field] = newValue;
      }
      return { ...prev, education: newEdu };
    });
  };

  // Work History Handlers
  const addWork = () => {
    setResumeData(prev => ({
      ...prev,
      workHistory: [...prev.workHistory, {
        id: crypto.randomUUID(),
        companyName: "",
        startDate: { year: "", month: "" },
        endDate: { year: "", month: "" },
        isCurrent: false,
        description: "",
        department: "",
        position: "",
        employmentType: "",
        businessDescription: "",
        companyCapital: "",
        employeeCount: "",
        responsibilities: "",
        achievements: "",
        environment: "",
      }]
    }));
  };

  const removeWork = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      workHistory: prev.workHistory.filter((_, i) => i !== index)
    }));
  };

  const handleWorkChange = (index: number, field: string, value: any) => {
    let newValue = value;
    if (typeof value === 'string' && (field.includes('year') || field.includes('month'))) {
      newValue = toHalfWidth(value);
    }
    setResumeData(prev => {
      const newWork = [...prev.workHistory];
      if (field.includes(".")) {
        const [parent, child] = field.split(".");
        // @ts-ignore
        newWork[index][parent] = { ...newWork[index][parent], [child]: newValue };
      } else {
        // @ts-ignore
        newWork[index][field] = newValue;
      }
      return { ...prev, workHistory: newWork };
    });
  };

  // Certifications Handlers
  const addCert = () => {
    setResumeData(prev => ({
      ...prev,
      certifications: [...prev.certifications, {
        id: crypto.randomUUID(),
        date: { year: "", month: "" },
        name: ""
      }]
    }));
  };

  const removeCert = (index: number) => {
    setResumeData(prev => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index)
    }));
  };

  const handleCertChange = (index: number, field: string, value: any) => {
    let newValue = value;
    if (typeof value === 'string' && (field.includes('year') || field.includes('month'))) {
      newValue = toHalfWidth(value);
    }
    setResumeData(prev => {
      const newCert = [...prev.certifications];
      if (field.includes(".")) {
        const [parent, child] = field.split(".");
        // @ts-ignore
        newCert[index][parent] = { ...newCert[index][parent], [child]: newValue };
      } else {
        // @ts-ignore
        newCert[index][field] = newValue;
      }
      return { ...prev, certifications: newCert };
    });
  };

  // AI Handlers
  const handleAiInputChange = (key: keyof UserInput, value: string) => {
    setInput((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = () => {
    if (!selectedJob) return;
    const template = JOB_TEMPLATES[selectedJob];

    const rawMotivation = generateText(template.motivation, input);
    const rawSelfPr = generateText(template.selfPr, input);

    const motivation = limitTextLength(
      normalizeText(rawMotivation),
      MOTIVATION_MAX_LENGTH
    );
    const selfPr = normalizeText(rawSelfPr); // 必要なら limitTextLength を追加

    setResumeData(prev => ({
      ...prev,
      motivation,
      selfPromotion: selfPr,
    }));

    alert("文章を生成し、履歴書データに反映しました！");
  };


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("コピーしました");
    }).catch(err => {
      console.error("コピーに失敗しました", err);
    });
  };

  const buildCareerText = (data: ResumeData): string => {
    const lines: string[] = [];

    // Helper: safely format YYYY/MM → "YYYY年MM月" or placeholder
    const formatYearMonth = (
      date?: { year?: string; month?: string },
      placeholder = "----年--月"
    ): string => {
      const y = date?.year?.trim();
      const m = date?.month?.trim();

      if (!y && !m) return placeholder;

      const year = y && y.length > 0 ? y : "----";
      const month = m && m.length > 0 ? m : "--";

      return `${year}年${month}月`;
    };

    // ====== タイトル ======
    lines.push("職務経歴書", "");

    // ====== 職務要約 ======
    lines.push("【職務要約】");

    const summary =
      data.careerSummary && data.careerSummary.trim().length > 0
        ? data.careerSummary.trim()
        : "これまで、複数の業務に幅広く従事してきました。";

    lines.push(summary, "");

    // ====== スキル要約（任意） ======
    if (data.skillsSummary && data.skillsSummary.trim().length > 0) {
      lines.push("【スキル要約】");
      lines.push(data.skillsSummary.trim(), "");
    }

    // ====== 自己PR（任意） ======
    if (data.careerPr && data.careerPr.trim().length > 0) {
      lines.push("【自己PR】");
      lines.push(data.careerPr.trim(), "");
    }

    // ====== 職務経歴 ======
    lines.push("【職務経歴】");

    const sortedWork = [...(data.workHistory || [])].sort((a, b) => {
      const ay = parseInt(a.startDate.year || "0", 10);
      const by = parseInt(b.startDate.year || "0", 10);
      if (ay !== by) return ay - by;

      const am = parseInt(a.startDate.month || "0", 10);
      const bm = parseInt(b.startDate.month || "0", 10);
      return am - bm;
    });

    if (sortedWork.length === 0) {
      // No work history
      lines.push("■ ----年--月 ～ ----年--月");
      lines.push("");
    } else {
      for (const work of sortedWork) {
        const startText = formatYearMonth(work.startDate);
        const endText = work.isCurrent
          ? "現在"
          : formatYearMonth(work.endDate);

        // 期間行
        lines.push(`■ ${startText} ～ ${endText}`);

        // 会社名 ＋（部署／役職）
        const companyParts: string[] = [];
        if (work.companyName && work.companyName.trim().length > 0) {
          companyParts.push(work.companyName.trim());
        }

        const deptPos: string[] = [];
        if (work.department && work.department.trim().length > 0) {
          deptPos.push(work.department.trim());
        }
        if (work.position && work.position.trim().length > 0) {
          deptPos.push(work.position.trim());
        }

        if (deptPos.length > 0) {
          companyParts.push(`（${deptPos.join("／")}）`);
        }

        if (companyParts.length > 0) {
          lines.push(companyParts.join(""));
        }

        // 事業内容
        if (work.businessDescription && work.businessDescription.trim().length > 0) {
          lines.push(`【事業内容】${work.businessDescription.trim()}`);
        }

        // 担当業務
        if (work.responsibilities && work.responsibilities.trim().length > 0) {
          lines.push(`【担当業務】${work.responsibilities.trim()}`);
        }

        // 実績・成果
        if (work.achievements && work.achievements.trim().length > 0) {
          lines.push(`【実績・成果】${work.achievements.trim()}`);
        }

        // 環境・ツール
        if (work.environment && work.environment.trim().length > 0) {
          lines.push(`【環境・ツール】${work.environment.trim()}`);
        }

        // 空行で区切る
        lines.push("");
      }
    }

    // ====== 保有資格 ======
    lines.push("【保有資格】");

    const certs = data.certifications || [];
    const hasCerts = certs.some((c) => c && c.name && c.name.trim().length > 0);

    if (!hasCerts) {
      lines.push("なし");
    } else {
      for (const cert of certs) {
        if (!cert || !cert.name || cert.name.trim().length === 0) continue;

        const ym = formatYearMonth(cert.date, "");
        const prefix = ym ? `${ym} ` : "";
        lines.push(`・${prefix}${cert.name.trim()}`);
      }
    }

    return lines.join("\n");
  };

  const buildRecommendationText = (
    data: ResumeData,
    rec: RecommendationInput
  ): string => {
    const lines: string[] = [];

    const fullName = `${data.profile?.lastName ?? ""} ${data.profile?.firstName ?? ""}`.trim();
    const birthStr = data.profile?.birthday
      ? `${data.profile.birthday.year}-${data.profile.birthday.month.padStart(2, '0')}-${data.profile.birthday.day.padStart(2, '0')}`
      : "";
    const age = birthStr ? calculateAge(birthStr) : 0;
    const ageStr = age > 0 ? String(age) : "";
    const company = rec.targetCompany || "御社";
    const position = rec.targetPosition || "募集ポジション";

    // Header
    lines.push(`${company} 採用ご担当者様`);
    lines.push("");
    lines.push("平素よりお世話になっております。");
    lines.push("人材紹介会社より、ご推薦候補者のご案内を申し上げます。");
    lines.push("");

    // Basic info
    if (fullName) {
      lines.push(`候補者名：${fullName}${ageStr ? `（${ageStr}歳）` : ""}`);
      lines.push("");
    }

    // Overall summary (agent comment)
    lines.push("【総評】");
    if (rec.summary.trim()) {
      lines.push(normalizeText(rec.summary));
    } else {
      lines.push(
        `${fullName || "本候補者"}は、これまでのご経験を通じて培った対人コミュニケーション力と、着実に物事をやり遂げる継続力を備えており、ポテンシャル・人柄ともに自信を持ってご推薦できる方です。`
      );
    }
    lines.push("");

    // Strengths
    lines.push("【特に評価しているポイント】");
    if (rec.strengths.trim()) {
      lines.push(normalizeText(rec.strengths));
    } else {
      lines.push("・周囲と連携しながら業務を進められる協調性");
      lines.push("・指示待ちではなく、自ら課題を見つけて行動できる主体性");
      lines.push("・未経験領域に対しても学習を継続できる素直さ・吸収力");
    }
    lines.push("");

    // Work history overview from resumeData
    const workHistory = data.workHistory ?? [];
    lines.push("【ご経歴の概要】");
    if (workHistory.length === 0) {
      lines.push("現在、職務経歴の登録はありませんが、ポテンシャル採用候補としてのご提案となります。");
    } else {
      workHistory.forEach((work) => {
        const startY = work.startDate?.year ?? "";
        const startM = work.startDate?.month ?? "";
        const endY = work.isCurrent ? "" : work.endDate?.year ?? "";
        const endM = work.isCurrent ? "" : work.endDate?.month ?? "";

        const startStr =
          startY || startM ? `${startY}年${startM}月` : "----年--月";
        const endStr = work.isCurrent
          ? "現在"
          : endY || endM
            ? `${endY}年${endM}月`
            : "----年--月";

        const companyName = work.companyName || "非公開企業";
        lines.push(`・${startStr} 〜 ${endStr}：${companyName}`);
        if (work.description) {
          lines.push(`　担当業務：${normalizeText(work.description)}`);
        }
      });
    }
    lines.push("");

    // Match reason
    lines.push("【貴社ポジションとのマッチ理由】");
    if (rec.matchReason.trim()) {
      lines.push(normalizeText(rec.matchReason));
    } else {
      lines.push(
        `${position}において求められる「基礎的なITリテラシー」や「周囲と協力しながら業務を遂行する姿勢」に加え、未経験領域に対しても前向きにキャッチアップしていくスタンスが、貴社の組織風土・育成スタンスと非常に親和性が高いと感じております。`
      );
    }
    lines.push("");

    // Concerns / risk points
    lines.push("【ご留意いただきたい点】");
    if (rec.concerns.trim()) {
      lines.push(normalizeText(rec.concerns));
    } else {
      lines.push(
        "現時点では実務経験が限定的な部分もございますが、その分、貴社での教育・OJTを通じて柔軟に染まっていける余地が大きいと捉えております。面接の場においては、これまでのご経験や学習状況について率直にご確認いただけますと幸いです。"
      );
    }
    lines.push("");

    // Closing
    lines.push("以上となります。");
    lines.push(
      "ぜひ一度、面接の機会を頂戴できますと幸いです。ご検討のほど、何卒よろしくお願い申し上げます。"
    );

    return lines.join("\n");
  };

  // 写真アップロード
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 画像ファイルかチェック
    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください");
      return;
    }

    // ファイルサイズチェック（5MB以下）
    if (file.size > 5 * 1024 * 1024) {
      alert("ファイルサイズは5MB以下にしてください");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setResumeData(prev => ({ ...prev, photoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  // テキスト整形（志望動機・自己PR・本人希望）

  // 志望動機
  const handleMotivationChange = (value: string) => {
    const normalized = normalizeText(value);
    const limited = limitTextLength(normalized, MOTIVATION_MAX_LENGTH);

    setResumeData((prev) => ({
      ...prev,
      motivation: limited,
    }));
  };

  // 自己PR
  const handleSelfPromotionChange = (value: string) => {
    const normalized = normalizeText(value);

    setResumeData((prev) => ({
      ...prev,
      selfPromotion: normalized,
    }));
  };

  // 本人希望欄
  const handleRequestsChange = (value: string) => {
    const normalized = normalizeText(value);
    const limited = limitTextLength(normalized, REQUESTS_MAX_LENGTH);

    setResumeData((prev) => ({
      ...prev,
      requests: limited,
    }));
  };


  // 郵便番号から住所を自動入力
  const handlePostalCodeSearch = async (target: "address" | "contactAddress") => {
    // どちらの郵便番号を使うかを決める
    const postalCode =
      target === "address"
        ? resumeData.profile.address.postalCode
        : resumeData.profile.contactAddress.postalCode;

    if (!postalCode) {
      alert("郵便番号を入力してください");
      return;
    }

    setIsLoadingAddress(true);
    try {
      const address = await fetchAddressByPostalCode(postalCode);

      if (!address) {
        alert("住所が見つかりませんでした");
        return;
      }

      if (target === "address") {
        // 現住所を更新
        setResumeData((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            address: {
              ...prev.profile.address,
              prefecture: address.prefecture,
              city: address.city + address.town,
              kana:
                address.prefectureKana +
                address.cityKana +
                address.townKana,
            },
          },
        }));
      } else {
        // 連絡先住所を更新
        setResumeData((prev) => ({
          ...prev,
          profile: {
            ...prev.profile,
            contactAddress: {
              ...prev.profile.contactAddress,
              prefecture: address.prefecture,
              city: address.city + address.town,
              kana:
                address.prefectureKana +
                address.cityKana +
                address.townKana,
            },
          },
        }));
      }
    } catch (error) {
      console.error("Address search failed", error);
      alert("住所検索に失敗しました");
    } finally {
      setIsLoadingAddress(false);
    }
  };



  const handlePrintPreviewPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handlePrintCareerPdf = async () => {
    if (typeof window === "undefined" || !printRef.current) return;

    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).jsPDF;

      // Get the career preview element
      const careerElement = printRef.current.querySelector("#career-preview-visible") as HTMLElement;
      if (!careerElement) return;

      // Generate canvas from the career preview
      const canvas = await html2canvas(careerElement, {
        useCORS: true,
        logging: false,
      });

      // Calculate dimensions for A4 PDF
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      let position = 0;
      let heightLeft = imgHeight;

      // Add first page
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        position,
        imgWidth,
        imgHeight
      );
      heightLeft -= pageHeight;

      // Add additional pages if content exceeds one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(
          canvas.toDataURL("image/png"),
          "PNG",
          0,
          position,
          imgWidth,
          imgHeight
        );
        heightLeft -= pageHeight;
      }

      pdf.save("career-sheet.pdf");
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("PDF生成に失敗しました");
    }
  };

  const handleDownloadRecommendationPdf = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).jsPDF;

      // ① ターゲット要素の ID を推薦文用に変更
      const element = document.getElementById("recommendation-preview");
      if (!element) {
        console.error("Recommendation preview element not found");
        return;
      }

      // ② html2canvas 設定は career-sheet と完全同じで OK
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      if (canvas.width === 0 || canvas.height === 0) {
        console.error("Canvas width/height is 0. Is the recommendation preview visible?");
        return;
      }

      const imgData = canvas.toDataURL("image/jpeg", 1.0);
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = 210;
      const pageHeight = 297;

      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        pdf.addPage();
        position = heightLeft - imgHeight;
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      // ③ ファイル名だけ推薦文用に変更
      pdf.save("recommendation.pdf");
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("PDF生成に失敗しました");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">AI履歴書ビルダー Pro</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/import" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
              <Download size={16} />
              応募データ取り込み
            </Link>
            <Link href="/pdf-import" className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
              <Download size={16} />
              PDFから取り込み
            </Link>
            <div className="text-sm text-gray-500">
              作成日: {resumeData.submissionDate}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-lg overflow-hidden shadow-sm">
          {[
            { id: "basic", label: "基本情報", icon: User },
            { id: "history", label: "学歴・職歴", icon: Calendar },
            { id: "ai", label: "AI作成", icon: Wand2 },
            { id: "career", label: "職務経歴書", icon: BookOpen },
            { id: "recommendation", label: "推薦文", icon: MessageSquare },
            { id: "preview", label: "プレビュー", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex-1 py-4 px-2 md:px-6 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === tab.id
                ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
            >
              <tab.icon size={18} />
              <span className="hidden md:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-b-lg shadow-lg p-6 min-h-[600px]">

          {/* --- Basic Info Tab --- */}
          {activeTab === "basic" && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">作成日</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    記入日
                  </label>
                  <input
                    type="date"
                    value={resumeData.submissionDate.replace(/年/g, '-').replace(/月/g, '-').replace(/日/g, '').replace(/\//g, '-')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setResumeData(prev => ({ ...prev, submissionDate: "" }));
                        return;
                      }
                      const [y, m, d] = val.split('-');
                      setResumeData(prev => ({ ...prev, submissionDate: `${y}年${parseInt(m)}月${parseInt(d)}日` }));
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">氏名・連絡先</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        氏名 (姓) <span className="text-red-500 text-xs ml-1">必須</span>
                      </label>
                      <input type="text" value={resumeData.profile.lastName} onChange={(e) => handleProfileChange("lastName", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="例: 転職" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        氏名 (名) <span className="text-red-500 text-xs ml-1">必須</span>
                      </label>
                      <input type="text" value={resumeData.profile.firstName} onChange={(e) => handleProfileChange("firstName", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="例: 太郎" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        フリガナ (セイ) <span className="text-red-500 text-xs ml-1">必須</span>
                      </label>
                      <input type="text" value={resumeData.profile.lastNameKana} onChange={(e) => handleProfileChange("lastNameKana", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="例: テンショク" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        フリガナ (メイ) <span className="text-red-500 text-xs ml-1">必須</span>
                      </label>
                      <input type="text" value={resumeData.profile.firstNameKana} onChange={(e) => handleProfileChange("firstNameKana", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="例: タロウ" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      生年月日 <span className="text-red-500 text-xs ml-1">必須</span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={resumeData.profile.birthday.year}
                        onChange={(e) => handleBirthdayChange("year", e.target.value)}
                        className="w-24 p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">年</option>
                        {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <span className="self-center">年</span>
                      <select
                        value={resumeData.profile.birthday.month}
                        onChange={(e) => handleBirthdayChange("month", e.target.value)}
                        className="w-20 p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">月</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <option key={month} value={month}>{month}</option>
                        ))}
                      </select>
                      <span className="self-center">月</span>
                      <select
                        value={resumeData.profile.birthday.day}
                        onChange={(e) => handleBirthdayChange("day", e.target.value)}
                        className="w-20 p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">日</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      <span className="self-center">日</span>
                      {resumeData.profile.birthday.year && resumeData.profile.birthday.month && resumeData.profile.birthday.day && (
                        <span className="self-center text-sm text-gray-600 ml-2">
                          （満 {calculateAge(`${resumeData.profile.birthday.year}-${resumeData.profile.birthday.month.padStart(2, '0')}-${resumeData.profile.birthday.day.padStart(2, '0')}`)} 歳）
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGraduationTableOpen(true)}
                      className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <BookOpen size={16} />
                      卒業年月早見表を見る
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">性別</label>
                      <select value={resumeData.profile.gender} onChange={(e) => handleProfileChange("gender", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">選択してください</option>
                        <option value="male">男性</option>
                        <option value="female">女性</option>
                        <option value="unspecified">記載しない</option>
                      </select>
                    </div>


                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        証明写真 <span className="text-xs text-gray-500">(任意)</span>
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                        {resumeData.photoUrl && (
                          <div className="flex items-center gap-2">
                            <img src={resumeData.photoUrl} alt="証明写真プレビュー" className="w-16 h-20 object-cover border border-gray-300 rounded" />
                            <button
                              type="button"
                              onClick={() => setResumeData(prev => ({ ...prev, photoUrl: "" }))}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              削除
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">推奨サイズ: 縦36-40mm × 横24-30mm、5MB以下</p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">現住所</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        郵便番号 <span className="text-red-500 text-xs ml-1">必須</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">〒</span>
                        <input type="text" value={resumeData.profile.address.postalCode} onChange={(e) => handleAddressChange("postalCode", e.target.value)} className="flex-1 p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="100-0001" />
                        <button
                          type="button"
                          onClick={() => handlePostalCodeSearch("address")}
                          disabled={isLoadingAddress}
                          className="px-3 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1 text-sm whitespace-nowrap"
                        >
                          {isLoadingAddress ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Search size={16} />
                          )}
                          住所検索
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        都道府県 <span className="text-red-500 text-xs ml-1">必須</span>
                      </label>
                      <select value={resumeData.profile.address.prefecture} onChange={(e) => handleAddressChange("prefecture", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">選択してください</option>
                        <option value="北海道">北海道</option>
                        <option value="青森県">青森県</option>
                        <option value="岩手県">岩手県</option>
                        <option value="宮城県">宮城県</option>
                        <option value="秋田県">秋田県</option>
                        <option value="山形県">山形県</option>
                        <option value="福島県">福島県</option>
                        <option value="茨城県">茨城県</option>
                        <option value="栃木県">栃木県</option>
                        <option value="群馬県">群馬県</option>
                        <option value="埼玉県">埼玉県</option>
                        <option value="千葉県">千葉県</option>
                        <option value="東京都">東京都</option>
                        <option value="神奈川県">神奈川県</option>
                        <option value="新潟県">新潟県</option>
                        <option value="富山県">富山県</option>
                        <option value="石川県">石川県</option>
                        <option value="福井県">福井県</option>
                        <option value="山梨県">山梨県</option>
                        <option value="長野県">長野県</option>
                        <option value="岐阜県">岐阜県</option>
                        <option value="静岡県">静岡県</option>
                        <option value="愛知県">愛知県</option>
                        <option value="三重県">三重県</option>
                        <option value="滋賀県">滋賀県</option>
                        <option value="京都府">京都府</option>
                        <option value="大阪府">大阪府</option>
                        <option value="兵庫県">兵庫県</option>
                        <option value="奈良県">奈良県</option>
                        <option value="和歌山県">和歌山県</option>
                        <option value="鳥取県">鳥取県</option>
                        <option value="島根県">島根県</option>
                        <option value="岡山県">岡山県</option>
                        <option value="広島県">広島県</option>
                        <option value="山口県">山口県</option>
                        <option value="徳島県">徳島県</option>
                        <option value="香川県">香川県</option>
                        <option value="愛媛県">愛媛県</option>
                        <option value="高知県">高知県</option>
                        <option value="福岡県">福岡県</option>
                        <option value="佐賀県">佐賀県</option>
                        <option value="長崎県">長崎県</option>
                        <option value="熊本県">熊本県</option>
                        <option value="大分県">大分県</option>
                        <option value="宮崎県">宮崎県</option>
                        <option value="鹿児島県">鹿児島県</option>
                        <option value="沖縄県">沖縄県</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      市区町村・番地 <span className="text-red-500 text-xs ml-1">必須</span>
                    </label>
                    <input type="text" value={resumeData.profile.address.city} onChange={(e) => handleAddressChange("city", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="千代田区千代田1-1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      建物名・部屋番号 <span className="text-xs text-gray-500">(任意)</span>
                    </label>
                    <input type="text" value={resumeData.profile.address.building} onChange={(e) => handleAddressChange("building", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="パレスサイドビル 101" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      住所フリガナ <span className="text-red-500 text-xs ml-1">必須</span>
                    </label>
                    <input type="text" value={resumeData.profile.address.kana} onChange={(e) => handleAddressChange("kana", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="チヨダクチヨダ1-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        電話番号 <span className="text-red-500 text-xs ml-1">必須</span>
                      </label>
                      <input type="tel" value={resumeData.profile.phone} onChange={(e) => handleProfileChange("phone", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="090-1234-5678" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        メールアドレス <span className="text-red-500 text-xs ml-1">必須</span>
                        <span className="text-xs text-gray-500 ml-2">(PCメール推奨)</span>
                      </label>
                      <input type="email" value={resumeData.profile.email} onChange={(e) => handleProfileChange("email", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="example@gmail.com" />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">連絡先 (現住所以外)</h2>
                <p className="text-sm text-gray-500 mb-4">※現住所以外に連絡を希望する場合のみ記入してください</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        郵便番号
                      </label>
                      <div className="flex gap-2">
                        <input type="text" value={resumeData.profile.contactAddress.postalCode} onChange={(e) => handleContactAddressChange("postalCode", e.target.value)} className="flex-1 p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="100-0001" />
                        <button
                          type="button"
                          onClick={() => handlePostalCodeSearch("contactAddress")}
                          disabled={isLoadingAddress}
                          className="px-3 py-2.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1 text-sm whitespace-nowrap"
                        >
                          {isLoadingAddress ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Search size={16} />
                          )}
                          住所検索
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        都道府県
                      </label>
                      <select value={resumeData.profile.contactAddress.prefecture} onChange={(e) => handleContactAddressChange("prefecture", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">選択してください</option>
                        <option value="北海道">北海道</option>
                        <option value="青森県">青森県</option>
                        <option value="岩手県">岩手県</option>
                        <option value="宮城県">宮城県</option>
                        <option value="秋田県">秋田県</option>
                        <option value="山形県">山形県</option>
                        <option value="福島県">福島県</option>
                        <option value="茨城県">茨城県</option>
                        <option value="栃木県">栃木県</option>
                        <option value="群馬県">群馬県</option>
                        <option value="埼玉県">埼玉県</option>
                        <option value="千葉県">千葉県</option>
                        <option value="東京都">東京都</option>
                        <option value="神奈川県">神奈川県</option>
                        <option value="新潟県">新潟県</option>
                        <option value="富山県">富山県</option>
                        <option value="石川県">石川県</option>
                        <option value="福井県">福井県</option>
                        <option value="山梨県">山梨県</option>
                        <option value="長野県">長野県</option>
                        <option value="岐阜県">岐阜県</option>
                        <option value="静岡県">静岡県</option>
                        <option value="愛知県">愛知県</option>
                        <option value="三重県">三重県</option>
                        <option value="滋賀県">滋賀県</option>
                        <option value="京都府">京都府</option>
                        <option value="大阪府">大阪府</option>
                        <option value="兵庫県">兵庫県</option>
                        <option value="奈良県">奈良県</option>
                        <option value="和歌山県">和歌山県</option>
                        <option value="鳥取県">鳥取県</option>
                        <option value="島根県">島根県</option>
                        <option value="岡山県">岡山県</option>
                        <option value="広島県">広島県</option>
                        <option value="山口県">山口県</option>
                        <option value="徳島県">徳島県</option>
                        <option value="香川県">香川県</option>
                        <option value="愛媛県">愛媛県</option>
                        <option value="高知県">高知県</option>
                        <option value="福岡県">福岡県</option>
                        <option value="佐賀県">佐賀県</option>
                        <option value="長崎県">長崎県</option>
                        <option value="熊本県">熊本県</option>
                        <option value="大分県">大分県</option>
                        <option value="宮崎県">宮崎県</option>
                        <option value="鹿児島県">鹿児島県</option>
                        <option value="沖縄県">沖縄県</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      市区町村・番地
                    </label>
                    <input type="text" value={resumeData.profile.contactAddress.city} onChange={(e) => handleContactAddressChange("city", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="千代田区千代田1-1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      建物名・部屋番号
                    </label>
                    <input type="text" value={resumeData.profile.contactAddress.building} onChange={(e) => handleContactAddressChange("building", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="パレスサイドビル 101" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      住所フリガナ
                    </label>
                    <input type="text" value={resumeData.profile.contactAddress.kana} onChange={(e) => handleContactAddressChange("kana", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="チヨダクチヨダ1-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        電話番号
                      </label>
                      <input type="tel" value={resumeData.profile.contactAddress.phone} onChange={(e) => handleContactAddressChange("phone", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="090-1234-5678" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        メールアドレス
                      </label>
                      <input type="email" value={resumeData.profile.contactAddress.email} onChange={(e) => handleContactAddressChange("email", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="example@gmail.com" />
                    </div>
                  </div>
                </div>
              </section>

              {/* 本人希望記入欄 */}
              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">
                  本人希望記入欄
                  <span className="text-sm font-normal text-gray-500 ml-2">（任意）</span>
                </h2>

                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    勤務地、勤務時間、通勤・配慮してほしいことなどがあれば記入してください。特になければ空欄のままで構いません。
                  </p>

                  <textarea
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={resumeData.requests}
                    onChange={(e) => handleRequestsChange(e.target.value)}
                    placeholder="例）第二新卒枠での選考を希望します。／家族の介護のため、原則として夜勤は不可です。　など"
                  />
                </div>
              </section>
            </div>
          )
          }

          {/* --- History Tab --- */}
          {
            activeTab === "history" && (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* Education */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-3">学歴</h2>
                    <button onClick={addEducation} className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                      <Plus size={16} /> 追加
                    </button>
                  </div>
                  <div className="space-y-4">
                    {resumeData.education.map((edu, index) => (
                      <div key={edu.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative group">
                        <button onClick={() => removeEducation(index)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                          <Trash2 size={18} />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-3">
                            <label className="block text-xs text-gray-500 mb-1">入学/卒業年月</label>
                            <div className="flex gap-2 items-center">
                              <input type="text" value={edu.startDate.year} onChange={(e) => handleEducationChange(index, "startDate.year", e.target.value)} className="w-16 p-2 border rounded text-sm" placeholder="YYYY" />
                              <span>/</span>
                              <input type="text" value={edu.startDate.month} onChange={(e) => handleEducationChange(index, "startDate.month", e.target.value)} className="w-10 p-2 border rounded text-sm" placeholder="MM" />
                            </div>
                            <div className="text-center text-gray-400 my-1">↓</div>
                            <div className="flex gap-2 items-center">
                              <input type="text" value={edu.endDate.year} onChange={(e) => handleEducationChange(index, "endDate.year", e.target.value)} className="w-16 p-2 border rounded text-sm" placeholder="YYYY" />
                              <span>/</span>
                              <input type="text" value={edu.endDate.month} onChange={(e) => handleEducationChange(index, "endDate.month", e.target.value)} className="w-10 p-2 border rounded text-sm" placeholder="MM" />
                            </div>
                          </div>
                          <div className="md:col-span-9 space-y-3">
                            <div className="flex gap-4">
                              <input type="text" value={edu.schoolName} onChange={(e) => handleEducationChange(index, "schoolName", e.target.value)} className="flex-1 p-2 border rounded" placeholder="学校名" />
                              <select value={edu.status} onChange={(e) => handleEducationChange(index, "status", e.target.value)} className="p-2 border rounded w-32">
                                <option value="graduated">卒業</option>
                                <option value="expected">卒業見込</option>
                                <option value="enrolled">在学中</option>
                                <option value="dropout">中退</option>
                              </select>
                            </div>
                            <input type="text" value={edu.department} onChange={(e) => handleEducationChange(index, "department", e.target.value)} className="w-full p-2 border rounded" placeholder="学部・学科・コース" />
                          </div>
                        </div>
                      </div>
                    ))}
                    {resumeData.education.length === 0 && <p className="text-center text-gray-400 py-4">学歴が登録されていません</p>}
                  </div>
                </section>

                {/* Work History */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-3">職歴</h2>
                    <button onClick={addWork} className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                      <Plus size={16} /> 追加
                    </button>
                  </div>
                  <div className="space-y-4">
                    {resumeData.workHistory.map((work, index) => (
                      <div key={work.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200 relative group">
                        <button onClick={() => removeWork(index)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                          <Trash2 size={18} />
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-3">
                            <label className="block text-xs text-gray-500 mb-1">在籍期間</label>
                            <div className="flex gap-2 items-center">
                              <input type="text" value={work.startDate.year} onChange={(e) => handleWorkChange(index, "startDate.year", e.target.value)} className="w-16 p-2 border rounded text-sm" placeholder="YYYY" />
                              <span>/</span>
                              <input type="text" value={work.startDate.month} onChange={(e) => handleWorkChange(index, "startDate.month", e.target.value)} className="w-10 p-2 border rounded text-sm" placeholder="MM" />
                            </div>
                            <div className="text-center text-gray-400 my-1">↓</div>
                            <div className="flex gap-2 items-center">
                              {work.isCurrent ? (
                                <span className="text-sm font-bold text-green-600 py-2">現在も在職中</span>
                              ) : (
                                <>
                                  <input type="text" value={work.endDate.year} onChange={(e) => handleWorkChange(index, "endDate.year", e.target.value)} className="w-16 p-2 border rounded text-sm" placeholder="YYYY" />
                                  <span>/</span>
                                  <input type="text" value={work.endDate.month} onChange={(e) => handleWorkChange(index, "endDate.month", e.target.value)} className="w-10 p-2 border rounded text-sm" placeholder="MM" />
                                </>
                              )}
                            </div>
                            <label className="flex items-center gap-2 mt-2 text-xs cursor-pointer">
                              <input type="checkbox" checked={work.isCurrent} onChange={(e) => handleWorkChange(index, "isCurrent", e.target.checked)} />
                              在職中
                            </label>
                          </div>
                          <div className="md:col-span-9 space-y-3">
                            {/* Company basic info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={work.companyName}
                                onChange={(e) => handleWorkChange(index, "companyName", e.target.value)}
                                className="w-full p-2 border rounded font-bold"
                                placeholder="会社名（例：株式会社ネオアクト）"
                              />
                              <input
                                type="text"
                                value={work.department || ""}
                                onChange={(e) => handleWorkChange(index, "department", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="所属部署（例：人材紹介事業部）"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={work.position || ""}
                                onChange={(e) => handleWorkChange(index, "position", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="役職・ポジション（例：キャリアアドバイザー）"
                              />
                              <input
                                type="text"
                                value={work.employmentType || ""}
                                onChange={(e) => handleWorkChange(index, "employmentType", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="雇用形態（例：正社員／契約社員）"
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={work.companyCapital || ""}
                                onChange={(e) => handleWorkChange(index, "companyCapital", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="資本金（例：1,000万円）"
                              />
                              <input
                                type="text"
                                value={work.employeeCount || ""}
                                onChange={(e) => handleWorkChange(index, "employeeCount", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="従業員数（例：50名）"
                              />
                            </div>

                            {/* Business description */}
                            <textarea
                              value={work.businessDescription || ""}
                              onChange={(e) => handleWorkChange(index, "businessDescription", e.target.value)}
                              className="w-full p-2 border rounded h-16 text-sm"
                              placeholder="事業内容（会社・部署の概要）"
                            />

                            {/* Responsibilities */}
                            <textarea
                              value={work.responsibilities || ""}
                              onChange={(e) => handleWorkChange(index, "responsibilities", e.target.value)}
                              className="w-full p-2 border rounded h-20 text-sm"
                              placeholder="担当業務の詳細（例：法人営業、新規開拓、求職者面談など）"
                            />

                            {/* Achievements */}
                            <textarea
                              value={work.achievements || ""}
                              onChange={(e) => handleWorkChange(index, "achievements", e.target.value)}
                              className="w-full p-2 border rounded h-20 text-sm"
                              placeholder="実績・成果（数値を含む具体的な成果を記入）"
                            />

                            {/* Environment */}
                            <textarea
                              value={work.environment || ""}
                              onChange={(e) => handleWorkChange(index, "environment", e.target.value)}
                              className="w-full p-2 border rounded h-16 text-sm"
                              placeholder="環境・ツール（例：Windows / Office365 / Salesforce など）"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {resumeData.workHistory.length === 0 && <p className="text-center text-gray-400 py-4">職歴が登録されていません</p>}
                  </div>
                </section>

                {/* Certifications */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-3">免許・資格</h2>
                    <button onClick={addCert} className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                      <Plus size={16} /> 追加
                    </button>
                  </div>
                  <div className="space-y-2">
                    {resumeData.certifications.map((cert, index) => (
                      <div key={cert.id} className="flex gap-4 items-center">
                        <div className="flex gap-2 items-center">
                          <input type="text" value={cert.date.year} onChange={(e) => handleCertChange(index, "date.year", e.target.value)} className="w-16 p-2 border rounded text-sm" placeholder="YYYY" />
                          <span>/</span>
                          <input type="text" value={cert.date.month} onChange={(e) => handleCertChange(index, "date.month", e.target.value)} className="w-10 p-2 border rounded text-sm" placeholder="MM" />
                        </div>
                        <input type="text" value={cert.name} onChange={(e) => handleCertChange(index, "name", e.target.value)} className="flex-1 p-2 border rounded" placeholder="資格名称 (例: 普通自動車第一種運転免許)" />
                        <button onClick={() => removeCert(index)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                    {resumeData.certifications.length === 0 && <p className="text-center text-gray-400 py-4">資格が登録されていません</p>}
                  </div>
                </section>
              </div>
            )
          }

          {/* --- AI Tab --- */}
          {
            activeTab === "ai" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100 mb-6">
                  <h2 className="text-lg font-bold text-blue-800 mb-2">AI自己PR・志望動機ジェネレーター</h2>
                  <p className="text-sm text-blue-600">
                    職種を選んでキーワードを入力するだけで、プロ並みの文章を自動生成します。
                  </p>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">希望職種を選択</label>
                  <select
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                    value={selectedJob}
                    onChange={(e) => setSelectedJob(e.target.value as JobType)}
                  >
                    <option value="">選択してください</option>
                    {Object.values(JOB_TEMPLATES).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left: Inputs */}
                  <div className="space-y-4">
                    {selectedJob ? (
                      <>
                        <h3 className="font-semibold text-gray-700 border-b pb-2">情報の入力</h3>
                        <input
                          type="text"
                          placeholder="【前職】(例: 接客、営業)"
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          onChange={(e) => handleAiInputChange("previousJob", e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="【勉強内容】(例: Java, ITパスポート)"
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          onChange={(e) => handleAiInputChange("studyContent", e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="【具体的なエピソード】(頑張ったこと)"
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          onChange={(e) => handleAiInputChange("episode", e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="【成果】(例: 売上120%達成)"
                          className="w-full p-3 border border-gray-300 rounded-lg"
                          onChange={(e) => handleAiInputChange("result", e.target.value)}
                        />
                        <button
                          onClick={handleGenerate}
                          className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2"
                        >
                          <Wand2 size={20} />
                          文章を生成する
                        </button>
                      </>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center text-gray-500">
                        <Wand2 size={48} className="mb-4 text-gray-300" />
                        <p>AI生成機能を使用するには、<br />上で職種を選択してください。</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Outputs */}
                  <div className="space-y-6">
                    <h3 className="font-semibold text-gray-700 border-b pb-2">生成結果 / 編集</h3>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-gray-700">志望動機</label>
                        <button
                          onClick={() => copyToClipboard(resumeData.motivation)}
                          className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <Copy size={14} /> コピー
                        </button>
                      </div>
                      <textarea
                        className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        value={resumeData.motivation}
                        onChange={(e) => handleMotivationChange(e.target.value)}
                        placeholder="ここに生成された志望動機が表示されます"
                      />
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-gray-700">自己PR</label>
                        <button
                          onClick={() => copyToClipboard(resumeData.selfPromotion)}
                          className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          <Copy size={14} /> コピー
                        </button>
                      </div>
                      <textarea
                        className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        value={resumeData.selfPromotion}
                        onChange={(e) => setResumeData(prev => ({ ...prev, selfPromotion: e.target.value }))}
                        placeholder="ここに生成された自己PRが表示されます"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          }

          {/* --- Career Tab --- */}
          {activeTab === "career" && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-3">
                  職務経歴書テキスト
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(buildCareerText(resumeData))}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    <Copy size={16} />
                    テキストをコピー
                  </button>
                  <button
                    onClick={handlePrintCareerPdf}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Download size={16} />
                    PDFをダウンロード
                  </button>
                </div>
              </div>

              {/* Career Summary Input Fields */}
              <section className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    職務要約（Career Summary）
                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={resumeData.careerSummary || ""}
                    onChange={(e) =>
                      setResumeData(prev => ({ ...prev, careerSummary: e.target.value }))
                    }
                    placeholder="1〜5行でこれまでの経験の要約を入力します。空欄の場合は自動生成されます。"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    活かせる経験・知識・スキル（Skills Summary）
                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={resumeData.skillsSummary || ""}
                    onChange={(e) =>
                      setResumeData(prev => ({ ...prev, skillsSummary: e.target.value }))
                    }
                    placeholder="扱える技術・ツール・業務スキルなどを入力します。"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    自己PR（Career PR）
                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={resumeData.careerPr || ""}
                    onChange={(e) =>
                      setResumeData(prev => ({ ...prev, careerPr: e.target.value }))
                    }
                    placeholder="職務経歴書用の自己PRを入力します。空欄の場合は履歴書の自己PRが使われます。"
                    rows={4}
                  />
                </div>
              </section>

              <p className="text-sm text-gray-500">
                「基本情報」「学歴・職歴」「AI作成」で入力した内容から、
                職務経歴書の文章を自動生成しています。
                テキストをコピーしてWordやGoogleドキュメントに貼り付けてご利用ください。
              </p>

              <textarea
                className="w-full h-[600px] p-4 border border-gray-300 rounded-lg font-mono text-sm leading-relaxed whitespace-pre-wrap"
                readOnly
                value={buildCareerText(resumeData)}
              />
            </div>
          )}

          {/* --- Recommendation Tab --- */}
          {activeTab === "recommendation" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <h2 className="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-3">
                推薦文（エージェント向け）
              </h2>

              {/* Input form for agent-only fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    推薦先企業名
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={recommendationInput.targetCompany}
                    onChange={(e) =>
                      setRecommendationInput((prev) => ({
                        ...prev,
                        targetCompany: e.target.value,
                      }))
                    }
                    placeholder="例）株式会社〇〇"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    推薦ポジション
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={recommendationInput.targetPosition}
                    onChange={(e) =>
                      setRecommendationInput((prev) => ({
                        ...prev,
                        targetPosition: e.target.value,
                      }))
                    }
                    placeholder="例）インフラエンジニア（運用・保守）"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    総評（エージェントコメント）
                  </label>
                  <textarea
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={recommendationInput.summary}
                    onChange={(e) =>
                      setRecommendationInput((prev) => ({
                        ...prev,
                        summary: e.target.value,
                      }))
                    }
                    placeholder="候補者の人柄・総合的な印象を簡潔に記入します。未入力の場合はテンプレート文が自動補完されます。"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    特に推したいポイント
                  </label>
                  <textarea
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={recommendationInput.strengths}
                    onChange={(e) =>
                      setRecommendationInput((prev) => ({
                        ...prev,
                        strengths: e.target.value,
                      }))
                    }
                    placeholder="例）現職での数値実績、継続力、コミュニケーション力など"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    ご留意いただきたい点
                  </label>
                  <textarea
                    className="w-full h-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={recommendationInput.concerns}
                    onChange={(e) =>
                      setRecommendationInput((prev) => ({
                        ...prev,
                        concerns: e.target.value,
                      }))
                    }
                    placeholder="例）経験年数、勤務地制約、これからキャッチアップが必要な領域など"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    貴社ポジションとのマッチ理由
                  </label>
                  <textarea
                    className="w-full h-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={recommendationInput.matchReason}
                    onChange={(e) =>
                      setRecommendationInput((prev) => ({
                        ...prev,
                        matchReason: e.target.value,
                      }))
                    }
                    placeholder="企業理解・ポジション要件を踏まえたマッチ理由を記入します。未入力の場合は汎用テンプレートを使用します。"
                  />
                </div>
              </div>

              {/* Generated recommendation text */}
              <div className="space-y-3">
                <div className="flex  justify-between items-center">
                  <h3 className="text-md font-semibold text-gray-800">
                    生成された推薦文
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        copyToClipboard(
                          buildRecommendationText(resumeData, recommendationInput)
                        )
                      }
                      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                    >
                      <Copy size={16} />
                      コピー
                    </button>
                  </div>
                </div>

                <textarea
                  className="w-full h-[500px] p-4 border border-gray-300 rounded-lg font-mono text-sm leading-relaxed whitespace-pre-wrap"
                  readOnly
                  value={buildRecommendationText(resumeData, recommendationInput)}
                />
              </div>
            </div>
          )}



          {/* --- Preview Tab --- */}
          {activeTab === "preview" && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewMode("resume")}
                    className={`px-4 py-2 text-sm rounded-lg border-2 transition ${previewMode === "resume"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                      }`}
                  >
                    履歴書プレビュー
                  </button>
                  <button
                    onClick={() => setPreviewMode("career")}
                    className={`px-4 py-2 text-sm rounded-lg border-2 transition ${previewMode === "career"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                      }`}
                  >
                    職務経歴書プレビュー
                  </button>
                  <button
                    onClick={() => setPreviewMode("recommendation")}
                    className={`px-4 py-2 text-sm rounded-lg border-2 transition ${previewMode === "recommendation"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                      }`}
                  >
                    推薦文プレビュー
                  </button>
                </div>

                <div className="flex gap-2">
                  {/* Show PDF button based on preview mode */}
                  {previewMode === "recommendation" ? (
                    <button
                      onClick={handleDownloadRecommendationPdf}
                      className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                    >
                      <Download size={20} />
                      推薦文PDFをダウンロード
                    </button>
                  ) : (
                    <button
                      onClick={handlePrintPreviewPdf}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                    >
                      <Download size={20} />
                      PDFをダウンロード
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-auto border rounded-lg shadow-inner bg-gray-100 p-4 flex justify-center">
                <div ref={previewRef}>
                  <div ref={printRef} className="resume-print-wrapper">
                    {/* Conditionally render based on preview mode */}
                    {previewMode === "resume" ? (
                      <ResumePreview formData={resumeData} id="resume-preview" />
                    ) : previewMode === "career" ? (
                      <CareerSheetPreview formData={resumeData} id="career-preview-visible" />
                    ) : (
                      <RecommendationPreview
                        id="recommendation-preview"
                        ref={recommendationPreviewRef}
                        formData={resumeData}
                        recommendationInput={recommendationInput}
                        recommendationText={buildRecommendationText(resumeData, recommendationInput)}
                      />
                    )}

                    {/* Hidden Career Preview for PDF export (when in resume mode) */}
                    {previewMode === "resume" && (
                      <div style={{ display: "none" }}>
                        <CareerSheetPreview formData={resumeData} id="career-preview" />
                      </div>
                    )}
                    {/* Hidden Recommendation Preview for PDF export (when not in recommendation mode) */}
                    {previewMode !== "recommendation" && (
                      <div style={{ display: "none" }}>
                        <RecommendationPreview
                          id="recommendation-preview-hidden"
                          formData={resumeData}
                          recommendationInput={recommendationInput}
                          recommendationText={buildRecommendationText(resumeData, recommendationInput)}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Graduation Table Modal */}
      <GraduationTableModal
        isOpen={isGraduationTableOpen}
        onClose={() => setIsGraduationTableOpen(false)}
      />
    </div>
  );
}
