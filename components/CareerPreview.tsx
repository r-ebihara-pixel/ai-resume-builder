import React from "react";
import { ResumeData } from "@/types/resume";
import { calculateAge } from "@/lib/dateUtils";
import { renderWithMinchoDigits } from "@/lib/utils/text";

interface Props {
  formData: ResumeData;
  id?: string;
}

export const CareerPreview = React.forwardRef<HTMLDivElement, Props>(({ formData, id }, ref) => {
  const data = formData;

  // Helper to format year-month
  const formatYm = (year?: string, month?: string) => {
    const y = (year ?? "").trim();
    const m = (month ?? "").trim();
    if (!y && !m) return "";
    if (y && m) return `${y}年${m}月`;
    if (y) return `${y}年`;
    return `${m}月`;
  };

  // Full name
  const fullName = `${data.profile.lastName || ""} ${data.profile.firstName || ""}`.trim() || "　";

  // Current date for header
  const today = new Date();
  const dateStr = `${today.getFullYear()}年${(today.getMonth() + 1).toString().padStart(2, '0')}月${today.getDate().toString().padStart(2, '0')}日`;

  // Derive skills from work history or certifications if no explicit skills field
  const skills: string[] = [];

  return (
    <div ref={ref} id={id} className="resume-page w-[210mm] min-h-[297mm] bg-white text-black font-serif text-sm p-[15mm] box-border relative print:shadow-none mx-auto career-document">
      <style>{`
        @page career { margin: 15mm; }
        .career-document { page: career; }
        @media print {
          .career-document {
            padding: 0 !important;
            width: auto !important;
            min-height: auto !important;
          }
        }
      `}</style>
      {/* Title */}
      <div className="text-center text-xl font-bold" style={{ letterSpacing: '0.5em', marginBottom: '10mm' }}>
        職 務 経 歴 書
      </div>

      {/* Header: Date and Name */}
      <div className="text-right mb-6">
        <div className="mb-2">{renderWithMinchoDigits(dateStr)}</div>
        <div className="flex justify-end items-baseline gap-1">
          <span>氏名　</span>
          <span className="border-b border-black min-w-[120px] pb-0.5">{fullName}</span>
        </div>
      </div>

      {/* Section: 経歴要約 */}
      <div className="mb-6">
        <div className="font-bold text-base mb-2">【経歴要約】</div>
        <div className="ml-2">
          {data.workHistory.length > 0 ? (
            <p>
              {renderWithMinchoDigits(
                (() => {
                  const first = data.workHistory[0];
                  const last = data.workHistory[data.workHistory.length - 1];
                  const start = formatYm(first.startDate?.year, first.startDate?.month);
                  const end = last.isCurrent
                    ? "現在"
                    : formatYm(last.endDate?.year, last.endDate?.month) || "";

                  const firstDesc = (first.description ?? "")
                    .replace(/\s+/g, " ")
                    .slice(0, 80);

                  return `${start || ""}から${end || ""}にかけて、${firstDesc || "複数の業務に幅広く従事"}してまいりました。これまでの経験を活かし、貴社に貢献できるよう努力いたします。`;
                })()
              )}
            </p>
          ) : (
            <div>
              <p>&nbsp;</p>
              <p>&nbsp;</p>
              <p>&nbsp;</p>
            </div>
          )}
        </div>
      </div>

      {/* Section: 職務内容 */}
      <div className="mb-6">
        <div className="font-bold text-base mb-2">【職務内容】</div>
        <div className="ml-2">
          {data.workHistory.length === 0 ? (
            <div>
              <p>&nbsp;</p>
              <p>&nbsp;</p>
              <p>&nbsp;</p>
            </div>
          ) : (
            data.workHistory.map((work, index) => {
              const start = formatYm(work.startDate?.year, work.startDate?.month) || "----年--月";
              const end = work.isCurrent
                ? "現在"
                : formatYm(work.endDate?.year, work.endDate?.month) || "----年--月";

              return (
                <div key={index} className="mb-4">
                  {/* Company header line */}
                  <div className="font-bold mb-1">
                    {renderWithMinchoDigits(`□${start}～${end}　${work.companyName || ""}`)}
                  </div>

                  {/* Company basic info (placeholder - extend if you have fields) */}
                  <div className="text-xs mb-2 text-gray-700">
                    事業内容：　資本金：　従業員数：
                  </div>

                  {/* Two-column table: 期間 / 業務内容 */}
                  <div className="grid grid-cols-[25%_75%] border border-gray-800 mb-3">
                    {/* Headers */}
                    <div className="bg-gray-100 p-2 font-bold text-center border-b border-gray-800">期間</div>
                    <div className="bg-gray-100 p-2 font-bold text-center border-b border-gray-800">業務内容</div>

                    {/* Data row */}
                    <div className="p-2 border-r border-gray-800 align-top">
                      {renderWithMinchoDigits(`${start}～${end}`)}
                    </div>
                    <div className="p-2 align-top whitespace-pre-wrap">
                      {renderWithMinchoDigits(work.description || "担当業務の詳細を記入")}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Section: スキル・知識 */}
      <div className="mb-6">
        <div className="font-bold text-base mb-2">【スキル・知識】</div>
        <div className="ml-2">
          <ul className="list-none p-0 m-0">
            {skills.length > 0 ? (
              skills.map((skill, i) => <li key={i} className="mb-1">● {skill}</li>)
            ) : (
              <>
                <li className="mb-1">●</li>
                <li className="mb-1">●</li>
                <li className="mb-1">●</li>
              </>
            )}
          </ul>
        </div>
      </div>

      {/* Section: 資格・免許 */}
      <div className="mb-6">
        <div className="font-bold text-base mb-2">【資格・免許】</div>
        <div className="ml-2">
          <ul className="list-none p-0 m-0">
            {data.certifications.length > 0 ? (
              data.certifications.map((cert, i) => {
                const date = formatYm(cert.date?.year, cert.date?.month);
                const certText = `● ${date ? `${date}　` : ""}${cert.name || ""}`;
                return (
                  <li key={i} className="mb-1">
                    {renderWithMinchoDigits(certText)}
                  </li>
                );
              })
            ) : (
              <>
                <li className="mb-1">●</li>
                <li className="mb-1">●</li>
              </>
            )}
          </ul>
        </div>
      </div>

      {/* Section: 自己PR */}
      <div className="mb-6">
        <div className="font-bold text-base mb-2">【自己PR】</div>
        <div className="ml-2">
          {data.selfPromotion ? (
            data.selfPromotion.split("\n").map((line, idx) => (
              <p key={idx}>{renderWithMinchoDigits(line || "\u00A0")}</p>
            ))
          ) : (
            <div>
              <p>&nbsp;</p>
              <p>&nbsp;</p>
              <p>&nbsp;</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer: Standard End Mark */}
      <div className="text-right" style={{ marginTop: '10mm', marginBottom: '10mm' }}>
        <span className="font-bold">以上</span>
      </div>
    </div>
  );
});

CareerPreview.displayName = "CareerPreview";
export default CareerPreview;
