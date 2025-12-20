"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { JOB_TEMPLATES, JobType } from "@/lib/data/jobTemplates";
import { generateText, UserInput } from "@/lib/generator";
import {
  Calendar, User, FileText, Wand2, Download, Copy, Loader2, Plus,
  Trash2, Search, BookOpen, MessageSquare, Briefcase, GraduationCap,
  Award, Settings, Sparkles, CheckCircle2
} from "lucide-react";
import { ResumeData } from "@/types/resume";
import { normalizeText, limitTextLength, MOTIVATION_MAX_LENGTH, REQUESTS_MAX_LENGTH, toHalfWidth } from "@/lib/textUtils";
import { useResumeStore } from "@/lib/store/resumeStore";
import { initialResumeData } from "@/lib/initialResumeData";

// New UI Components
import { AppHeader } from "@/components/layout/AppHeader";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { SectionCard } from "@/components/editor/SectionCard";
import { FieldInput, FieldTextarea } from "@/components/editor/FieldInputs";
import { AccordionItem } from "@/components/editor/AccordionItem";
import { PreviewFrame } from "@/components/preview/PreviewFrame";
import GraduationTableModal from "@/components/GraduationTableModal";

async function fetchAddressByPostalCode(postalCode: string) {
  const normalized = postalCode.replace(/[^\d]/g, "");
  if (!normalized || normalized.length < 7) return null;
  const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${normalized}`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.status !== 200 || !data.results || data.results.length === 0) return null;
  const r = data.results[0];
  return {
    prefecture: r.address1 ?? "",
    city: (r.address2 ?? "") + (r.address3 ?? ""),
    town: "",
    prefectureKana: r.kana1 ?? "",
    cityKana: (r.kana2 ?? "") + (r.kana3 ?? ""),
    townKana: "",
  };
}

export default function ResumeBuilder() {
  const [activeSection, setActiveSection] = useState("profile");
  const [isSaving, setIsSaving] = useState(false);
  const [isGraduationTableOpen, setIsGraduationTableOpen] = useState(false);

  // Zustand Store
  const hasHydrated = useResumeStore((s) => s.hasHydrated);
  const resumeData = useResumeStore((s) => s.resume);
  const setAll = useResumeStore((s) => s.setAll);
  const setByPath = useResumeStore((s) => s.setByPath);

  // AI & Local States
  const [rawPasteText, setRawPasteText] = useState("");
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobType | "">("");
  const [input, setInput] = useState<UserInput>({});
  const [normalizationWarnings, setNormalizationWarnings] = useState<string[]>([]);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [pendingResumeData, setPendingResumeData] = useState<ResumeData | null>(null);

  // Completion calculation (simplified)
  const completion = {
    profile: !!(resumeData.profile.lastName && resumeData.profile.email),
    work: resumeData.workHistory.length > 0,
    education: resumeData.education.length > 0,
    skills: !!resumeData.skillsSummary,
    certifications: resumeData.certifications.length > 0,
    pr: !!(resumeData.selfPromotion || resumeData.motivation),
    ai: false
  };

  // Autosave simulation
  useEffect(() => {
    if (!hasHydrated) return;
    setIsSaving(true);
    const timeout = setTimeout(() => setIsSaving(false), 800);
    return () => clearTimeout(timeout);
  }, [resumeData, hasHydrated]);

  if (!hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="animate-spin text-indigo-600 w-8 h-8" />
      </div>
    );
  }

  // --- Handlers ---
  const handleDownloadPdf = () => {
    // PDF export logic will be triggered in the iframe or via common utility
    alert("PDF出力機能を準備中です。プレビュー画面から印刷（Cmd+P）でも出力可能です。");
  };

  const handleProfileChange = (field: string, value: string) => {
    let val = value;
    if (field === 'phone' || field === 'postalCode') val = toHalfWidth(value);
    setByPath(`profile.${field}`, val);
  };

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

  const handleNormalize = async () => {
    if (!rawPasteText.trim()) return;
    setIsNormalizing(true);
    try {
      const res = await fetch("/api/normalize/resume", {
        method: "POST",
        body: JSON.stringify({ text: rawPasteText }),
      });
      const result = await res.json();
      if (result.ok) {
        setPendingResumeData(result.resumeData);
        setNormalizationWarnings(result.warnings || []);
        setIsWarningModalOpen(true);
      } else {
        alert("解析に失敗しました: " + result.error);
      }
    } catch (err) {
      alert("通信エラーが発生しました");
    } finally {
      setIsNormalizing(false);
    }
  };

  const applyPendingData = () => {
    if (pendingResumeData) {
      setAll(pendingResumeData);
      setIsWarningModalOpen(false);
      setRawPasteText("");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
      <AppHeader isSaving={isSaving} onDownload={handleDownloadPdf} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <SidebarNav
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          completion={completion}
        />

        {/* Center Editor */}
        <main className="flex-1 overflow-y-auto px-8 py-10 scroll-smooth">
          <div className="max-w-3xl mx-auto">

            {/* Profile Section */}
            {activeSection === "profile" && (
              <SectionCard title="基本情報" description="氏名、住所、連絡先などのプロフィールを入力します。" icon={<User size={20} />}>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <FieldInput
                    label="姓"
                    value={resumeData.profile.lastName}
                    onChange={(e) => handleProfileChange("lastName", e.target.value)}
                    placeholder="山田"
                  />
                  <FieldInput
                    label="名"
                    value={resumeData.profile.firstName}
                    onChange={(e) => handleProfileChange("firstName", e.target.value)}
                    placeholder="太郎"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <FieldInput
                    label="セイ"
                    value={resumeData.profile.lastNameKana}
                    onChange={(e) => handleProfileChange("lastNameKana", e.target.value)}
                    placeholder="ヤマダ"
                  />
                  <FieldInput
                    label="メイ"
                    value={resumeData.profile.firstNameKana}
                    onChange={(e) => handleProfileChange("firstNameKana", e.target.value)}
                    placeholder="タロウ"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <FieldInput
                    label="メールアドレス"
                    type="email"
                    value={resumeData.profile.email}
                    onChange={(e) => handleProfileChange("email", e.target.value)}
                    placeholder="example@mail.com"
                  />
                  <FieldInput
                    label="電話番号"
                    value={resumeData.profile.phone}
                    onChange={(e) => handleProfileChange("phone", e.target.value)}
                    placeholder="09012345678"
                  />
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4 items-end">
                    <FieldInput
                      label="郵便番号"
                      value={resumeData.profile.address.postalCode}
                      onChange={(e) => setByPath("profile.address.postalCode", toHalfWidth(e.target.value))}
                      placeholder="123-4567"
                    />
                    <button
                      onClick={async () => {
                        const addr = await fetchAddressByPostalCode(resumeData.profile.address.postalCode);
                        if (addr) {
                          setByPath("profile.address.prefecture", addr.prefecture);
                          setByPath("profile.address.city", addr.city);
                          setByPath("profile.address.kana", addr.cityKana);
                        }
                      }}
                      className="h-11 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-xs font-bold transition-colors"
                    >
                      住所検索
                    </button>
                  </div>
                  <FieldInput
                    label="市区町村・番地"
                    value={resumeData.profile.address.city}
                    onChange={(e) => setByPath("profile.address.city", e.target.value)}
                    placeholder="港区六本木 1-2-3"
                  />
                </div>
              </SectionCard>
            )}

            {/* Work History Section */}
            {activeSection === "work" && (
              <SectionCard
                title="職務経歴"
                description="これまでの職歴を古い順に登録します。"
                icon={<Briefcase size={20} />}
                actions={
                  <button onClick={addWork} className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <Plus size={16} /> 追加
                  </button>
                }
              >
                {resumeData.workHistory.map((work, index) => (
                  <AccordionItem
                    key={work.id}
                    title={work.companyName || "会社名未入力"}
                    subtitle={`${work.startDate.year}/${work.startDate.month} 〜 ${work.isCurrent ? "現在" : `${work.endDate.year}/${work.endDate.month}`}`}
                    onDelete={() => setAll({ workHistory: resumeData.workHistory.filter((_, i) => i !== index) })}
                  >
                    <div className="space-y-4">
                      <FieldInput
                        label="会社名"
                        value={work.companyName}
                        onChange={(e) => setByPath(`workHistory.${index}.companyName`, e.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex gap-2">
                          <FieldInput label="開始年" value={work.startDate.year} onChange={(e) => setByPath(`workHistory.${index}.startDate.year`, toHalfWidth(e.target.value))} placeholder="YYYY" />
                          <FieldInput label="開始月" value={work.startDate.month} onChange={(e) => setByPath(`workHistory.${index}.startDate.month`, toHalfWidth(e.target.value))} placeholder="MM" />
                        </div>
                        <div className="flex gap-2">
                          {!work.isCurrent && (
                            <>
                              <FieldInput label="終了年" value={work.endDate.year} onChange={(e) => setByPath(`workHistory.${index}.endDate.year`, toHalfWidth(e.target.value))} placeholder="YYYY" />
                              <FieldInput label="終了月" value={work.endDate.month} onChange={(e) => setByPath(`workHistory.${index}.endDate.month`, toHalfWidth(e.target.value))} placeholder="MM" />
                            </>
                          )}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
                        <input type="checkbox" checked={work.isCurrent} onChange={(e) => setByPath(`workHistory.${index}.isCurrent`, e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                        現在も在職中
                      </label>
                      <FieldTextarea
                        label="業務内容"
                        value={work.responsibilities}
                        onChange={(e) => setByPath(`workHistory.${index}.responsibilities`, e.target.value)}
                        help="主要な役割やプロジェクト、実績を箇条書きで記入します。"
                      />
                    </div>
                  </AccordionItem>
                ))}
                {resumeData.workHistory.length === 0 && (
                  <div className="text-center py-12 bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
                    <Briefcase size={40} className="mx-auto text-zinc-300 mb-3" />
                    <p className="text-sm text-zinc-500">職歴が追加されていません</p>
                    <button onClick={addWork} className="mt-4 text-sm font-bold text-indigo-600">
                      最初の職歴を追加する
                    </button>
                  </div>
                )}
              </SectionCard>
            )}

            {/* Education Section */}
            {activeSection === "education" && (
              <SectionCard
                title="学歴"
                description="高校卒業以降の学歴を入力します。"
                icon={<GraduationCap size={20} />}
                actions={
                  <button onClick={addEducation} className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
                    <Plus size={16} /> 追加
                  </button>
                }
              >
                {resumeData.education.map((edu, index) => (
                  <AccordionItem
                    key={edu.id}
                    title={edu.schoolName || "学校名未入力"}
                    subtitle={`${edu.startDate.year}/${edu.startDate.month} 〜 ${edu.endDate.year}/${edu.endDate.month}`}
                    onDelete={() => setAll({ education: resumeData.education.filter((_, i) => i !== index) })}
                  >
                    <div className="space-y-4">
                      <FieldInput label="学校名" value={edu.schoolName} onChange={(e) => setByPath(`education.${index}.schoolName`, e.target.value)} />
                      <FieldInput label="学部・学科" value={edu.department} onChange={(e) => setByPath(`education.${index}.department`, e.target.value)} />
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex gap-2">
                          <FieldInput label="入学年" value={edu.startDate.year} onChange={(e) => setByPath(`education.${index}.startDate.year`, toHalfWidth(e.target.value))} />
                          <FieldInput label="入学月" value={edu.startDate.month} onChange={(e) => setByPath(`education.${index}.startDate.month`, toHalfWidth(e.target.value))} />
                        </div>
                        <div className="flex gap-2">
                          <FieldInput label="卒業年" value={edu.endDate.year} onChange={(e) => setByPath(`education.${index}.endDate.year`, toHalfWidth(e.target.value))} />
                          <FieldInput label="卒業月" value={edu.endDate.month} onChange={(e) => setByPath(`education.${index}.endDate.month`, toHalfWidth(e.target.value))} />
                        </div>
                      </div>
                    </div>
                  </AccordionItem>
                ))}
                <button
                  onClick={() => setIsGraduationTableOpen(true)}
                  className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-bold text-zinc-500 hover:bg-zinc-100 transition-colors"
                >
                  <BookOpen size={16} /> 卒業年度早見表を表示
                </button>
              </SectionCard>
            )}

            {/* AI Integration Section */}
            {activeSection === "ai" && (
              <SectionCard title="AI一括入力" description="求人媒体のテキストを貼り付けるだけで、フォームに自動反映します。" icon={<Sparkles size={20} />}>
                <div className="space-y-4">
                  <FieldTextarea
                    label="テキストを貼り付け"
                    placeholder="doda, マイナビ等の応募者詳細画面をCtrl+Aで全選択してコピーし、ここに貼り付けてください。"
                    value={rawPasteText}
                    onChange={(e) => setRawPasteText(e.target.value)}
                    className="min-h-[200px]"
                  />
                  <button
                    onClick={handleNormalize}
                    disabled={isNormalizing || !rawPasteText.trim()}
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-200 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-3"
                  >
                    {isNormalizing ? <Loader2 className="animate-spin" /> : <Wand2 size={20} />}
                    {isNormalizing ? "AI解析中..." : "AIで解析して入力する"}
                  </button>
                </div>
              </SectionCard>
            )}

            {/* Default Sections: PR, Skills, etc. */}
            {activeSection === "skills" && (
              <SectionCard title="スキル・知識" description="活かせるスキル、経験、使用可能ツールなどを入力します。" icon={<Settings size={20} />}>
                <FieldTextarea
                  label="スキル要約"
                  value={resumeData.skillsSummary}
                  onChange={(e) => setAll({ skillsSummary: e.target.value })}
                  placeholder="例：・MOS Specialist (Excel/Word)&#10;・Salesforceによる顧客管理 3年&#10;・TOEIC 750点"
                />
              </SectionCard>
            )}

            {activeSection === "pr" && (
              <SectionCard title="自己PR・志望動機" description="あなたの魅力を伝える文章を作成します。" icon={<FileText size={20} />}>
                <div className="space-y-6">
                  <FieldTextarea
                    label="自己PR"
                    value={resumeData.selfPromotion}
                    onChange={(e) => setAll({ selfPromotion: e.target.value })}
                    rows={8}
                  />
                  <FieldTextarea
                    label="志望動機"
                    value={resumeData.motivation}
                    onChange={(e) => setAll({ motivation: limitTextLength(e.target.value, MOTIVATION_MAX_LENGTH) })}
                    help={`${resumeData.motivation.length} / ${MOTIVATION_MAX_LENGTH} 文字`}
                    rows={6}
                  />
                </div>
              </SectionCard>
            )}

          </div>
        </main>

        {/* Right Preview Frame */}
        <aside className="w-[500px] lg:w-[600px] xl:w-[700px] h-full hidden md:block">
          <PreviewFrame data={resumeData} />
        </aside>
      </div>

      <GraduationTableModal isOpen={isGraduationTableOpen} onClose={() => setIsGraduationTableOpen(false)} />

      {/* Warnings Modal */}
      {isWarningModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-zinc-200">
            <div className="p-6 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
              <Search className="text-amber-500" />
              <h3 className="text-xl font-bold text-zinc-900">解析が完了しました</h3>
            </div>
            <div className="p-8 max-h-[50vh] overflow-y-auto space-y-4">
              {normalizationWarnings.map((w, i) => (
                <div key={i} className="flex gap-3 text-sm text-zinc-600">
                  <span className="text-amber-500 flex-shrink-0">•</span>
                  <span>{w}</span>
                </div>
              ))}
            </div>
            <div className="p-6 bg-zinc-50 flex gap-3 border-t border-zinc-100">
              <button onClick={() => setIsWarningModalOpen(false)} className="flex-1 py-3 px-4 rounded-xl border border-zinc-200 text-zinc-500 font-bold hover:bg-white transition-all">キャンセル</button>
              <button onClick={applyPendingData} className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md transition-all">反映する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
