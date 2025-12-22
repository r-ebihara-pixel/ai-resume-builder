"use client";

import { useState, useRef, useEffect } from "react";
import { JOB_TEMPLATES, JobType } from "@/lib/data/jobTemplates";
import { generateText, UserInput } from "@/lib/generator";
import { Calendar, User, FileText, Wand2, Download, Copy, Loader2, Plus, Trash2, Search, BookOpen, MessageSquare } from "lucide-react";
import { ResumePreview } from "@/components/ResumePreview";
import { CareerSheetPreview } from "@/components/CareerSheetPreview";
import GraduationTableModal from "@/components/GraduationTableModal";
import { ResumeData } from "@/types/resume";
import { normalizeText, limitTextLength, MOTIVATION_MAX_LENGTH, REQUESTS_MAX_LENGTH, toHalfWidth } from "@/lib/textUtils";
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
    alert("豁｣縺励＞7譯√・驛ｵ萓ｿ逡ｪ蜿ｷ繧貞・蜉帙＠縺ｦ縺上□縺輔＞");
    return null;
  }

  const res = await fetch(
    `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${normalized}`
  );

  if (!res.ok) {
    console.error("驛ｵ萓ｿ逡ｪ蜿ｷAPI縺ｮ蜻ｼ縺ｳ蜃ｺ縺励↓螟ｱ謨励＠縺ｾ縺励◆");
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
  const birthDate = new Date(year, month - 1, day); // 譛医・0蟋九∪繧・
  let age = today.getFullYear() - birthDate.getFullYear();
  const thisYearBirthday = new Date(today.getFullYear(), month - 1, day);

  // 縺ｾ縺莉雁ｹｴ縺ｮ隱慕函譌･縺梧擂縺ｦ縺・↑縺代ｌ縺ｰ -1
  if (today < thisYearBirthday) {
    age -= 1;
  }

  // 繝槭う繝翫せ縺ｫ縺ｪ繧峨↑縺・ｈ縺・ぎ繝ｼ繝・  return age < 0 ? 0 : age;
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


  // Hydration check
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
      schoolType: "螟ｧ蟄ｦ",
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
    const selfPr = normalizeText(rawSelfPr); // 蠢・ｦ√↑繧・limitTextLength 繧定ｿｽ蜉

    setAll({
      motivation,
      selfPromotion: selfPr,
    });

    alert("譁・ｫ繧堤函謌舌＠縲∝ｱ･豁ｴ譖ｸ繝・・繧ｿ縺ｫ蜿肴丐縺励∪縺励◆・・);
  };


  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("繧ｳ繝斐・縺励∪縺励◆");
    }).catch(err => {
      console.error("繧ｳ繝斐・縺ｫ螟ｱ謨励＠縺ｾ縺励◆", err);
    });
  };

  const buildCareerText = (data: ResumeData): string => {
    const lines: string[] = [];

    // Helper: safely format YYYY/MM 竊・"YYYY蟷ｴMM譛・ or placeholder
    const formatYearMonth = (
      date?: { year?: string; month?: string },
      placeholder = "----蟷ｴ--譛・
    ): string => {
      const y = date?.year?.trim();
      const m = date?.month?.trim();

      if (!y && !m) return placeholder;

      const year = y && y.length > 0 ? y : "----";
      const month = m && m.length > 0 ? m : "--";

      return `${year}蟷ｴ${month}譛・;
    };

    // ====== 繧ｿ繧､繝医Ν ======
    lines.push("閨ｷ蜍咏ｵ梧ｭｴ譖ｸ", "");

    // ====== 閨ｷ蜍呵ｦ∫ｴ・======
    lines.push("縲占・蜍呵ｦ∫ｴ・・);

    const summary =
      data.careerSummary && data.careerSummary.trim().length > 0
        ? data.careerSummary.trim()
        : "縺薙ｌ縺ｾ縺ｧ縲∬､・焚縺ｮ讌ｭ蜍吶↓蟷・ｺ・￥蠕謎ｺ九＠縺ｦ縺阪∪縺励◆縲・;

    lines.push(summary, "");

    // ====== 繧ｹ繧ｭ繝ｫ隕∫ｴ・ｼ井ｻｻ諢擾ｼ・======
    if (data.skillsSummary && data.skillsSummary.trim().length > 0) {
      lines.push("縲舌せ繧ｭ繝ｫ隕∫ｴ・・);
      lines.push(data.skillsSummary.trim(), "");
    }

    // ====== 閾ｪ蟾ｱPR・井ｻｻ諢擾ｼ・======
    if (data.careerPr && data.careerPr.trim().length > 0) {
      lines.push("縲占・蟾ｱPR縲・);
      lines.push(data.careerPr.trim(), "");
    }

    // ====== 閨ｷ蜍咏ｵ梧ｭｴ ======
    lines.push("縲占・蜍咏ｵ梧ｭｴ縲・);

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
      lines.push("笆 ----蟷ｴ--譛・・・----蟷ｴ--譛・);
      lines.push("");
    } else {
      for (const work of sortedWork) {
        const startText = formatYearMonth(work.startDate);
        const endText = work.isCurrent
          ? "迴ｾ蝨ｨ"
          : formatYearMonth(work.endDate);

        // 譛滄俣陦・        lines.push(`笆 ${startText} ・・${endText}`);

        // 莨夂､ｾ蜷・・具ｼ磯Κ鄂ｲ・丞ｽｹ閨ｷ・・        const companyParts: string[] = [];
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
          companyParts.push(`・・{deptPos.join("・・)}・荏);
        }

        if (companyParts.length > 0) {
          lines.push(companyParts.join(""));
        }

        // 莠区･ｭ蜀・ｮｹ
        if (work.businessDescription && work.businessDescription.trim().length > 0) {
          lines.push(`縲蝉ｺ区･ｭ蜀・ｮｹ縲・{work.businessDescription.trim()}`);
        }

        // 諡・ｽ捺･ｭ蜍・        if (work.responsibilities && work.responsibilities.trim().length > 0) {
          lines.push(`縲先球蠖捺･ｭ蜍吶・{work.responsibilities.trim()}`);
        }

        // 螳溽ｸｾ繝ｻ謌先棡
        if (work.achievements && work.achievements.trim().length > 0) {
          lines.push(`縲仙ｮ溽ｸｾ繝ｻ謌先棡縲・{work.achievements.trim()}`);
        }

        // 迺ｰ蠅・・繝・・繝ｫ
        if (work.environment && work.environment.trim().length > 0) {
          lines.push(`縲千腸蠅・・繝・・繝ｫ縲・{work.environment.trim()}`);
        }

        // 遨ｺ陦後〒蛹ｺ蛻・ｋ
        lines.push("");
      }
    }

    // ====== 菫晄怏雉・ｼ ======
    lines.push("縲蝉ｿ晄怏雉・ｼ縲・);

    const certs = data.certifications || [];
    const hasCerts = certs.some((c) => c && c.name && c.name.trim().length > 0);

    if (!hasCerts) {
      lines.push("縺ｪ縺・);
    } else {
      for (const cert of certs) {
        if (!cert || !cert.name || cert.name.trim().length === 0) continue;

        const ym = formatYearMonth(cert.date, "");
        const prefix = ym ? `${ym} ` : "";
        lines.push(`繝ｻ${prefix}${cert.name.trim()}`);
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
    const company = rec.targetCompany || "蠕｡遉ｾ";
    const position = rec.targetPosition || "蜍滄寔繝昴ず繧ｷ繝ｧ繝ｳ";

    // Header (Introductory lines removed as requested)
    // Basic info
    if (fullName) {
      lines.push(`蛟呵｣懆・錐・・{fullName}${ageStr ? `・・{ageStr}豁ｳ・荏 : ""}`);
      lines.push("");
    }

    // Overall summary (agent comment)
    lines.push("縲千ｷ剰ｩ輔・);
    if (rec.summary.trim()) {
      lines.push(normalizeText(rec.summary));
    } else {
      lines.push(
        `${fullName || "譛ｬ蛟呵｣懆・}縺ｯ縲√％繧後∪縺ｧ縺ｮ縺皮ｵ碁ｨ薙ｒ騾壹§縺ｦ蝓ｹ縺｣縺溷ｯｾ莠ｺ繧ｳ繝溘Η繝九こ繝ｼ繧ｷ繝ｧ繝ｳ蜉帙→縲∫捩螳溘↓迚ｩ莠九ｒ繧・ｊ驕ゅ￡繧狗ｶ咏ｶ壼鴨繧貞ｙ縺医※縺翫ｊ縲√・繝・Φ繧ｷ繝｣繝ｫ繝ｻ莠ｺ譟・→繧ゅ↓閾ｪ菫｡繧呈戟縺｣縺ｦ縺疲耳阮ｦ縺ｧ縺阪ｋ譁ｹ縺ｧ縺吶Ａ
      );
    }
    lines.push("");

    // Strengths
    lines.push("縲千音縺ｫ隧穂ｾ｡縺励※縺・ｋ繝昴う繝ｳ繝医・);
    if (rec.strengths.trim()) {
      lines.push(normalizeText(rec.strengths));
    } else {
      lines.push("繝ｻ蜻ｨ蝗ｲ縺ｨ騾｣謳ｺ縺励↑縺後ｉ讌ｭ蜍吶ｒ騾ｲ繧√ｉ繧後ｋ蜊碑ｪｿ諤ｧ");
      lines.push("繝ｻ謖・､ｺ蠕・■縺ｧ縺ｯ縺ｪ縺上∬・繧芽ｪｲ鬘後ｒ隕九▽縺代※陦悟虚縺ｧ縺阪ｋ荳ｻ菴捺ｧ");
      lines.push("繝ｻ譛ｪ邨碁ｨ馴伜沺縺ｫ蟇ｾ縺励※繧ょｭｦ鄙偵ｒ邯咏ｶ壹〒縺阪ｋ邏逶ｴ縺輔・蜷ｸ蜿主鴨");
    }
    lines.push("");

    // Work history overview from resumeData
    const workHistory = data.workHistory ?? [];
    lines.push("縲舌＃邨梧ｭｴ縺ｮ讎りｦ√・);
    if (workHistory.length === 0) {
      lines.push("迴ｾ蝨ｨ縲∬・蜍咏ｵ梧ｭｴ縺ｮ逋ｻ骭ｲ縺ｯ縺ゅｊ縺ｾ縺帙ｓ縺後√・繝・Φ繧ｷ繝｣繝ｫ謗｡逕ｨ蛟呵｣懊→縺励※縺ｮ縺疲署譯医→縺ｪ繧翫∪縺吶・);
    } else {
      workHistory.forEach((work) => {
        const startY = work.startDate?.year ?? "";
        const startM = work.startDate?.month ?? "";
        const endY = work.isCurrent ? "" : work.endDate?.year ?? "";
        const endM = work.isCurrent ? "" : work.endDate?.month ?? "";

        const startStr =
          startY || startM ? `${startY}蟷ｴ${startM}譛・ : "----蟷ｴ--譛・;
        const endStr = work.isCurrent
          ? "迴ｾ蝨ｨ"
          : endY || endM
            ? `${endY}蟷ｴ${endM}譛・
            : "----蟷ｴ--譛・;

        const companyName = work.companyName || "髱槫・髢倶ｼ∵･ｭ";
        lines.push(`繝ｻ${startStr} 縲・${endStr}・・{companyName}`);
        if (work.description) {
          lines.push(`縲諡・ｽ捺･ｭ蜍呻ｼ・{normalizeText(work.description)}`);
        }
      });
    }
    lines.push("");

    // Match reason
    lines.push("縲占ｲｴ遉ｾ繝昴ず繧ｷ繝ｧ繝ｳ縺ｨ縺ｮ繝槭ャ繝∫炊逕ｱ縲・);
    if (rec.matchReason.trim()) {
      lines.push(normalizeText(rec.matchReason));
    } else {
      lines.push(
        `${position}縺ｫ縺翫＞縺ｦ豎ゅａ繧峨ｌ繧九悟渕遉守噪縺ｪIT繝ｪ繝・Λ繧ｷ繝ｼ縲阪ｄ縲悟捉蝗ｲ縺ｨ蜊泌鴨縺励↑縺後ｉ讌ｭ蜍吶ｒ驕り｡後☆繧句ｧｿ蜍｢縲阪↓蜉縺医∵悴邨碁ｨ馴伜沺縺ｫ蟇ｾ縺励※繧ょ燕蜷代″縺ｫ繧ｭ繝｣繝・メ繧｢繝・・縺励※縺・￥繧ｹ繧ｿ繝ｳ繧ｹ縺後∬ｲｴ遉ｾ縺ｮ邨・ｹ秘｢ｨ蝨溘・閧ｲ謌舌せ繧ｿ繝ｳ繧ｹ縺ｨ髱槫ｸｸ縺ｫ隕ｪ蜥梧ｧ縺碁ｫ倥＞縺ｨ諢溘§縺ｦ縺翫ｊ縺ｾ縺吶Ａ
      );
    }
    lines.push("");

    // Concerns / risk points
    lines.push("縲舌＃逡呎э縺・◆縺縺阪◆縺・せ縲・);
    if (rec.concerns.trim()) {
      lines.push(normalizeText(rec.concerns));
    } else {
      lines.push(
        "迴ｾ譎らせ縺ｧ縺ｯ螳溷漁邨碁ｨ薙′髯仙ｮ夂噪縺ｪ驛ｨ蛻・ｂ縺斐＊縺・∪縺吶′縲√◎縺ｮ蛻・∬ｲｴ遉ｾ縺ｧ縺ｮ謨呵ご繝ｻOJT繧帝壹§縺ｦ譟碑ｻ溘↓譟薙∪縺｣縺ｦ縺・￠繧倶ｽ吝慍縺悟､ｧ縺阪＞縺ｨ謐峨∴縺ｦ縺翫ｊ縺ｾ縺吶る擇謗･縺ｮ蝣ｴ縺ｫ縺翫＞縺ｦ縺ｯ縲√％繧後∪縺ｧ縺ｮ縺皮ｵ碁ｨ薙ｄ蟄ｦ鄙堤憾豕√↓縺､縺・※邇・峩縺ｫ縺皮｢ｺ隱阪＞縺溘□縺代∪縺吶→蟷ｸ縺・〒縺吶・
      );
    }
    lines.push("");

    // Closing
    lines.push("莉･荳翫→縺ｪ繧翫∪縺吶・);
    lines.push(
      "縺懊・荳蠎ｦ縲・擇謗･縺ｮ讖滉ｼ壹ｒ鬆よ斡縺ｧ縺阪∪縺吶→蟷ｸ縺・〒縺吶ゅ＃讀懆ｨ弱・縺ｻ縺ｩ縲∽ｽ募穀繧医ｍ縺励￥縺企｡倥＞逕ｳ縺嶺ｸ翫￡縺ｾ縺吶・
    );

    return lines.join("\n");
  };

  // 蜀咏悄繧｢繝・・繝ｭ繝ｼ繝・  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 逕ｻ蜒上ヵ繧｡繧､繝ｫ縺九メ繧ｧ繝・け
    if (!file.type.startsWith("image/")) {
      alert("逕ｻ蜒上ヵ繧｡繧､繝ｫ繧帝∈謚槭＠縺ｦ縺上□縺輔＞");
      return;
    }

    // 繝輔ぃ繧､繝ｫ繧ｵ繧､繧ｺ繝√ぉ繝・け・・MB莉･荳具ｼ・    if (file.size > 5 * 1024 * 1024) {
      alert("繝輔ぃ繧､繝ｫ繧ｵ繧､繧ｺ縺ｯ5MB莉･荳九↓縺励※縺上□縺輔＞");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setAll({ photoUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  // 繝・く繧ｹ繝域紛蠖｢・亥ｿ玲悍蜍墓ｩ溘・閾ｪ蟾ｱPR繝ｻ譛ｬ莠ｺ蟶梧悍・・
  // 蠢玲悍蜍墓ｩ・  const handleMotivationChange = (value: string) => {
    const normalized = normalizeText(value);
    const limited = limitTextLength(normalized, MOTIVATION_MAX_LENGTH);

    setByPath("motivation", limited);
  };

  // 閾ｪ蟾ｱPR
  const handleSelfPromotionChange = (value: string) => {
    const normalized = normalizeText(value);

    setByPath("selfPromotion", normalized);
  };

  // 譛ｬ莠ｺ蟶梧悍谺・  const handleRequestsChange = (value: string) => {
    const normalized = normalizeText(value);
    const limited = limitTextLength(normalized, REQUESTS_MAX_LENGTH);

    setByPath("requests", limited);
  };


  // 驛ｵ萓ｿ逡ｪ蜿ｷ縺九ｉ菴乗園繧定・蜍募・蜉・  const handlePostalCodeSearch = async (target: "address" | "contactAddress") => {
    // 縺ｩ縺｡繧峨・驛ｵ萓ｿ逡ｪ蜿ｷ繧剃ｽｿ縺・°繧呈ｱｺ繧√ｋ
    const postalCode =
      target === "address"
        ? resumeData.profile.address.postalCode
        : resumeData.profile.contactAddress.postalCode;

    if (!postalCode) {
      alert("驛ｵ萓ｿ逡ｪ蜿ｷ繧貞・蜉帙＠縺ｦ縺上□縺輔＞");
      return;
    }

    setIsLoadingAddress(true);
    try {
      const address = await fetchAddressByPostalCode(postalCode);

      if (!address) {
        alert("菴乗園縺瑚ｦ九▽縺九ｊ縺ｾ縺帙ｓ縺ｧ縺励◆");
        return;
      }

      if (target === "address") {
        // 迴ｾ菴乗園繧呈峩譁ｰ
        setByPath("profile.address.prefecture", address.prefecture);
        setByPath("profile.address.city", address.city + address.town);
        setByPath("profile.address.kana", address.prefectureKana + address.cityKana + address.townKana);
      } else {
        // 騾｣邨｡蜈井ｽ乗園繧呈峩譁ｰ
        setByPath("profile.contactAddress.prefecture", address.prefecture);
        setByPath("profile.contactAddress.city", address.city + address.town);
        setByPath("profile.contactAddress.kana", address.prefectureKana + address.cityKana + address.townKana);
      }
    } catch (error) {
      console.error("Address search failed", error);
      alert("菴乗園讀懃ｴ｢縺ｫ螟ｱ謨励＠縺ｾ縺励◆");
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

    // address・・ostalCode譛臥┌縺ｧ譚｡莉ｶ蛻・ｲ舌＠縺ｪ縺・ｼ・    setIfNonEmpty(() => (next.profile.address.postalCode = incoming.profile.address.postalCode), incoming.profile.address.postalCode);
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

    // 驥崎､・賜髯､・喨d 縺悟酔荳縺ｪ繧・縺､縺ｫ
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
      alert("繝・く繧ｹ繝医ｒ雋ｼ繧贋ｻ倥￠縺ｦ縺上□縺輔＞縲・);
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
        alert("隗｣譫舌↓螟ｱ謨励＠縺ｾ縺励◆: " + (result?.error || "荳肴・縺ｪ繧ｨ繝ｩ繝ｼ"));
        return;
      }

      if (!result?.resumeData || !result.resumeData.profile) {
        console.error("Invalid payload:", result);
        alert("隗｣譫千ｵ先棡縺ｮ蠖｢蠑上′荳肴ｭ｣縺ｧ縺呻ｼ・esumeData縺後≠繧翫∪縺帙ｓ・峨らｮ｡逅・・↓縺雁撫縺・粋繧上○縺上□縺輔＞縲・);
        return;
      }

      setPendingResumeData(result.resumeData);
      if (result.warnings && result.warnings.length > 0) {
        setNormalizationWarnings(result.warnings);
        setIsWarningModalOpen(true);
      } else {
        // 逶ｴ謗･蜿肴丐
        const merged = mergeResumeData(useResumeStore.getState().resume, result.resumeData);
        setAll(merged);
        alert("AI縺後ョ繝ｼ繧ｿ繧定ｧ｣譫舌＠縲√ヵ繧ｩ繝ｼ繝縺ｫ蜿肴丐縺励∪縺励◆・√悟渕譛ｬ諠・ｱ縲阪ち繝悶↑縺ｩ縺ｧ蜀・ｮｹ繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞縲・);
        setRawPasteText("");
        setActiveTab("basic");
      }
    } catch (e) {
      console.error(e);
      alert("騾壻ｿ｡繧ｨ繝ｩ繝ｼ縺檎匱逕溘＠縺ｾ縺励◆縲・);
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
      alert("繝・・繧ｿ繧貞渚譏縺励∪縺励◆縲ょ推繧ｿ繝悶・蜀・ｮｹ繧堤｢ｺ隱阪＠縺ｦ縺上□縺輔＞縲・);
      setActiveTab("basic");
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
      alert("PDF逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆");
    }
  };

  const handleDownloadRecommendationPdf = async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).jsPDF;

      // 竭 繧ｿ繝ｼ繧ｲ繝・ヨ隕∫ｴ縺ｮ ID 繧呈耳阮ｦ譁・畑縺ｫ螟画峩
      const element = document.getElementById("recommendation-preview");
      if (!element) {
        console.error("Recommendation preview element not found");
        return;
      }

      // 竭｡ html2canvas 險ｭ螳壹・ career-sheet 縺ｨ螳悟・蜷後§縺ｧ OK
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

      // 竭｢ 繝輔ぃ繧､繝ｫ蜷阪□縺第耳阮ｦ譁・畑縺ｫ螟画峩
      pdf.save("recommendation.pdf");
    } catch (error) {
      console.error("PDF generation failed:", error);
      alert("PDF逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900 flex flex-col">
      <header className="bg-white shadow-sm p-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between relative">
          <div className="flex items-center gap-2">
            <FileText className="text-blue-600" />
            <h1 className="text-xl font-bold text-gray-800">AI螻･豁ｴ譖ｸ繝薙Ν繝繝ｼ Pro</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* DraftStatus absolute positioning to avoid layout shift */}
            <div className="absolute right-0 -bottom-8">
              <DraftStatus />
            </div>

            <button onClick={() => setActiveTab("ai")} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium transition-colors">
              <Download size={16} />
              蠢懷供繝・・繧ｿ蜿悶ｊ霎ｼ縺ｿ (AI)
            </button>
            <div className="text-sm text-gray-500">
              菴懈・譌･: {resumeData.submissionDate}
            </div>
          </div>
        </div>
      </header >

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-lg overflow-hidden shadow-sm">
          {[
            { id: "basic", label: "蝓ｺ譛ｬ諠・ｱ", icon: User },
            { id: "history", label: "蟄ｦ豁ｴ繝ｻ閨ｷ豁ｴ", icon: Calendar },
            { id: "ai", label: "AI隗｣譫舌・菴懈・", icon: Wand2 },
            { id: "career", label: "閨ｷ蜍咏ｵ梧ｭｴ譖ｸ", icon: BookOpen },
            { id: "recommendation", label: "謗ｨ阮ｦ譁・, icon: MessageSquare },
            { id: "preview", label: "繝励Ξ繝薙Η繝ｼ", icon: FileText },
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
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">菴懈・譌･</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    險伜・譌･
                  </label>
                  <input
                    type="date"
                    value={resumeData.submissionDate.replace(/蟷ｴ/g, '-').replace(/譛・g, '-').replace(/譌･/g, '').replace(/\//g, '-')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setAll({ submissionDate: "" });
                        return;
                      }
                      const [y, m, d] = val.split('-');
                      setAll({ submissionDate: `${y}蟷ｴ${parseInt(m)}譛・{parseInt(d)}譌･` });
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">豌丞錐繝ｻ騾｣邨｡蜈・/h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        豌丞錐 (蟋・ <span className="text-red-500 text-xs ml-1">蠢・・/span>
                      </label>
                      <input type="text" value={resumeData.profile.lastName} onChange={(e) => handleProfileChange("lastName", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="萓・ 霆｢閨ｷ" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        豌丞錐 (蜷・ <span className="text-red-500 text-xs ml-1">蠢・・/span>
                      </label>
                      <input type="text" value={resumeData.profile.firstName} onChange={(e) => handleProfileChange("firstName", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="萓・ 螟ｪ驛・ />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        繝輔Μ繧ｬ繝・(繧ｻ繧､) <span className="text-red-500 text-xs ml-1">蠢・・/span>
                      </label>
                      <input type="text" value={resumeData.profile.lastNameKana} onChange={(e) => handleProfileChange("lastNameKana", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="萓・ 繝・Φ繧ｷ繝ｧ繧ｯ" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        繝輔Μ繧ｬ繝・(繝｡繧､) <span className="text-red-500 text-xs ml-1">蠢・・/span>
                      </label>
                      <input type="text" value={resumeData.profile.firstNameKana} onChange={(e) => handleProfileChange("firstNameKana", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="萓・ 繧ｿ繝ｭ繧ｦ" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      逕溷ｹｴ譛域律 <span className="text-red-500 text-xs ml-1">蠢・・/span>
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={resumeData.profile.birthday.year}
                        onChange={(e) => handleBirthdayChange("year", e.target.value)}
                        className="w-24 p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">蟷ｴ</option>
                        {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                      <span className="self-center">蟷ｴ</span>
                      <select
                        value={resumeData.profile.birthday.month}
                        onChange={(e) => handleBirthdayChange("month", e.target.value)}
                        className="w-20 p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">譛・/option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                          <option key={month} value={month}>{month}</option>
                        ))}
                      </select>
                      <span className="self-center">譛・/span>
                      <select
                        value={resumeData.profile.birthday.day}
                        onChange={(e) => handleBirthdayChange("day", e.target.value)}
                        className="w-20 p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">譌･</option>
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}</option>
                        ))}
                      </select>
                      <span className="self-center">譌･</span>
                      {resumeData.profile.birthday.year && resumeData.profile.birthday.month && resumeData.profile.birthday.day && (
                        <span className="self-center text-sm text-gray-600 ml-2">
                          ・域ｺ {calculateAge(`${resumeData.profile.birthday.year}-${resumeData.profile.birthday.month.padStart(2, '0')}-${resumeData.profile.birthday.day.padStart(2, '0')}`)} 豁ｳ・・                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsGraduationTableOpen(true)}
                      className="mt-2 flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <BookOpen size={16} />
                      蜊呈･ｭ蟷ｴ譛域掠隕玖｡ｨ繧定ｦ九ｋ
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">諤ｧ蛻･</label>
                      <select value={resumeData.profile.gender} onChange={(e) => handleProfileChange("gender", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
                        <option value="male">逕ｷ諤ｧ</option>
                        <option value="female">螂ｳ諤ｧ</option>
                        <option value="unspecified">險倩ｼ峨＠縺ｪ縺・/option>
                      </select>
                    </div>


                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        險ｼ譏主・逵・<span className="text-xs text-gray-500">(莉ｻ諢・</span>
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
                            <img src={resumeData.photoUrl} alt="險ｼ譏主・逵溘・繝ｬ繝薙Η繝ｼ" className="w-16 h-20 object-cover border border-gray-300 rounded" />
                            <button
                              type="button"
                              onClick={() => setAll({ photoUrl: "" })}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              蜑企勁
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">謗ｨ螂ｨ繧ｵ繧､繧ｺ: 邵ｦ36-40mm ﾃ・讓ｪ24-30mm縲・MB莉･荳・/p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">迴ｾ菴乗園</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        驛ｵ萓ｿ逡ｪ蜿ｷ <span className="text-red-500 text-xs ml-1">蠢・・/span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">縲・/span>
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
                          菴乗園讀懃ｴ｢
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        驛ｽ驕灘ｺ懃恁 <span className="text-red-500 text-xs ml-1">蠢・・/span>
                      </label>
                      <select value={resumeData.profile.address.prefecture} onChange={(e) => handleAddressChange("prefecture", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
                        <option value="蛹玲ｵｷ驕・>蛹玲ｵｷ驕・/option>
                        <option value="髱呈｣ｮ逵・>髱呈｣ｮ逵・/option>
                        <option value="蟯ｩ謇狗恁">蟯ｩ謇狗恁</option>
                        <option value="螳ｮ蝓守恁">螳ｮ蝓守恁</option>
                        <option value="遘狗伐逵・>遘狗伐逵・/option>
                        <option value="螻ｱ蠖｢逵・>螻ｱ蠖｢逵・/option>
                        <option value="遖丞ｳｶ逵・>遖丞ｳｶ逵・/option>
                        <option value="闌ｨ蝓守恁">闌ｨ蝓守恁</option>
                        <option value="譬・惠逵・>譬・惠逵・/option>
                        <option value="鄒､鬥ｬ逵・>鄒､鬥ｬ逵・/option>
                        <option value="蝓ｼ邇臥恁">蝓ｼ邇臥恁</option>
                        <option value="蜊・痩逵・>蜊・痩逵・/option>
                        <option value="譚ｱ莠ｬ驛ｽ">譚ｱ莠ｬ驛ｽ</option>
                        <option value="逾槫･亥ｷ晉恁">逾槫･亥ｷ晉恁</option>
                        <option value="譁ｰ貎溽恁">譁ｰ貎溽恁</option>
                        <option value="蟇悟ｱｱ逵・>蟇悟ｱｱ逵・/option>
                        <option value="遏ｳ蟾晉恁">遏ｳ蟾晉恁</option>
                        <option value="遖丈ｺ慕恁">遖丈ｺ慕恁</option>
                        <option value="螻ｱ譴ｨ逵・>螻ｱ譴ｨ逵・/option>
                        <option value="髟ｷ驥守恁">髟ｷ驥守恁</option>
                        <option value="蟯宣・逵・>蟯宣・逵・/option>
                        <option value="髱吝ｲ｡逵・>髱吝ｲ｡逵・/option>
                        <option value="諢帷衍逵・>諢帷衍逵・/option>
                        <option value="荳蛾㍾逵・>荳蛾㍾逵・/option>
                        <option value="貊玖ｳ逵・>貊玖ｳ逵・/option>
                        <option value="莠ｬ驛ｽ蠎・>莠ｬ驛ｽ蠎・/option>
                        <option value="螟ｧ髦ｪ蠎・>螟ｧ髦ｪ蠎・/option>
                        <option value="蜈ｵ蠎ｫ逵・>蜈ｵ蠎ｫ逵・/option>
                        <option value="螂郁憶逵・>螂郁憶逵・/option>
                        <option value="蜥梧ｭ悟ｱｱ逵・>蜥梧ｭ悟ｱｱ逵・/option>
                        <option value="魑･蜿也恁">魑･蜿也恁</option>
                        <option value="蟲ｶ譬ｹ逵・>蟲ｶ譬ｹ逵・/option>
                        <option value="蟯｡螻ｱ逵・>蟯｡螻ｱ逵・/option>
                        <option value="蠎・ｳｶ逵・>蠎・ｳｶ逵・/option>
                        <option value="螻ｱ蜿｣逵・>螻ｱ蜿｣逵・/option>
                        <option value="蠕ｳ蟲ｶ逵・>蠕ｳ蟲ｶ逵・/option>
                        <option value="鬥吝ｷ晉恁">鬥吝ｷ晉恁</option>
                        <option value="諢帛ｪ帷恁">諢帛ｪ帷恁</option>
                        <option value="鬮倡衍逵・>鬮倡衍逵・/option>
                        <option value="遖丞ｲ｡逵・>遖丞ｲ｡逵・/option>
                        <option value="菴占ｳ逵・>菴占ｳ逵・/option>
                        <option value="髟ｷ蟠守恁">髟ｷ蟠守恁</option>
                        <option value="辭頑悽逵・>辭頑悽逵・/option>
                        <option value="螟ｧ蛻・恁">螟ｧ蛻・恁</option>
                        <option value="螳ｮ蟠守恁">螳ｮ蟠守恁</option>
                        <option value="鮖ｿ蜈仙ｳｶ逵・>鮖ｿ蜈仙ｳｶ逵・/option>
                        <option value="豐也ｸ・恁">豐也ｸ・恁</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      蟶ょ玄逕ｺ譚代・逡ｪ蝨ｰ <span className="text-red-500 text-xs ml-1">蠢・・/span>
                    </label>
                    <input type="text" value={resumeData.profile.address.city} onChange={(e) => handleAddressChange("city", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="蜊・ｻ｣逕ｰ蛹ｺ蜊・ｻ｣逕ｰ1-1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      蟒ｺ迚ｩ蜷阪・驛ｨ螻狗分蜿ｷ <span className="text-xs text-gray-500">(莉ｻ諢・</span>
                    </label>
                    <input type="text" value={resumeData.profile.address.building} onChange={(e) => handleAddressChange("building", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="繝代Ξ繧ｹ繧ｵ繧､繝峨ン繝ｫ 101" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      菴乗園繝輔Μ繧ｬ繝・<span className="text-red-500 text-xs ml-1">蠢・・/span>
                    </label>
                    <input type="text" value={resumeData.profile.address.kana} onChange={(e) => handleAddressChange("kana", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="繝√Κ繝繧ｯ繝√Κ繝1-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        髮ｻ隧ｱ逡ｪ蜿ｷ <span className="text-red-500 text-xs ml-1">蠢・・/span>
                      </label>
                      <input type="tel" value={resumeData.profile.phone} onChange={(e) => handleProfileChange("phone", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="090-1234-5678" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ <span className="text-red-500 text-xs ml-1">蠢・・/span>
                        <span className="text-xs text-gray-500 ml-2">(PC繝｡繝ｼ繝ｫ謗ｨ螂ｨ)</span>
                      </label>
                      <input type="email" value={resumeData.profile.email} onChange={(e) => handleProfileChange("email", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="example@gmail.com" />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">騾｣邨｡蜈・(迴ｾ菴乗園莉･螟・</h2>
                <p className="text-sm text-gray-500 mb-4">窶ｻ迴ｾ菴乗園莉･螟悶↓騾｣邨｡繧貞ｸ梧悍縺吶ｋ蝣ｴ蜷医・縺ｿ險伜・縺励※縺上□縺輔＞</p>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        驛ｵ萓ｿ逡ｪ蜿ｷ
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
                          菴乗園讀懃ｴ｢
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        驛ｽ驕灘ｺ懃恁
                      </label>
                      <select value={resumeData.profile.contactAddress.prefecture} onChange={(e) => handleContactAddressChange("prefecture", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
                        <option value="蛹玲ｵｷ驕・>蛹玲ｵｷ驕・/option>
                        <option value="髱呈｣ｮ逵・>髱呈｣ｮ逵・/option>
                        <option value="蟯ｩ謇狗恁">蟯ｩ謇狗恁</option>
                        <option value="螳ｮ蝓守恁">螳ｮ蝓守恁</option>
                        <option value="遘狗伐逵・>遘狗伐逵・/option>
                        <option value="螻ｱ蠖｢逵・>螻ｱ蠖｢逵・/option>
                        <option value="遖丞ｳｶ逵・>遖丞ｳｶ逵・/option>
                        <option value="闌ｨ蝓守恁">闌ｨ蝓守恁</option>
                        <option value="譬・惠逵・>譬・惠逵・/option>
                        <option value="鄒､鬥ｬ逵・>鄒､鬥ｬ逵・/option>
                        <option value="蝓ｼ邇臥恁">蝓ｼ邇臥恁</option>
                        <option value="蜊・痩逵・>蜊・痩逵・/option>
                        <option value="譚ｱ莠ｬ驛ｽ">譚ｱ莠ｬ驛ｽ</option>
                        <option value="逾槫･亥ｷ晉恁">逾槫･亥ｷ晉恁</option>
                        <option value="譁ｰ貎溽恁">譁ｰ貎溽恁</option>
                        <option value="蟇悟ｱｱ逵・>蟇悟ｱｱ逵・/option>
                        <option value="遏ｳ蟾晉恁">遏ｳ蟾晉恁</option>
                        <option value="遖丈ｺ慕恁">遖丈ｺ慕恁</option>
                        <option value="螻ｱ譴ｨ逵・>螻ｱ譴ｨ逵・/option>
                        <option value="髟ｷ驥守恁">髟ｷ驥守恁</option>
                        <option value="蟯宣・逵・>蟯宣・逵・/option>
                        <option value="髱吝ｲ｡逵・>髱吝ｲ｡逵・/option>
                        <option value="諢帷衍逵・>諢帷衍逵・/option>
                        <option value="荳蛾㍾逵・>荳蛾㍾逵・/option>
                        <option value="貊玖ｳ逵・>貊玖ｳ逵・/option>
                        <option value="莠ｬ驛ｽ蠎・>莠ｬ驛ｽ蠎・/option>
                        <option value="螟ｧ髦ｪ蠎・>螟ｧ髦ｪ蠎・/option>
                        <option value="蜈ｵ蠎ｫ逵・>蜈ｵ蠎ｫ逵・/option>
                        <option value="螂郁憶逵・>螂郁憶逵・/option>
                        <option value="蜥梧ｭ悟ｱｱ逵・>蜥梧ｭ悟ｱｱ逵・/option>
                        <option value="魑･蜿也恁">魑･蜿也恁</option>
                        <option value="蟲ｶ譬ｹ逵・>蟲ｶ譬ｹ逵・/option>
                        <option value="蟯｡螻ｱ逵・>蟯｡螻ｱ逵・/option>
                        <option value="蠎・ｳｶ逵・>蠎・ｳｶ逵・/option>
                        <option value="螻ｱ蜿｣逵・>螻ｱ蜿｣逵・/option>
                        <option value="蠕ｳ蟲ｶ逵・>蠕ｳ蟲ｶ逵・/option>
                        <option value="鬥吝ｷ晉恁">鬥吝ｷ晉恁</option>
                        <option value="諢帛ｪ帷恁">諢帛ｪ帷恁</option>
                        <option value="鬮倡衍逵・>鬮倡衍逵・/option>
                        <option value="遖丞ｲ｡逵・>遖丞ｲ｡逵・/option>
                        <option value="菴占ｳ逵・>菴占ｳ逵・/option>
                        <option value="髟ｷ蟠守恁">髟ｷ蟠守恁</option>
                        <option value="辭頑悽逵・>辭頑悽逵・/option>
                        <option value="螟ｧ蛻・恁">螟ｧ蛻・恁</option>
                        <option value="螳ｮ蟠守恁">螳ｮ蟠守恁</option>
                        <option value="鮖ｿ蜈仙ｳｶ逵・>鮖ｿ蜈仙ｳｶ逵・/option>
                        <option value="豐也ｸ・恁">豐也ｸ・恁</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      蟶ょ玄逕ｺ譚代・逡ｪ蝨ｰ
                    </label>
                    <input type="text" value={resumeData.profile.contactAddress.city} onChange={(e) => handleContactAddressChange("city", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="蜊・ｻ｣逕ｰ蛹ｺ蜊・ｻ｣逕ｰ1-1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      蟒ｺ迚ｩ蜷阪・驛ｨ螻狗分蜿ｷ
                    </label>
                    <input type="text" value={resumeData.profile.contactAddress.building} onChange={(e) => handleContactAddressChange("building", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="繝代Ξ繧ｹ繧ｵ繧､繝峨ン繝ｫ 101" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      菴乗園繝輔Μ繧ｬ繝・                    </label>
                    <input type="text" value={resumeData.profile.contactAddress.kana} onChange={(e) => handleContactAddressChange("kana", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="繝√Κ繝繧ｯ繝√Κ繝1-1" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        髮ｻ隧ｱ逡ｪ蜿ｷ
                      </label>
                      <input type="tel" value={resumeData.profile.contactAddress.phone} onChange={(e) => handleContactAddressChange("phone", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="090-1234-5678" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ
                      </label>
                      <input type="email" value={resumeData.profile.contactAddress.email} onChange={(e) => handleContactAddressChange("email", e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="example@gmail.com" />
                    </div>
                  </div>
                </div>
              </section>

              {/* 譛ｬ莠ｺ蟶梧悍險伜・谺・*/}
              <section>
                <h2 className="text-lg font-bold text-gray-800 mb-6 border-l-4 border-blue-600 pl-3">
                  譛ｬ莠ｺ蟶梧悍險伜・谺・                  <span className="text-sm font-normal text-gray-500 ml-2">・井ｻｻ諢擾ｼ・/span>
                </h2>

                <div className="space-y-2">
                  <p className="text-xs text-gray-500">
                    蜍､蜍吝慍縲∝共蜍呎凾髢薙・壼共繝ｻ驟肴・縺励※縺ｻ縺励＞縺薙→縺ｪ縺ｩ縺後≠繧後・險伜・縺励※縺上□縺輔＞縲ら音縺ｫ縺ｪ縺代ｌ縺ｰ遨ｺ谺・・縺ｾ縺ｾ縺ｧ讒九＞縺ｾ縺帙ｓ縲・                  </p>

                  <textarea
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={resumeData.requests}
                    onChange={(e) => handleRequestsChange(e.target.value)}
                    placeholder="萓具ｼ臥ｬｬ莠梧眠蜊呈棧縺ｧ縺ｮ驕ｸ閠・ｒ蟶梧悍縺励∪縺吶ゑｼ丞ｮｶ譌上・莉玖ｭｷ縺ｮ縺溘ａ縲∝次蜑・→縺励※螟懷共縺ｯ荳榊庄縺ｧ縺吶ゅ縺ｪ縺ｩ"
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
                    <h2 className="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-3">蟄ｦ豁ｴ</h2>
                    <button onClick={addEducation} className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                      <Plus size={16} /> 霑ｽ蜉
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
                            <label className="block text-xs text-gray-500 mb-1">蜈･蟄ｦ/蜊呈･ｭ蟷ｴ譛・/label>
                            <div className="flex gap-2 items-center">
                              <input type="text" value={edu.startDate.year} onChange={(e) => handleEducationChange(index, "startDate.year", e.target.value)} className="w-16 p-2 border rounded text-sm" placeholder="YYYY" />
                              <span>/</span>
                              <input type="text" value={edu.startDate.month} onChange={(e) => handleEducationChange(index, "startDate.month", e.target.value)} className="w-10 p-2 border rounded text-sm" placeholder="MM" />
                            </div>
                            <div className="text-center text-gray-400 my-1">竊・/div>
                            <div className="flex gap-2 items-center">
                              <input type="text" value={edu.endDate.year} onChange={(e) => handleEducationChange(index, "endDate.year", e.target.value)} className="w-16 p-2 border rounded text-sm" placeholder="YYYY" />
                              <span>/</span>
                              <input type="text" value={edu.endDate.month} onChange={(e) => handleEducationChange(index, "endDate.month", e.target.value)} className="w-10 p-2 border rounded text-sm" placeholder="MM" />
                            </div>
                          </div>
                          <div className="md:col-span-9 space-y-3">
                            <div className="flex gap-4">
                              <input type="text" value={edu.schoolName} onChange={(e) => handleEducationChange(index, "schoolName", e.target.value)} className="flex-1 p-2 border rounded" placeholder="蟄ｦ譬｡蜷・ />
                              <select value={edu.status} onChange={(e) => handleEducationChange(index, "status", e.target.value)} className="p-2 border rounded w-32">
                                <option value="graduated">蜊呈･ｭ</option>
                                <option value="expected">蜊呈･ｭ隕玖ｾｼ</option>
                                <option value="enrolled">蝨ｨ蟄ｦ荳ｭ</option>
                                <option value="dropout">荳ｭ騾</option>
                              </select>
                            </div>
                            <input type="text" value={edu.department} onChange={(e) => handleEducationChange(index, "department", e.target.value)} className="w-full p-2 border rounded" placeholder="蟄ｦ驛ｨ繝ｻ蟄ｦ遘代・繧ｳ繝ｼ繧ｹ" />
                          </div>
                        </div>
                      </div>
                    ))}
                    {resumeData.education.length === 0 && <p className="text-center text-gray-400 py-4">蟄ｦ豁ｴ縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>}
                  </div>
                </section>

                {/* Work History */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-3">閨ｷ豁ｴ</h2>
                    <button onClick={addWork} className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                      <Plus size={16} /> 霑ｽ蜉
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
                            <label className="block text-xs text-gray-500 mb-1">蝨ｨ邀肴悄髢・/label>
                            <div className="flex gap-2 items-center">
                              <input type="text" value={work.startDate.year} onChange={(e) => handleWorkChange(index, "startDate.year", e.target.value)} className="w-16 p-2 border rounded text-sm" placeholder="YYYY" />
                              <span>/</span>
                              <input type="text" value={work.startDate.month} onChange={(e) => handleWorkChange(index, "startDate.month", e.target.value)} className="w-10 p-2 border rounded text-sm" placeholder="MM" />
                            </div>
                            <div className="text-center text-gray-400 my-1">竊・/div>
                            <div className="flex gap-2 items-center">
                              {work.isCurrent ? (
                                <span className="text-sm font-bold text-green-600 py-2">迴ｾ蝨ｨ繧ょ惠閨ｷ荳ｭ</span>
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
                              蝨ｨ閨ｷ荳ｭ
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
                                placeholder="莨夂､ｾ蜷搾ｼ井ｾ具ｼ壽ｪ蠑丈ｼ夂､ｾ繝阪が繧｢繧ｯ繝茨ｼ・
                              />
                              <input
                                type="text"
                                value={work.department || ""}
                                onChange={(e) => handleWorkChange(index, "department", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="謇螻樣Κ鄂ｲ・井ｾ具ｼ壻ｺｺ譚千ｴｹ莉倶ｺ区･ｭ驛ｨ・・
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={work.position || ""}
                                onChange={(e) => handleWorkChange(index, "position", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="蠖ｹ閨ｷ繝ｻ繝昴ず繧ｷ繝ｧ繝ｳ・井ｾ具ｼ壹く繝｣繝ｪ繧｢繧｢繝峨ヰ繧､繧ｶ繝ｼ・・
                              />
                              <input
                                type="text"
                                value={work.employmentType || ""}
                                onChange={(e) => handleWorkChange(index, "employmentType", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="髮・畑蠖｢諷具ｼ井ｾ具ｼ壽ｭ｣遉ｾ蜩｡・丞･醍ｴ・､ｾ蜩｡・・
                              />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="text"
                                value={work.companyCapital || ""}
                                onChange={(e) => handleWorkChange(index, "companyCapital", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="雉・悽驥托ｼ井ｾ具ｼ・,000荳・・・・
                              />
                              <input
                                type="text"
                                value={work.employeeCount || ""}
                                onChange={(e) => handleWorkChange(index, "employeeCount", e.target.value)}
                                className="w-full p-2 border rounded"
                                placeholder="蠕捺･ｭ蜩｡謨ｰ・井ｾ具ｼ・0蜷搾ｼ・
                              />
                            </div>

                            {/* Business description */}
                            <textarea
                              value={work.businessDescription || ""}
                              onChange={(e) => handleWorkChange(index, "businessDescription", e.target.value)}
                              className="w-full p-2 border rounded h-16 text-sm"
                              placeholder="莠区･ｭ蜀・ｮｹ・井ｼ夂､ｾ繝ｻ驛ｨ鄂ｲ縺ｮ讎りｦ・ｼ・
                            />

                            {/* Responsibilities */}
                            <textarea
                              value={work.responsibilities || ""}
                              onChange={(e) => handleWorkChange(index, "responsibilities", e.target.value)}
                              className="w-full p-2 border rounded h-20 text-sm"
                              placeholder="諡・ｽ捺･ｭ蜍吶・隧ｳ邏ｰ・井ｾ具ｼ壽ｳ穂ｺｺ蝟ｶ讌ｭ縲∵眠隕城幕諡薙∵ｱり・閠・擇隲・↑縺ｩ・・
                            />

                            {/* Achievements */}
                            <textarea
                              value={work.achievements || ""}
                              onChange={(e) => handleWorkChange(index, "achievements", e.target.value)}
                              className="w-full p-2 border rounded h-20 text-sm"
                              placeholder="螳溽ｸｾ繝ｻ謌先棡・域焚蛟､繧貞性繧蜈ｷ菴鍋噪縺ｪ謌先棡繧定ｨ伜・・・
                            />

                            {/* Environment */}
                            <textarea
                              value={work.environment || ""}
                              onChange={(e) => handleWorkChange(index, "environment", e.target.value)}
                              className="w-full p-2 border rounded h-16 text-sm"
                              placeholder="迺ｰ蠅・・繝・・繝ｫ・井ｾ具ｼ啗indows / Office365 / Salesforce 縺ｪ縺ｩ・・
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {resumeData.workHistory.length === 0 && <p className="text-center text-gray-400 py-4">閨ｷ豁ｴ縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>}
                  </div>
                </section>

                {/* Certifications */}
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 border-l-4 border-blue-600 pl-3">蜈崎ｨｱ繝ｻ雉・ｼ</h2>
                    <button onClick={addCert} className="flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">
                      <Plus size={16} /> 霑ｽ蜉
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
                        <input type="text" value={cert.name} onChange={(e) => handleCertChange(index, "name", e.target.value)} className="flex-1 p-2 border rounded" placeholder="雉・ｼ蜷咲ｧｰ (萓・ 譎ｮ騾夊・蜍戊ｻ顔ｬｬ荳遞ｮ驕玖ｻ｢蜈崎ｨｱ)" />
                        <button onClick={() => removeCert(index)} className="text-gray-400 hover:text-red-500">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                    {resumeData.certifications.length === 0 && <p className="text-center text-gray-400 py-4">雉・ｼ縺檎匳骭ｲ縺輔ｌ縺ｦ縺・∪縺帙ｓ</p>}
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
                        蠢懷供閠・ョ繝ｼ繧ｿ縺ｮ閾ｪ蜍戊ｧ｣譫舌・荳諡ｬ蜿肴丐
                      </h3>
                      <p className="text-sm text-slate-500">
                        豎ゆｺｺ蟐剃ｽ難ｼ・oda, 繝槭う繝翫ン遲会ｼ峨・蠢懷供閠・・繝ｼ繧ｸ繧偵さ繝斐・縺励※雋ｼ繧贋ｻ倥￠繧九□縺代〒縲∝・繝輔か繝ｼ繝縺ｸ閾ｪ蜍募渚譏縺励∪縺吶・                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <textarea
                      className="w-full h-48 p-4 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none text-sm bg-white"
                      placeholder="蟐剃ｽ薙・蠢懷供諠・ｱ繧偵％縺薙↓雋ｼ繧贋ｻ倥￠縺ｦ縺上□縺輔＞..."
                      value={rawPasteText}
                      onChange={(e) => setRawPasteText(e.target.value)}
                    />
                    <button
                      onClick={handleNormalize}
                      disabled={isNormalizing || !rawPasteText.trim()}
                      className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 active:scale-[0.98]"
                    >
                      {isNormalizing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          AI縺悟・繝・・繧ｿ繧定ｧ｣譫舌・蜿肴丐荳ｭ...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5" />
                          AI縺ｧ蜈･蜉帙ヵ繧ｩ繝ｼ繝縺ｫ荳諡ｬ蜿肴丐縺吶ｋ
                        </>
                      )}
                    </button>

                    {/* Debug Info */}
                    {lastAiResult && (
                      <div className="mt-4 p-4 bg-slate-100 rounded-xl border border-slate-200">
                        <details className="text-xs">
                          <summary className="cursor-pointer font-bold text-slate-600 flex items-center gap-1">
                            <Search size={14} /> [繝・ヰ繝・げ] AI隗｣譫千ｵ先棡縺ｮ隧ｳ邏ｰ繧定｡ｨ遉ｺ
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
                    <h3 className="text-md font-bold text-blue-800 mb-1">AI閾ｪ蟾ｱPR繝ｻ蠢玲悍蜍墓ｩ溘ず繧ｧ繝阪Ξ繝ｼ繧ｿ繝ｼ</h3>
                    <p className="text-xs text-blue-600">
                      閨ｷ遞ｮ繧帝∈繧薙〒繧ｭ繝ｼ繝ｯ繝ｼ繝峨ｒ蜈･蜉帙＠縲∵枚遶繧定・蜍慕函謌舌＠縺ｾ縺吶・                    </p>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-bold text-gray-700 mb-2">蟶梧悍閨ｷ遞ｮ繧帝∈謚・/label>
                    <select
                      className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                      value={selectedJob}
                      onChange={(e) => setSelectedJob(e.target.value as JobType)}
                    >
                      <option value="">驕ｸ謚槭＠縺ｦ縺上□縺輔＞</option>
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
                          <h3 className="font-semibold text-gray-700 border-b pb-2">諠・ｱ縺ｮ蜈･蜉・/h3>
                          <input
                            type="text"
                            placeholder="縲仙燕閨ｷ縲・萓・ 謗･螳｢縲∝霧讌ｭ)"
                            className="w-full p-3 border border-gray-300 rounded-lg"
                            onChange={(e) => handleAiInputChange("previousJob", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="縲仙級蠑ｷ蜀・ｮｹ縲・萓・ Java, IT繝代せ繝昴・繝・"
                            className="w-full p-3 border border-gray-300 rounded-lg"
                            onChange={(e) => handleAiInputChange("studyContent", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="縲仙・菴鍋噪縺ｪ繧ｨ繝斐た繝ｼ繝峨・鬆大ｼｵ縺｣縺溘％縺ｨ)"
                            className="w-full p-3 border border-gray-300 rounded-lg"
                            onChange={(e) => handleAiInputChange("episode", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="縲先・譫懊・萓・ 螢ｲ荳・20%驕疲・)"
                            className="w-full p-3 border border-gray-300 rounded-lg"
                            onChange={(e) => handleAiInputChange("result", e.target.value)}
                          />
                          <button
                            onClick={handleGenerate}
                            className="mt-4 w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow-md flex items-center justify-center gap-2"
                          >
                            <Wand2 size={20} />
                            譁・ｫ繧堤函謌舌☆繧・                          </button>
                        </>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center text-gray-500">
                          <Wand2 size={48} className="mb-4 text-gray-300" />
                          <p>AI逕滓・讖溯・繧剃ｽｿ逕ｨ縺吶ｋ縺ｫ縺ｯ縲・br />荳翫〒閨ｷ遞ｮ繧帝∈謚槭＠縺ｦ縺上□縺輔＞縲・/p>
                        </div>
                      )}
                    </div>

                    {/* Right: Outputs */}
                    <div className="space-y-6">
                      <h3 className="font-semibold text-gray-700 border-b pb-2">逕滓・邨先棡 / 邱ｨ髮・/h3>

                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-bold text-gray-700">蠢玲悍蜍墓ｩ・/label>
                          <button
                            onClick={() => copyToClipboard(resumeData.motivation)}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Copy size={14} /> 繧ｳ繝斐・
                          </button>
                        </div>
                        <textarea
                          className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                          value={resumeData.motivation}
                          onChange={(e) => handleMotivationChange(e.target.value)}
                          placeholder="縺薙％縺ｫ逕滓・縺輔ｌ縺溷ｿ玲悍蜍墓ｩ溘′陦ｨ遉ｺ縺輔ｌ縺ｾ縺・
                        />
                      </div>

                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <label className="text-sm font-bold text-gray-700">閾ｪ蟾ｱPR</label>
                          <button
                            onClick={() => copyToClipboard(resumeData.selfPromotion)}
                            className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            <Copy size={14} /> 繧ｳ繝斐・
                          </button>
                        </div>
                        <textarea
                          className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                          value={resumeData.selfPromotion}
                          onChange={(e) => handleSelfPromotionChange(e.target.value)}
                          placeholder="縺薙％縺ｫ逕滓・縺輔ｌ縺溯・蟾ｱPR縺瑚｡ｨ遉ｺ縺輔ｌ縺ｾ縺・
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
                  閨ｷ蜍咏ｵ梧ｭｴ譖ｸ繝・く繧ｹ繝・                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(buildCareerText(resumeData))}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                  >
                    <Copy size={16} />
                    繝・く繧ｹ繝医ｒ繧ｳ繝斐・
                  </button>
                  <button
                    onClick={handlePrintCareerPdf}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    <Download size={16} />
                    PDF繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝・                  </button>
                </div>
              </div>

              {/* Career Summary Input Fields */}
              <section className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    閨ｷ蜍呵ｦ∫ｴ・ｼ・areer Summary・・                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={resumeData.careerSummary || ""}
                    onChange={(e) =>
                      setAll({ careerSummary: e.target.value })
                    }
                    placeholder="1縲・陦後〒縺薙ｌ縺ｾ縺ｧ縺ｮ邨碁ｨ薙・隕∫ｴ・ｒ蜈･蜉帙＠縺ｾ縺吶らｩｺ谺・・蝣ｴ蜷医・閾ｪ蜍慕函謌舌＆繧後∪縺吶・
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    豢ｻ縺九○繧狗ｵ碁ｨ薙・遏･隴倥・繧ｹ繧ｭ繝ｫ・・kills Summary・・                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={resumeData.skillsSummary || ""}
                    onChange={(e) =>
                      setAll({ skillsSummary: e.target.value })
                    }
                    placeholder="謇ｱ縺医ｋ謚陦薙・繝・・繝ｫ繝ｻ讌ｭ蜍吶せ繧ｭ繝ｫ縺ｪ縺ｩ繧貞・蜉帙＠縺ｾ縺吶・
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    閾ｪ蟾ｱPR・・areer PR・・                  </label>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={resumeData.careerPr || ""}
                    onChange={(e) =>
                      setAll({ careerPr: e.target.value })
                    }
                    placeholder="閨ｷ蜍咏ｵ梧ｭｴ譖ｸ逕ｨ縺ｮ閾ｪ蟾ｱPR繧貞・蜉帙＠縺ｾ縺吶らｩｺ谺・・蝣ｴ蜷医・螻･豁ｴ譖ｸ縺ｮ閾ｪ蟾ｱPR縺御ｽｿ繧上ｌ縺ｾ縺吶・
                    rows={4}
                  />
                </div>
              </section>

              <p className="text-sm text-gray-500">
                縲悟渕譛ｬ諠・ｱ縲阪悟ｭｦ豁ｴ繝ｻ閨ｷ豁ｴ縲阪窟I菴懈・縲阪〒蜈･蜉帙＠縺溷・螳ｹ縺九ｉ縲・                閨ｷ蜍咏ｵ梧ｭｴ譖ｸ縺ｮ譁・ｫ繧定・蜍慕函謌舌＠縺ｦ縺・∪縺吶・                繝・く繧ｹ繝医ｒ繧ｳ繝斐・縺励※Word繧Жoogle繝峨く繝･繝｡繝ｳ繝医↓雋ｼ繧贋ｻ倥￠縺ｦ縺泌茜逕ｨ縺上□縺輔＞縲・              </p>

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
                謗ｨ阮ｦ譁・ｼ医お繝ｼ繧ｸ繧ｧ繝ｳ繝亥髄縺托ｼ・              </h2>

              {/* Input form for agent-only fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    謗ｨ阮ｦ蜈井ｼ∵･ｭ蜷・                  </label>
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
                    placeholder="萓具ｼ画ｪ蠑丈ｼ夂､ｾ縲・・
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    謗ｨ阮ｦ繝昴ず繧ｷ繝ｧ繝ｳ
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
                    placeholder="萓具ｼ峨う繝ｳ繝輔Λ繧ｨ繝ｳ繧ｸ繝九い・磯°逕ｨ繝ｻ菫晏ｮ茨ｼ・
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    邱剰ｩ包ｼ医お繝ｼ繧ｸ繧ｧ繝ｳ繝医さ繝｡繝ｳ繝茨ｼ・                  </label>
                  <textarea
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={recommendationInput.summary}
                    onChange={(e) =>
                      setRecommendationInput((prev) => ({
                        ...prev,
                        summary: e.target.value,
                      }))
                    }
                    placeholder="蛟呵｣懆・・莠ｺ譟・・邱丞粋逧・↑蜊ｰ雎｡繧堤ｰ｡貎斐↓險伜・縺励∪縺吶よ悴蜈･蜉帙・蝣ｴ蜷医・繝・Φ繝励Ξ繝ｼ繝域枚縺瑚・蜍戊｣懷ｮ後＆繧後∪縺吶・
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    迚ｹ縺ｫ謗ｨ縺励◆縺・・繧､繝ｳ繝・                  </label>
                  <textarea
                    className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                    value={recommendationInput.strengths}
                    onChange={(e) =>
                      setRecommendationInput((prev) => ({
                        ...prev,
                        strengths: e.target.value,
                      }))
                    }
                    placeholder="萓具ｼ臥樟閨ｷ縺ｧ縺ｮ謨ｰ蛟､螳溽ｸｾ縲∫ｶ咏ｶ壼鴨縲√さ繝溘Η繝九こ繝ｼ繧ｷ繝ｧ繝ｳ蜉帙↑縺ｩ"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    縺皮蕗諢上＞縺溘□縺阪◆縺・せ
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
                    placeholder="萓具ｼ臥ｵ碁ｨ灘ｹｴ謨ｰ縲∝共蜍吝慍蛻ｶ邏・√％繧後°繧峨く繝｣繝・メ繧｢繝・・縺悟ｿ・ｦ√↑鬆伜沺縺ｪ縺ｩ"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    雋ｴ遉ｾ繝昴ず繧ｷ繝ｧ繝ｳ縺ｨ縺ｮ繝槭ャ繝∫炊逕ｱ
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
                    placeholder="莨∵･ｭ逅・ｧ｣繝ｻ繝昴ず繧ｷ繝ｧ繝ｳ隕∽ｻｶ繧定ｸ上∪縺医◆繝槭ャ繝∫炊逕ｱ繧定ｨ伜・縺励∪縺吶よ悴蜈･蜉帙・蝣ｴ蜷医・豎守畑繝・Φ繝励Ξ繝ｼ繝医ｒ菴ｿ逕ｨ縺励∪縺吶・
                  />
                </div>
              </div>

              {/* Generated recommendation text */}
              <div className="space-y-3">
                <div className="flex  justify-between items-center">
                  <h3 className="text-md font-semibold text-gray-800">
                    逕滓・縺輔ｌ縺滓耳阮ｦ譁・                  </h3>
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
                      繧ｳ繝斐・
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
                    螻･豁ｴ譖ｸ繝励Ξ繝薙Η繝ｼ
                  </button>
                  <button
                    onClick={() => setPreviewMode("career")}
                    className={`px-4 py-2 text-sm rounded-lg border-2 transition ${previewMode === "career"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                      }`}
                  >
                    閨ｷ蜍咏ｵ梧ｭｴ譖ｸ繝励Ξ繝薙Η繝ｼ
                  </button>
                  <button
                    onClick={() => setPreviewMode("recommendation")}
                    className={`px-4 py-2 text-sm rounded-lg border-2 transition ${previewMode === "recommendation"
                      ? "border-blue-600 bg-blue-50 text-blue-700 font-semibold"
                      : "border-gray-300 bg-white text-gray-700 hover:border-blue-400"
                      }`}
                  >
                    謗ｨ阮ｦ譁・・繝ｬ繝薙Η繝ｼ
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
                      謗ｨ阮ｦ譁⑰DF繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝・                    </button>
                  ) : (
                    <button
                      onClick={handlePrintPreviewPdf}
                      className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition"
                    >
                      <Download size={20} />
                      PDF繧偵ム繧ｦ繝ｳ繝ｭ繝ｼ繝・                    </button>
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

      {/* Warnings Modal */}
      {isWarningModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <div className="p-2 bg-amber-500 rounded-full text-white">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">隗｣譫千ｵ先棡縺ｮ遒ｺ隱・/h3>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-slate-600 font-medium text-sm">莉･荳九・鬆・岼繧定・蜍慕噪縺ｫ菫ｮ豁｣繝ｻ謨ｴ蠖｢縺励∪縺励◆・・/p>
              <ul className="space-y-2">
                {normalizationWarnings.map((warning, i) => (
                  <li key={i} className="flex gap-2 text-sm text-amber-700 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                    <span>繝ｻ</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  窶ｻAI縺ｮ謗ｨ貂ｬ繧貞性繧縺溘ａ縲∝渚譏蠕後↓蠢・★蜷・・岼・育音縺ｫ蟄ｦ豁ｴ繝ｻ閨ｷ豁ｴ縺ｮ蟷ｴ譛茨ｼ峨′豁｣縺励＞縺九＃遒ｺ隱阪￥縺縺輔＞縲・                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setIsWarningModalOpen(false)}
                className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all text-sm"
              >
                繧ｭ繝｣繝ｳ繧ｻ繝ｫ
              </button>
              <button
                onClick={applyPendingData}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all text-sm"
              >
                繝輔か繝ｼ繝縺ｫ蜿肴丐縺吶ｋ
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );
}
