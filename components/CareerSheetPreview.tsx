import React from "react";
import { ResumeData } from "@/types/resume";
import { renderWithMinchoDigits } from "@/lib/utils/text";

interface Props {
    formData: ResumeData;
    id?: string;
}

export const CareerSheetPreview = React.forwardRef<HTMLDivElement, Props>(
    ({ formData, id }, ref) => {
        const data = formData;

        // 日付をソート用の数値に変換（全角対応）
        const parseDateToNumber = (ym: any) => {
            if (!ym) return 0;
            const yStr = String(ym.year || "").replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
            const mStr = String(ym.month || "").replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
            const y = parseInt(yStr) || 0;
            const m = parseInt(mStr) || 0;
            return y * 100 + m;
        };

        // Work history (sorted by start date, oldest first)
        const workHistory = [...(data.workHistory ?? [])].sort((a, b) => {
            const valA = parseDateToNumber(a.startDate) || parseDateToNumber(a.endDate);
            const valB = parseDateToNumber(b.startDate) || parseDateToNumber(b.endDate);
            return valA - valB;
        });

        return (
            <div
                ref={ref}
                id={id}
                className="w-full bg-gray-100 p-8 overflow-y-auto print:p-0 print:bg-white print:overflow-visible"
            >
                {/* Print styles */}
                <style>{`
          @page { size: A4; margin: 0; }
          @media print {
            body { -webkit-print-color-adjust: exact; }
            .page-break { page-break-before: always; }
            .resume-page { font-family: "MS Mincho", "MS PMincho", "Hiragino Mincho ProN", serif !important; }
          }
          .resume-page {
            font-family: "MS Mincho", "MS PMincho", "Hiragino Mincho ProN", serif !important;
          }
        `}</style>

                <div className="resume-page w-[210mm] min-h-[297mm] bg-white text-black font-serif text-sm p-[15mm] box-border relative print:shadow-none mx-auto">
                    {/* Title (Centered) */}
                    <div className="text-center mb-4">
                        <h1 className="text-3xl font-bold tracking-[0.5em]">職務経歴書</h1>
                    </div>

                    {/* Header: Date and Name (Right-aligned below title) */}
                    <div className="flex flex-col items-end mb-8">
                        <div className="text-xs mb-1">
                            {renderWithMinchoDigits(data.submissionDate ? data.submissionDate + " 現在" : "")}
                        </div>
                        <div className="flex items-baseline">
                            <span className="text-xs mr-4">氏名</span>
                            <span className="text-xl font-bold">
                                {data.profile.lastName} {data.profile.firstName}
                            </span>
                        </div>
                    </div>

                    {/* Career Summary */}
                    {data.careerSummary && (
                        <section className="mb-6">
                            <h2 className="text-base font-bold border-b-2 border-black pb-1 mb-2">
                                職務要約
                            </h2>
                            <div className="text-xs whitespace-pre-wrap leading-relaxed">
                                {renderWithMinchoDigits(data.careerSummary)}
                            </div>
                        </section>
                    )}

                    {/* Work History */}
                    <section className="mb-6">
                        <h2 className="text-base font-bold border-b-2 border-black pb-1 mb-2">
                            職務経歴
                        </h2>

                        <div className="space-y-4">
                            {workHistory.map((work, index) => {
                                const startYear = work.startDate?.year || "";
                                const startMonth = work.startDate?.month || "";
                                const endYear = work.endDate?.year || "";
                                const endMonth = work.endDate?.month || "";

                                const periodStart = startYear && startMonth
                                    ? `${startYear}年${startMonth}月`
                                    : "";
                                const periodEnd = work.isCurrent
                                    ? "現在"
                                    : (endYear && endMonth ? `${endYear}年${endMonth}月` : "");

                                return (
                                    <div key={work.id || index} className="text-xs leading-relaxed border-l-4 border-gray-300 pl-3">
                                        {/* Period / Company / Dept / Position */}
                                        <div className="mb-2">
                                            {/* Company name - bold and larger */}
                                            <div className="font-bold text-sm mb-1">
                                                {work.companyName || "会社名未入力"}
                                            </div>

                                            {/* Period, Department, Position, Employment Type */}
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-700">
                                                {(periodStart || periodEnd) && (
                                                    <div>
                                                        <span className="font-semibold">期間：</span>
                                                        {renderWithMinchoDigits(periodStart)}
                                                        {periodStart && periodEnd && " 〜 "}
                                                        {periodEnd === "現在" ? periodEnd : renderWithMinchoDigits(periodEnd)}
                                                    </div>
                                                )}
                                                {work.department && (
                                                    <div>
                                                        <span className="font-semibold">部署：</span>
                                                        {work.department}
                                                    </div>
                                                )}
                                                {work.position && (
                                                    <div>
                                                        <span className="font-semibold">役職：</span>
                                                        {work.position}
                                                    </div>
                                                )}
                                                {work.employmentType && (
                                                    <div>
                                                        <span className="font-semibold">雇用形態：</span>
                                                        {work.employmentType}
                                                    </div>
                                                )}
                                                {(work.companyCapital || work.employeeCount) && (
                                                    <div>
                                                        <span className="font-semibold">規模：</span>
                                                        {renderWithMinchoDigits(work.companyCapital || "-")}／
                                                        {renderWithMinchoDigits(work.employeeCount || "-")}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Business Description */}
                                        {work.businessDescription && (
                                            <div className="mb-2">
                                                <span className="font-bold">【事業内容】</span>
                                                <div className="mt-0.5 whitespace-pre-wrap">
                                                    {renderWithMinchoDigits(work.businessDescription)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Responsibilities */}
                                        {work.responsibilities && (
                                            <div className="mb-2">
                                                <span className="font-bold">【担当業務】</span>
                                                <div className="mt-0.5 whitespace-pre-wrap">
                                                    {renderWithMinchoDigits(work.responsibilities)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Achievements */}
                                        {work.achievements && (
                                            <div className="mb-2">
                                                <span className="font-bold">【実績・成果】</span>
                                                <div className="mt-0.5 whitespace-pre-wrap">
                                                    {renderWithMinchoDigits(work.achievements)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Environment */}
                                        {work.environment && (
                                            <div className="mb-2">
                                                <span className="font-bold">【使用技術・ツール】</span>
                                                <div className="mt-0.5 whitespace-pre-wrap">
                                                    {renderWithMinchoDigits(work.environment)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* Skills Summary */}
                    {data.skillsSummary && (
                        <section className="mb-6">
                            <h2 className="text-base font-bold border-b-2 border-black pb-1 mb-2">
                                活かせる経験・知識・スキル
                            </h2>
                            <div className="text-xs whitespace-pre-wrap leading-relaxed">
                                {renderWithMinchoDigits(data.skillsSummary)}
                            </div>
                        </section>
                    )}

                    {/* Certifications */}
                    {data.certifications && data.certifications.length > 0 && (
                        <section className="mb-6">
                            <h2 className="text-base font-bold border-b-2 border-black pb-1 mb-2">
                                資格・免許
                            </h2>
                            <ul className="text-xs leading-relaxed space-y-1">
                                {[...(data.certifications || [])].sort((a, b) => {
                                    const aYear = parseInt(a.date?.year || "0");
                                    const bYear = parseInt(b.date?.year || "0");
                                    if (aYear !== bYear) return aYear - bYear;
                                    const aMonth = parseInt(a.date?.month || "0");
                                    const bMonth = parseInt(b.date?.month || "0");
                                    return aMonth - bMonth;
                                }).map((cert, i) => {
                                    const certYear = cert.date?.year || "";
                                    const certMonth = cert.date?.month || "";
                                    const certDate = certYear && certMonth
                                        ? `${certYear}年${certMonth}月`
                                        : "";

                                    return (
                                        <li key={cert.id || i} className="flex">
                                            <span className="mr-2">•</span>
                                            <span>
                                                {certDate && (
                                                    <>
                                                        {renderWithMinchoDigits(certDate)}
                                                        <span className="mx-2">―</span>
                                                    </>
                                                )}
                                                {cert.name}
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    )}

                    {/* Self PR */}
                    {(data.careerPr || data.selfPromotion) && (
                        <section className="mb-6">
                            <h2 className="text-base font-bold border-b-2 border-black pb-1 mb-2">
                                自己PR
                            </h2>
                            <div className="text-xs whitespace-pre-wrap leading-relaxed">
                                {renderWithMinchoDigits(
                                    data.careerPr || data.selfPromotion || ""
                                )}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        );
    }
);

CareerSheetPreview.displayName = "CareerSheetPreview";
export default CareerSheetPreview;
