"use client";

import { useState, useRef, useEffect } from "react";
import { JOB_TEMPLATES, JobType } from "@/lib/data/jobTemplates";
import { generateText, UserInput } from "@/lib/generator";
import { Calendar, User, FileText, Wand2, Download, Copy, Loader2, Plus, Trash2, Search, BookOpen, MessageSquare, Upload, RefreshCw } from "lucide-react";
import { ResumePreview } from "@/components/ResumePreview";
import { CareerSheetPreview } from "@/components/CareerSheetPreview";
import GraduationTableModal from "@/components/GraduationTableModal";
import { ResumeData } from "@/types/resume";
import { normalizeText, limitTextLength, MOTIVATION_MAX_LENGTH, REQUESTS_MAX_LENGTH, toHalfWidth, toKatakana } from "@/lib/textUtils";
import { RecommendationPreview } from "@/components/RecommendationPreview";
import { useResumeStore } from "@/lib/store/resumeStore";
import { DraftStatus } from "@/components/DraftStatus";
import { initialResumeData } from "@/lib/initialResumeData";

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
  // const [resumeData, setResumeData] = useState<ResumeData>(initialResumeData);
  const [isGraduationTableOpen, setIsGraduationTableOpen] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const recommendationPreviewRef = useRef<HTMLDivElement | null>(null);

  // Zustand Store
  const hasHydrated = useResumeStore((s) => s.hasHydrated);
  const resumeData = useResumeStore((s) => s.resume);
  const setAll = useResumeStore((s) => s.setAll);
  const setByPath = useResumeStore((s) => s.setByPath);

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

  // Normalization State
  const [rawPasteText, setRawPasteText] = useState("");
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [normalizationWarnings, setNormalizationWarnings] = useState<string[]>([]);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [pendingResumeData, setPendingResumeData] = useState<ResumeData | null>(null);
  const [lastAiResult, setLastAiResult] = useState<any>(null);

  // PDF Upload State
  const [isPdfExtracting, setIsPdfExtracting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // NeoAct Import Toast
  const [neoactToast, setNeoactToast] = useState<string | null>(null);

  // Improve Mode State
  const [aiMode, setAiMode] = useState<"generate" | "improve">("generate");
  const [improveInputMotivation, setImproveInputMotivation] = useState("");
  const [improveInputSelfPr, setImproveInputSelfPr] = useState("");
  const [isImproving, setIsImproving] = useState(false);
  const [editedRecommendationText, setEditedRecommendationText] = useState("");
  const [isRecommendationManual, setIsRecommendationManual] = useState(false);
  const [editedCareerText, setEditedCareerText] = useState("");
  const [isCareerManual, setIsCareerManual] = useState(false);


  // Hydration check
  useEffect(() => {
    if (hasHydrated && !isRecommendationManual) {
      setEditedRecommendationText(buildRecommendationText(resumeData, recommendationInput));
    }
  }, [resumeData, recommendationInput, hasHydrated, isRecommendationManual]);

  useEffect(() => {
    if (hasHydrated && !isCareerManual) {
      setEditedCareerText(buildCareerText(resumeData));
    }
  }, [resumeData, hasHydrated, isCareerManual]);

  // Feature 3: Auto-set 記入日 to today if empty
  useEffect(() => {
    if (hasHydrated && !resumeData.submissionDate) {
      const today = new Date();
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      const d = today.getDate();
      setAll({ submissionDate: `${y}年${m}月${d}日` });
    }
  }, [hasHydrated]);

  // NeoAct連携: URLパラメータから候補者データを取り込み
  const neoactImportDone = useRef(false);
  useEffect(() => {
    if (!hasHydrated || neoactImportDone.current) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("data");
    console.log("[NeoAct] hasHydrated:", hasHydrated, "encoded exists:", !!encoded, "encoded length:", encoded?.length);
    if (!encoded) return;

    neoactImportDone.current = true;

    try {
      // TextEncoder方式 (UTF-8バイナリ→Base64) のデコード
      // URLSearchParams.get() は自動的にURLデコードする
      const binStr = atob(encoded);
      const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
      const jsonStr = new TextDecoder().decode(bytes);
      const json = JSON.parse(jsonStr);
      console.log("[NeoAct] Parsed candidate data:", Object.keys(json));

      // YYYY-MM → { year, month } (no zero-padding on month)
      const parseYm = (ym: string | null | undefined) => {
        if (!ym) return { year: "", month: "" };
        const parts = ym.split("-");
        return { year: parts[0] || "", month: parts[1] ? String(parseInt(parts[1])) : "" };
      };

      // birthDate (ISO / YYYY-MM-DD) → { year, month, day } (no zero-padding)
      const parseBirth = (d: string | null | undefined) => {
        if (!d) return { year: "", month: "", day: "" };
        const iso = d.includes("T") ? d.split("T")[0] : d;
        const [y, m, dd] = iso.split("-");
        return { year: y || "", month: m ? String(parseInt(m)) : "", day: dd ? String(parseInt(dd)) : "" };
      };

      // gender mapping
      const mapGender = (g: string | null | undefined): "male" | "female" | "" => {
        if (!g) return "";
        const lower = g.toLowerCase();
        if (lower === "male") return "male";
        if (lower === "female") return "female";
        return "";
      };

      // education status mapping
      const mapEduStatus = (s: string | null | undefined): "graduated" | "dropout" | "expected" | "enrolled" | "" => {
        if (!s) return "";
        if (s.includes("卒") || s.includes("修了")) return "graduated";
        if (s.includes("中退") || s.includes("退学")) return "dropout";
        if (s.includes("見込")) return "expected";
        if (s.includes("在学")) return "enrolled";
        return "graduated";
      };

      // NeoAct address parsing
      // address1 = "都道府県・市区町村・番地" (e.g. "東京都府中市清水が丘1-9-4")
      // address2 = "建物名・部屋番号" (e.g. "ドルチェ府中弐番館204号室")
      const parseNeoActAddress = (addr1: string, addr2: string) => {
        let prefecture = "";
        let city = "";
        const building = addr2 || "";

        if (addr1) {
          const prefMatch = addr1.match(/^(北海道|東京都|京都府|大阪府|.+?[県])(.*)$/);
          if (prefMatch) {
            prefecture = prefMatch[1];
            city = prefMatch[2].trim();
          } else {
            // 都道府県が分離できない場合はcityに全部入れる
            city = addr1;
          }
        }

        return { prefecture, city, building };
      };

      const parsedAddr = parseNeoActAddress(json.address1 || "", json.address2 || "");

      const incoming: ResumeData = {
        profile: {
          lastName: json.lastName || "",
          firstName: json.firstName || "",
          lastNameKana: json.lastNameKana || "",
          firstNameKana: json.firstNameKana || "",
          birthday: parseBirth(json.birthDate),
          gender: mapGender(json.gender),
          phone: json.phone || "",
          email: json.email || "",
          address: {
            postalCode: json.postalCode || "",
            prefecture: parsedAddr.prefecture,
            city: parsedAddr.city,
            block: "",
            building: parsedAddr.building,
            kana: "",
          },
          contactAddress: { postalCode: "", prefecture: "", city: "", block: "", building: "", kana: "", phone: "", email: "" },
        },
        education: (json.educations || []).map((e: any) => ({
          id: crypto.randomUUID(),
          schoolType: "",
          schoolName: e.schoolName || "",
          department: e.facultyDept || "",
          startDate: parseYm(e.startYm),
          endDate: parseYm(e.endYm),
          status: mapEduStatus(e.status),
        })),
        workHistory: (json.works || []).map((w: any) => ({
          id: crypto.randomUUID(),
          companyName: w.companyName || "",
          startDate: parseYm(w.startYm),
          endDate: parseYm(w.endYm),
          isCurrent: !w.endYm,
          description: w.roleTitle || "",
          department: "",
          position: w.roleTitle || "",
          employmentType: w.employmentType || "",
          businessDescription: "",
          companyCapital: "",
          employeeCount: "",
          responsibilities: w.tasks || "",
          achievements: w.achievements || "",
          environment: w.techStack || "",
        })),
        certifications: (json.certs || []).map((c: any) => ({
          id: crypto.randomUUID(),
          date: parseYm(c.acquiredYm),
          name: c.name || "",
        })),
        selfPromotion: json.selfPr || "",
        motivation: json.motivation || "",
        requests: [
          json.desiredRole ? `希望職種: ${json.desiredRole}` : "",
          json.desiredCondition || "",
          json.desiredSalary ? `希望年収: ${json.desiredSalary}万円` : "",
        ].filter(Boolean).join("\n"),
        submissionDate: resumeData.submissionDate,
      };

      const merged = mergeResumeData(useResumeStore.getState().resume, incoming);
      setAll(merged);

      // URLからパラメータを消す
      window.history.replaceState({}, "", window.location.pathname);

      // 志望動機・自己PRがある場合、改善モードをセット
      if (json.selfPr || json.motivation) {
        setAiMode("improve");
        if (json.motivation) setImproveInputMotivation(json.motivation);
        if (json.selfPr) setImproveInputSelfPr(json.selfPr);
        setActiveTab("ai");

        // 改善APIを自動実行
        setTimeout(async () => {
          try {
            const res = await fetch("/api/improve/text", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ motivation: json.motivation || "", selfPr: json.selfPr || "" }),
            });
            const result = await res.json();
            if (result.ok) {
              if (result.motivation) setByPath("motivation", limitTextLength(normalizeText(result.motivation), MOTIVATION_MAX_LENGTH));
              if (result.selfPr) setByPath("selfPromotion", normalizeText(result.selfPr));
            }
          } catch (e) {
            console.error("Auto-improve failed:", e);
          }
        }, 500);
      } else {
        setActiveTab("basic");
      }

      // PDF履歴書のURLが含まれている場合、非同期でPDFを読み込みAI解析する
      if (json.pdfUrl) {
        setNeoactToast("NeoActデータを取り込みました。PDFを読み込んでいます...");
        (async () => {
          try {
            console.log("[NeoAct] Fetching PDF from:", json.pdfUrl);
            const pdfRes = await fetch(json.pdfUrl);
            if (!pdfRes.ok) throw new Error(`PDF fetch failed: ${pdfRes.status}`);
            const arrayBuffer = await pdfRes.arrayBuffer();

            const text = await extractTextFromPdf(arrayBuffer);
            if (!text.trim()) {
              console.warn("[NeoAct] PDF text extraction returned empty");
              setNeoactToast("PDFからテキストを抽出できませんでした");
              setTimeout(() => setNeoactToast(null), 5000);
              return;
            }

            console.log("[NeoAct] PDF text extracted, sending to AI normalize...");
            const normalizeRes = await fetch("/api/normalize/resume", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text }),
            });
            const result = await normalizeRes.json();

            if (result?.ok && result?.resumeData?.profile) {
              const currentResume = useResumeStore.getState().resume;
              const pdfMerged = mergeResumeData(currentResume, result.resumeData);
              setAll(pdfMerged);
              console.log("[NeoAct] PDF data merged successfully");
              setNeoactToast("PDFから情報を取得しました！各タブの内容を確認してください。");
            } else {
              console.warn("[NeoAct] PDF normalize failed:", result?.error);
              setNeoactToast("PDFの解析に失敗しました");
            }
            setTimeout(() => setNeoactToast(null), 5000);
          } catch (e) {
            console.error("[NeoAct] PDF auto-import failed:", e);
            setNeoactToast("PDFの取得に失敗しました");
            setTimeout(() => setNeoactToast(null), 5000);
          }
        })();
      } else {
        setNeoactToast("NeoActデータハブから候補者データを取り込みました！各タブの内容を確認してください。");
        setTimeout(() => setNeoactToast(null), 5000);
      }
    } catch (e) {
      console.error("NeoAct data import failed:", e);
    }
  }, [hasHydrated]);

  if (!hasHydrated) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>;

  // --- Handlers ---

  const handleProfileChange = (field: keyof ResumeData["profile"], value: string) => {
    let newValue = value;
    if (field === 'phone') {
      newValue = toHalfWidth(value);
    }
    setByPath(`profile.${field}`, newValue);
  };

  const handleBirthdayChange = (field: keyof ResumeData["profile"]["birthday"], value: string) => {
    setByPath(`profile.birthday.${field}`, value);
  };

  const handleAddressChange = (field: keyof ResumeData["profile"]["address"], value: string) => {
    let newValue = value;
    if (field === 'postalCode') {
      newValue = toHalfWidth(value);
    }
    setByPath(`profile.address.${field}`, newValue);
  };

  const handleContactAddressChange = (field: keyof ResumeData["profile"]["contactAddress"], value: string) => {
    let newValue = value;
    if (field === 'postalCode' || field === 'phone') {
      newValue = toHalfWidth(value);
    }
    setByPath(`profile.contactAddress.${field}`, newValue);
  };

  // Education Handlers
  const addEducation = () => {
    const newEdu = [...resumeData.education, {
      id: crypto.randomUUID(),
      schoolType: "大学",
      schoolName: "",
      department: "",
      startDate: { year: "", month: "" },
      endDate: { year: "", month: "" },
      status: "graduated" as const
    }];
    setAll({ education: newEdu });
  };

  const removeEducation = (index: number) => {
    const newEdu = resumeData.education.filter((_, i) => i !== index);
    setAll({ education: newEdu });
  };

  const handleEducationChange = (index: number, field: string, value: any) => {
    let newValue = value;
    if (typeof value === 'string' && (field.includes('year') || field.includes('month'))) {
      newValue = toHalfWidth(value);
    }
    setByPath(`education.${index}.${field}`, newValue);
  };

  // Work History Handlers
  const addWork = () => {
    const newWork = [...resumeData.workHistory, {
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
    }];
    setAll({ workHistory: newWork });
  };

  const removeWork = (index: number) => {
    const newWork = resumeData.workHistory.filter((_, i) => i !== index);
    setAll({ workHistory: newWork });
  };

  const handleWorkChange = (index: number, field: string, value: any) => {
    let newValue = value;
    if (typeof value === 'string' && (field.includes('year') || field.includes('month'))) {
      newValue = toHalfWidth(value);
    }
    setByPath(`workHistory.${index}.${field}`, newValue);
  };

  // Certifications Handlers
  const addCert = () => {
    const newCerts = [...resumeData.certifications, {
      id: crypto.randomUUID(),
      date: { year: "", month: "" },
      name: ""
    }];
    setAll({ certifications: newCerts });
  };

  const removeCert = (index: number) => {
    const newCerts = resumeData.certifications.filter((_, i) => i !== index);
    setAll({ certifications: newCerts });
  };

  const handleCertChange = (index: number, field: string, value: any) => {
    let newValue = value;
    if (typeof value === 'string' && (field.includes('year') || field.includes('month'))) {
      newValue = toHalfWidth(value);
    }
    setByPath(`certifications.${index}.${field}`, newValue);
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

    setAll({
      motivation,
      selfPromotion: selfPr,
    });

    alert("文章を生成し、履歴書データに反映しました！");
  };


  // PDF.jsでArrayBufferからテキストを抽出する共通関数
  const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string> => {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return text;
  };

  // Feature 1: PDF Upload handler
  const handlePdfUpload = async (file: File) => {
    setIsPdfExtracting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = await extractTextFromPdf(arrayBuffer);
      if (!text.trim()) {
        alert("PDFからテキストを抽出できませんでした。スキャンPDFや画像PDFは対応していません。");
        return;
      }
      setRawPasteText(text);
    } catch (e) {
      console.error(e);
      alert("PDFの読み込みに失敗しました。");
    } finally {
      setIsPdfExtracting(false);
    }
  };

  // Feature 2: Improve handler
  const handleImprove = async () => {
    if (!improveInputMotivation.trim() && !improveInputSelfPr.trim()) {
      alert("改善する文章を入力してください。");
      return;
    }
    setIsImproving(true);
    try {
      const res = await fetch("/api/improve/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivation: improveInputMotivation, selfPr: improveInputSelfPr }),
      });
      const result = await res.json();
      if (!result.ok) {
        alert("改善に失敗しました: " + (result.error || "不明なエラー"));
        return;
      }
      if (result.motivation) {
        setByPath("motivation", limitTextLength(normalizeText(result.motivation), MOTIVATION_MAX_LENGTH));
      }
      if (result.selfPr) {
        setByPath("selfPromotion", normalizeText(result.selfPr));
      }
      alert("文章を改善し、フォームに反映しました！");
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました。");
    } finally {
      setIsImproving(false);
    }
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

    // Header (Introductory lines removed as requested)
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
      setAll({ photoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  // テキスト整形（志望動機・自己PR・本人希望）

  // 志望動機
  const handleMotivationChange = (value: string) => {
    const normalized = normalizeText(value);
    const limited = limitTextLength(normalized, MOTIVATION_MAX_LENGTH);

    setByPath("motivation", limited);
  };

  // 自己PR
  const handleSelfPromotionChange = (value: string) => {
    const normalized = normalizeText(value);

    setByPath("selfPromotion", normalized);
  };

  // 本人希望欄
  const handleRequestsChange = (value: string) => {
    const normalized = normalizeText(value);
    const limited = limitTextLength(normalized, REQUESTS_MAX_LENGTH);

    setByPath("requests", limited);
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
        setByPath("profile.address.prefecture", address.prefecture);
        setByPath("profile.address.city", address.city + address.town);
        setByPath("profile.address.kana", toKatakana(address.prefectureKana + address.cityKana + address.townKana));
      } else {
        // 連絡先住所を更新
        setByPath("profile.contactAddress.prefecture", address.prefecture);
        setByPath("profile.contactAddress.city", address.city + address.town);
        setByPath("profile.contactAddress.kana", toKatakana(address.prefectureKana + address.cityKana + address.townKana));
      }
    } catch (error) {
      console.error("Address search failed", error);
      alert("住所検索に失敗しました");
    } finally {
      setIsLoadingAddress(false);
    }
  };

  // --- Normalization & Deep Merge ---

  const mergeResumeData = (current: ResumeData, incoming: ResumeData): ResumeData => {
    const next = structuredClone(current);

    const isNonEmpty = (v: any) =>
      typeof v === "string" ? v.trim().length > 0 : v !== null && v !== undefined;

    const setIfNonEmpty = (setter: () => void, v: any) => {
      if (isNonEmpty(v)) setter();
    };

    // ===== profile =====
    setIfNonEmpty(() => (next.profile.lastName = incoming.profile.lastName), incoming.profile.lastName);
    setIfNonEmpty(() => (next.profile.firstName = incoming.profile.firstName), incoming.profile.firstName);
    setIfNonEmpty(() => (next.profile.lastNameKana = incoming.profile.lastNameKana), incoming.profile.lastNameKana);
    setIfNonEmpty(() => (next.profile.firstNameKana = incoming.profile.firstNameKana), incoming.profile.firstNameKana);
    setIfNonEmpty(() => (next.profile.phone = incoming.profile.phone), incoming.profile.phone);
    setIfNonEmpty(() => (next.profile.email = incoming.profile.email), incoming.profile.email);

    // birthday
    if (
      incoming.profile.birthday?.year?.trim() ||
      incoming.profile.birthday?.month?.trim() ||
      incoming.profile.birthday?.day?.trim()
    ) {
      next.profile.birthday = incoming.profile.birthday;
    }

    setIfNonEmpty(() => (next.profile.gender = incoming.profile.gender), incoming.profile.gender);

    // address（postalCode有無で条件分岐しない）
    setIfNonEmpty(() => (next.profile.address.postalCode = incoming.profile.address.postalCode), incoming.profile.address.postalCode);
    setIfNonEmpty(() => (next.profile.address.prefecture = incoming.profile.address.prefecture), incoming.profile.address.prefecture);
    setIfNonEmpty(() => (next.profile.address.city = incoming.profile.address.city), incoming.profile.address.city);
    setIfNonEmpty(() => (next.profile.address.block = incoming.profile.address.block), incoming.profile.address.block);
    setIfNonEmpty(() => (next.profile.address.building = incoming.profile.address.building), incoming.profile.address.building);
    setIfNonEmpty(() => (next.profile.address.kana = incoming.profile.address.kana), incoming.profile.address.kana);

    // contactAddress
    setIfNonEmpty(() => (next.profile.contactAddress.postalCode = incoming.profile.contactAddress.postalCode), incoming.profile.contactAddress.postalCode);
    setIfNonEmpty(() => (next.profile.contactAddress.prefecture = incoming.profile.contactAddress.prefecture), incoming.profile.contactAddress.prefecture);
    setIfNonEmpty(() => (next.profile.contactAddress.city = incoming.profile.contactAddress.city), incoming.profile.contactAddress.city);
    setIfNonEmpty(() => (next.profile.contactAddress.block = incoming.profile.contactAddress.block), incoming.profile.contactAddress.block);
    setIfNonEmpty(() => (next.profile.contactAddress.building = incoming.profile.contactAddress.building), incoming.profile.contactAddress.building);
    setIfNonEmpty(() => (next.profile.contactAddress.kana = incoming.profile.contactAddress.kana), incoming.profile.contactAddress.kana);
    setIfNonEmpty(() => (next.profile.contactAddress.phone = incoming.profile.contactAddress.phone), incoming.profile.contactAddress.phone);
    setIfNonEmpty(() => (next.profile.contactAddress.email = incoming.profile.contactAddress.email), incoming.profile.contactAddress.email);

    // ===== arrays =====
    const appendOrReplace = <T,>(cur: T[], inc: T[]) => (cur.length === 0 ? inc : [...cur, ...inc]);

    if (incoming.education?.length) next.education = appendOrReplace(next.education, incoming.education);
    if (incoming.workHistory?.length) next.workHistory = appendOrReplace(next.workHistory, incoming.workHistory);
    if (incoming.certifications?.length) next.certifications = appendOrReplace(next.certifications, incoming.certifications);

    // 重複排除：id が同一なら1つに
    const dedupeById = <T extends { id?: string }>(arr: T[]) => {
      const map = new Map<string, T>();
      const noId: T[] = [];
      for (const a of arr) {
        if (a?.id) map.set(a.id, a);
        else noId.push(a);
      }
      return [...map.values(), ...noId];
    };
    next.education = dedupeById(next.education);
    next.workHistory = dedupeById(next.workHistory);
    next.certifications = dedupeById(next.certifications);

    // ===== text fields =====
    setIfNonEmpty(() => (next.selfPromotion = incoming.selfPromotion), incoming.selfPromotion);
    setIfNonEmpty(() => (next.motivation = incoming.motivation), incoming.motivation);
    setIfNonEmpty(() => (next.requests = incoming.requests), incoming.requests);
    setIfNonEmpty(() => (next.careerSummary = incoming.careerSummary), incoming.careerSummary);
    setIfNonEmpty(() => (next.skillsSummary = incoming.skillsSummary), incoming.skillsSummary);
    setIfNonEmpty(() => (next.careerPr = incoming.careerPr), incoming.careerPr);

    return next;
  };

  const handleNormalize = async () => {
    if (!rawPasteText.trim()) {
      alert("テキストを貼り付けてください。");
      return;
    }

    setIsNormalizing(true);
    try {
      const res = await fetch("/api/normalize/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawPasteText }),
      });

      const result = await res.json();
      setLastAiResult(result);

      if (!result?.ok) {
        alert("解析に失敗しました: " + (result?.error || "不明なエラー"));
        return;
      }

      if (!result?.resumeData || !result.resumeData.profile) {
        console.error("Invalid payload:", result);
        alert("解析結果の形式が不正です（resumeDataがありません）。管理者にお問い合わせください。");
        return;
      }

      setPendingResumeData(result.resumeData);
      if (result.warnings && result.warnings.length > 0) {
        setNormalizationWarnings(result.warnings);
        setIsWarningModalOpen(true);
      } else {
        // 直接反映
        const merged = mergeResumeData(useResumeStore.getState().resume, result.resumeData);
        setAll(merged);
        alert("AIがデータを解析し、フォームに反映しました！「基本情報」タブなどで内容を確認してください。");
        setRawPasteText("");
        setActiveTab("basic");
      }
    } catch (e) {
      console.error(e);
      alert("通信エラーが発生しました。");
    } finally {
      setIsNormalizing(false);
    }
  };

  const applyPendingData = () => {
    if (pendingResumeData) {
      const merged = mergeResumeData(useResumeStore.getState().resume, pendingResumeData);
      setAll(merged);
      setPendingResumeData(null);
      setIsWarningModalOpen(false);
      setRawPasteText("");
      alert("データを反映しました。各タブの内容を確認してください。");
      setActiveTab("basic");
    }
  };



  const handlePrintPreviewPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handlePrintCareerPdf = () => {
    if (typeof window === "undefined") return;

    // Set preview mode to career and trigger print
    setPreviewMode("career");
    setTimeout(() => window.print(), 100);
  };

  const handleDownloadRecommendationPdf = () => {
    if (typeof window === "undefined") return;

    // Set preview mode to recommendation and trigger print
    setPreviewMode("recommendation");
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      {/* NeoAct Import Toast */}
      {neoactToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <span className="text-sm font-medium">{neoactToast}</span>
          <button onClick={() => setNeoactToast(null)} className="text-white/80 hover:text-white font-bold text-lg leading-none">&times;</button>
        </div>
      )}
      <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">AI履歴書ビルダー Pro</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* DraftStatus absolute positioning to avoid layout shift */}
            <div className="absolute right-0 -bottom-8">
              <DraftStatus />
            </div>

            <button onClick={() => setActiveTab("ai")} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium transition-colors">
              <Download size={16} />
              応募データ取り込み (AI)
            </button>
            <div className="text-sm text-gray-500">
              作成日: {resumeData.submissionDate}
            </div>
          </div>
        </div>
      </header >

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-lg overflow-hidden shadow-sm">
          {[
            { id: "basic", label: "基本情報", icon: User },
            { id: "history", label: "学歴・職歴", icon: Calendar },
            { id: "ai", label: "AI解析・作成", icon: Wand2 },
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
                        setAll({ submissionDate: "" });
                        return;
                      }
                      const [y, m, d] = val.split('-');
                      setAll({ submissionDate: `${y}年${parseInt(m)}月${parseInt(d)}日` });
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
                              onClick={() => setAll({ photoUrl: "" })}
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
                      住所フリガナ (カタカナ) <span className="text-red-500 text-xs ml-1">必須</span>
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
                      住所フリガナ (カタカナ)
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
                                <option value="dropout">中途退学</option>
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
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border-2 border-indigo-200 shadow-sm mb-8 transition-all duration-300 hover:shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">
                        応募者データの自動解析・一括反映
                      </h3>
                      <p className="text-sm text-slate-500">
                        求人媒体（doda, マイナビ等）の応募者ページをコピーして貼り付けるだけで、全フォームへ自動反映します。
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <textarea
                      className="w-full h-48 p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none text-sm bg-white"
                      placeholder="媒体の応募情報をここに貼り付けてください..."
                      value={rawPasteText}
                      onChange={(e) => setRawPasteText(e.target.value)}
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isPdfExtracting}
                        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-indigo-300 text-indigo-700 font-medium rounded-xl hover:bg-indigo-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm"
                      >
                        {isPdfExtracting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />PDFを読み込み中...</>
                        ) : (
                          <><Upload className="w-4 h-4" />PDFをアップロード</>
                        )}
                      </button>
                      <span className="text-xs text-slate-400">または上のテキストエリアに直接貼り付け</span>
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePdfUpload(file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                    <button
                      onClick={handleNormalize}
                      disabled={isNormalizing || !rawPasteText.trim()}
                      className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                    >
                      {isNormalizing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          AIが全データを解析・反映中...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5" />
                          AIで入力フォームに一括反映する
                        </>
                      )}
                    </button>

                    {/* Debug Info */}
                    {lastAiResult && (
                      <div className="mt-4 p-4 bg-slate-100 rounded-xl border border-slate-200">
                        <details className="text-xs">
                          <summary className="cursor-pointer font-bold text-slate-600 flex items-center gap-1">
                            <Search size={14} /> [デバッグ] AI解析結果の詳細を表示
                          </summary>
                          <pre className="mt-2 p-2 bg-white rounded border overflow-auto max-h-60 text-[10px] leading-tight font-mono">
                            {JSON.stringify(lastAiResult, null, 2)}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-300 my-8"></div>

                <div>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-6">
                    <div className="flex items-center justify-between mb-1 gap-4 flex-wrap">
                      <h3 className="text-md font-bold text-blue-800">AI自己PR・志望動機ジェネレーター</h3>
                      <div className="flex rounded-lg overflow-hidden border border-blue-300 text-sm font-medium">
                        <button
                          onClick={() => setAiMode("generate")}
                          className={`px-3 py-1 transition-colors ${aiMode === "generate" ? "bg-blue-600 text-white" : "bg-white text-blue-700 hover:bg-blue-50"}`}
                        >
                          <span className="flex items-center gap-1"><Wand2 size={13} />ゼロから生成</span>
                        </button>
                        <button
                          onClick={() => setAiMode("improve")}
                          className={`px-3 py-1 transition-colors ${aiMode === "improve" ? "bg-blue-600 text-white" : "bg-white text-blue-700 hover:bg-blue-50"}`}
                        >
                          <span className="flex items-center gap-1"><RefreshCw size={13} />改善モード</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-blue-600">
                      {aiMode === "generate" ? "職種を選んでキーワードを入力し、文章を自動生成します。" : "候補者の既存文章を貼り付けて、AIがより良く書き直します。"}
                    </p>
                  </div>

                  {aiMode === "generate" && (
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
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left: Inputs */}
                    <div className="space-y-4">
                      {aiMode === "generate" ? (
                        selectedJob ? (
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
                        )
                      ) : (
                        <>
                          <h3 className="font-semibold text-gray-700 border-b pb-2">既存の文章を貼り付け</h3>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">志望動機（既存の文章）</label>
                            <textarea
                              className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                              placeholder="候補者の志望動機を貼り付けてください"
                              value={improveInputMotivation}
                              onChange={(e) => setImproveInputMotivation(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">自己PR（既存の文章）</label>
                            <textarea
                              className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                              placeholder="候補者の自己PRを貼り付けてください"
                              value={improveInputSelfPr}
                              onChange={(e) => setImproveInputSelfPr(e.target.value)}
                            />
                          </div>
                          <button
                            onClick={handleImprove}
                            disabled={isImproving || (!improveInputMotivation.trim() && !improveInputSelfPr.trim())}
                            className="mt-2 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-300 transition shadow-md flex items-center justify-center gap-2"
                          >
                            {isImproving ? (
                              <><Loader2 className="w-5 h-5 animate-spin" />AIが改善中...</>
                            ) : (
                              <><RefreshCw size={20} />AIでより良く書き直す</>
                            )}
                          </button>
                        </>
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
                          className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          value={resumeData.selfPromotion}
                          onChange={(e) => handleSelfPromotionChange(e.target.value)}
                          placeholder="ここに生成された自己PRが表示されます"
                        />
                      </div>
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
                    onClick={() => copyToClipboard(editedCareerText)}
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
                      setAll({ careerSummary: e.target.value })
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
                      setAll({ skillsSummary: e.target.value })
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
                      setAll({ careerPr: e.target.value })
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
                value={editedCareerText}
                onChange={(e) => {
                  setEditedCareerText(e.target.value);
                  setIsCareerManual(true);
                }}
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => {
                    if (confirm("編集内容を破棄してテンプレートから再生成しますか？")) {
                      setIsCareerManual(false);
                      setEditedCareerText(buildCareerText(resumeData));
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                >
                  <Wand2 size={14} />
                  テンプレートから再生成（編集内容をリセット）
                </button>
              </div>
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
                        copyToClipboard(editedRecommendationText)
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
                  value={editedRecommendationText}
                  onChange={(e) => {
                    setEditedRecommendationText(e.target.value);
                    setIsRecommendationManual(true);
                  }}
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => {
                      if (confirm("編集内容を破棄してテンプレートから再生成しますか？")) {
                        setIsRecommendationManual(false);
                        setEditedRecommendationText(buildRecommendationText(resumeData, recommendationInput));
                      }
                    }}
                    className="text-xs text-gray-500 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Wand2 size={14} />
                    テンプレートから再生成（編集内容をリセット）
                  </button>
                </div>
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
                      <CareerSheetPreview formData={resumeData} id="career-preview-visible" rawText={editedCareerText} />
                    ) : (
                      <RecommendationPreview
                        id="recommendation-preview"
                        ref={recommendationPreviewRef}
                        formData={resumeData}
                        recommendationInput={recommendationInput}
                        recommendationText={editedRecommendationText}
                      />
                    )}

                    {/* Hidden Career Preview for PDF export (when in resume mode) */}
                    {previewMode === "resume" && (
                      <div style={{ display: "none" }}>
                        <CareerSheetPreview formData={resumeData} id="career-preview" rawText={editedCareerText} />
                      </div>
                    )}
                    {/* Hidden Recommendation Preview for PDF export (when not in recommendation mode) */}
                    {previewMode !== "recommendation" && (
                      <div style={{ display: "none" }}>
                        <RecommendationPreview
                          id="recommendation-preview-hidden"
                          formData={resumeData}
                          recommendationInput={recommendationInput}
                          recommendationText={editedRecommendationText}
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

      {/* Warnings Modal */}
      {isWarningModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-full text-white">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">解析結果の確認</h3>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-slate-600 font-medium text-sm">以下の項目を自動的に修正・整形しました：</p>
              <ul className="space-y-2">
                {normalizationWarnings.map((warning, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-700 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                    <span>・</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  ※AIの推測を含むため、反映後に必ず各項目（特に学歴・職歴の年月）が正しいかご確認ください。
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setIsWarningModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={applyPendingData}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all text-sm"
              >
                フォームに反映する
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
