"use client";

import { ResumeData } from "@/types/resume";

type ResumeFormData = ResumeData;
import { Plus, Trash2, Wand2, Download } from "lucide-react"; // Assuming lucide-react is available (standard in shadcn)

interface ResumeFormProps {
    formData: ResumeFormData;
    onChange: (data: ResumeFormData) => void;
    onGenerateAi: (field: "selfPr" | "motivation") => Promise<void>;
    onExportPdf: () => void;
    loadingField: "selfPr" | "motivation" | null;
}

export default function ResumeForm({
    formData,
    onChange,
    onGenerateAi,
    onExportPdf,
    loadingField,
}: ResumeFormProps) {
    const handleChange = (field: keyof ResumeFormData, value: any) => {
        onChange({ ...formData, [field]: value });
    };

    const handleArrayChange = (
        section: "education" | "workExperience",
        index: number,
        field: string,
        value: string
    ) => {
        const newArray = [...formData[section]];
        (newArray[index] as any)[field] = value;
        onChange({ ...formData, [section]: newArray });
    };

    const addItem = (section: "education" | "workExperience") => {
        const newItem =
            section === "education"
                ? {
                    id: crypto.randomUUID(),
                    schoolName: "",
                    department: "",
                    startDate: "",
                    endDate: "",
                    status: "graduated",
                }
                : {
                    id: crypto.randomUUID(),
                    companyName: "",
                    position: "",
                    startDate: "",
                    endDate: "",
                    description: "",
                };
        onChange({
            ...formData,
            [section]: [...formData[section], newItem],
        });
    };

    const removeItem = (section: "education" | "workExperience", index: number) => {
        const newArray = [...formData[section]];
        newArray.splice(index, 1);
        onChange({ ...formData, [section]: newArray });
    };

    return (
        <div className="space-y-8 p-6 bg-white rounded-lg shadow-md overflow-y-auto h-full">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">履歴書入力</h2>
                <button
                    onClick={onExportPdf}
                    className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
                >
                    <Download size={18} />
                    PDF出力
                </button>
            </div>

            {/* Basic Info */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">基本情報</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">氏名</label>
                        <input
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => handleChange("fullName", e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="山田 太郎"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">フリガナ</label>
                        <input
                            type="text"
                            value={formData.furigana}
                            onChange={(e) => handleChange("furigana", e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="ヤマダ タロウ"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">生年月日</label>
                        <input
                            type="date"
                            value={formData.birthDate}
                            onChange={(e) => handleChange("birthDate", e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">電話番号</label>
                        <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => handleChange("phone", e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="090-1234-5678"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">メールアドレス</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleChange("email", e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="taro.yamada@example.com"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium mb-1">住所</label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => handleChange("address", e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="東京都..."
                        />
                    </div>
                </div>
            </section>

            {/* Education */}
            <section className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-semibold">学歴</h3>
                    <button
                        onClick={() => addItem("education")}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                        <Plus size={16} /> 追加
                    </button>
                </div>
                {formData.education.map((edu, index) => (
                    <div key={edu.id} className="p-4 border rounded bg-gray-50 relative">
                        <button
                            onClick={() => removeItem("education", index)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                        >
                            <Trash2 size={18} />
                        </button>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500">学校名</label>
                                <input
                                    type="text"
                                    value={edu.schoolName}
                                    onChange={(e) => handleArrayChange("education", index, "schoolName", e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">学部・学科</label>
                                <input
                                    type="text"
                                    value={edu.department}
                                    onChange={(e) => handleArrayChange("education", index, "department", e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">入学年月</label>
                                <input
                                    type="month"
                                    value={edu.startDate}
                                    onChange={(e) => handleArrayChange("education", index, "startDate", e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs text-gray-500">卒業年月</label>
                                    <input
                                        type="month"
                                        value={edu.endDate}
                                        onChange={(e) => handleArrayChange("education", index, "endDate", e.target.value)}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                                <div className="w-24">
                                    <label className="block text-xs text-gray-500">状態</label>
                                    <select
                                        value={edu.status}
                                        onChange={(e) => handleArrayChange("education", index, "status", e.target.value)}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="graduated">卒業</option>
                                        <option value="expected">卒業見込</option>
                                        <option value="enrolled">在学中</option>
                                        <option value="dropout">中退</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </section>

            {/* Work Experience */}
            <section className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-semibold">職歴</h3>
                    <button
                        onClick={() => addItem("workExperience")}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                        <Plus size={16} /> 追加
                    </button>
                </div>
                {formData.workExperience.map((work, index) => (
                    <div key={work.id} className="p-4 border rounded bg-gray-50 relative">
                        <button
                            onClick={() => removeItem("workExperience", index)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                        >
                            <Trash2 size={18} />
                        </button>
                        <div className="grid grid-cols-2 gap-4 mb-2">
                            <div>
                                <label className="block text-xs text-gray-500">会社名</label>
                                <input
                                    type="text"
                                    value={work.companyName}
                                    onChange={(e) => handleArrayChange("workExperience", index, "companyName", e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">役職・業務内容</label>
                                <input
                                    type="text"
                                    value={work.position}
                                    onChange={(e) => handleArrayChange("workExperience", index, "position", e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">開始年月</label>
                                <input
                                    type="month"
                                    value={work.startDate}
                                    onChange={(e) => handleArrayChange("workExperience", index, "startDate", e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">終了年月 (在職中は空欄)</label>
                                <input
                                    type="month"
                                    value={work.endDate}
                                    onChange={(e) => handleArrayChange("workExperience", index, "endDate", e.target.value)}
                                    className="w-full p-2 border rounded"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500">詳細</label>
                            <textarea
                                value={work.description}
                                onChange={(e) => handleArrayChange("workExperience", index, "description", e.target.value)}
                                className="w-full p-2 border rounded h-20"
                                placeholder="業務内容の詳細..."
                            />
                        </div>
                    </div>
                ))}
            </section>

            {/* Skills */}
            <section className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">スキル・資格</h3>
                <div>
                    <label className="block text-sm font-medium mb-1">スキル (カンマ区切り)</label>
                    <textarea
                        value={formData.skills.join(", ")}
                        onChange={(e) => handleChange("skills", e.target.value.split(",").map(s => s.trim()))}
                        className="w-full p-2 border rounded h-20"
                        placeholder="Java, AWS, Linux, Docker..."
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">資格 (カンマ区切り)</label>
                    <textarea
                        value={formData.qualifications.join(", ")}
                        onChange={(e) => handleChange("qualifications", e.target.value.split(",").map(s => s.trim()))}
                        className="w-full p-2 border rounded h-20"
                        placeholder="基本情報技術者, AWS SAA..."
                    />
                </div>
            </section>

            {/* Self PR */}
            <section className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-semibold">自己PR</h3>
                    <button
                        onClick={() => onGenerateAi("selfPr")}
                        disabled={loadingField === "selfPr"}
                        className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                    >
                        <Wand2 size={14} />
                        {loadingField === "selfPr" ? "生成中..." : "AI自動生成"}
                    </button>
                </div>
                <textarea
                    value={formData.selfPr}
                    onChange={(e) => handleChange("selfPr", e.target.value)}
                    className="w-full p-2 border rounded h-32"
                    placeholder="あなたの強みを入力してください（AI生成ボタンで自動作成できます）"
                />
            </section>

            {/* Motivation */}
            <section className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-lg font-semibold">志望動機</h3>
                    <button
                        onClick={() => onGenerateAi("motivation")}
                        disabled={loadingField === "motivation"}
                        className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700 disabled:opacity-50"
                    >
                        <Wand2 size={14} />
                        {loadingField === "motivation" ? "生成中..." : "AI自動生成"}
                    </button>
                </div>
                <textarea
                    value={formData.motivation}
                    onChange={(e) => handleChange("motivation", e.target.value)}
                    className="w-full p-2 border rounded h-32"
                    placeholder="インフラエンジニアを志望する理由を入力してください（AI生成ボタンで自動作成できます）"
                />
            </section>
        </div>
    );
}
