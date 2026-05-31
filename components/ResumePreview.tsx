import React from "react";
import { ResumeData } from "@/types/resume";
import { calculateAge } from "@/lib/dateUtils";
import { renderWithMinchoDigits } from "@/lib/utils/text";
import { toKatakana } from "@/lib/textUtils";

interface Props {
  formData: ResumeData;
  id?: string;
}

export const ResumePreview = React.forwardRef<HTMLDivElement, Props>(({ formData, id }, ref) => {
  const data = formData;

  // 年齢計算
  const age = data.profile.birthday.year && data.profile.birthday.month && data.profile.birthday.day
    ? calculateAge(`${data.profile.birthday.year}-${data.profile.birthday.month.padStart(2, '0')}-${data.profile.birthday.day.padStart(2, '0')}`)
    : "";

  // 日付をソート用の数値に変換（全角対応）
  const parseDateToNumber = (ym: any) => {
    if (!ym) return 0;
    const yStr = String(ym.year || "").replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const mStr = String(ym.month || "").replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
    const y = parseInt(yStr) || 0;
    const m = parseInt(mStr) || 0;
    return y * 100 + m;
  };

  // 学歴・職歴を統合
  const sortedEducation = [...data.education].sort((a, b) => {
    const valA = parseDateToNumber(a.startDate) || parseDateToNumber(a.endDate);
    const valB = parseDateToNumber(b.startDate) || parseDateToNumber(b.endDate);
    return valA - valB;
  });

  const sortedWork = [...data.workHistory].sort((a, b) => {
    const valA = parseDateToNumber(a.startDate) || parseDateToNumber(a.endDate);
    const valB = parseDateToNumber(b.startDate) || parseDateToNumber(b.endDate);
    return valA - valB;
  });

  const combinedHistory = [
    { type: "header", text: "学歴", year: "", month: "" },
    ...sortedEducation.flatMap(edu => [
      {
        type: "education",
        year: edu.startDate.year,
        month: edu.startDate.month,
        text: `${edu.schoolName} ${edu.department} 入学`,
      },
      {
        type: "education",
        year: edu.endDate.year,
        month: edu.endDate.month,
        text: `${edu.schoolName} ${edu.department} ${edu.status === "graduated" ? "卒業" : edu.status === "expected" ? "卒業見込" : edu.status === "enrolled" ? "在学中" : "中途退学"}`,
      },
    ]),
    { type: "header", text: "職歴", year: "", month: "" },
    ...sortedWork.flatMap(work => [
      {
        type: "work",
        year: work.startDate.year,
        month: work.startDate.month,
        text: `${work.companyName} 入社`,
      },
      ...(work.isCurrent ? [
        {
          type: "work",
          year: "",
          month: "",
          text: `　　現在に至る`,
        }
      ] : [
        {
          type: "work",
          year: work.endDate.year,
          month: work.endDate.month,
          text: `${work.companyName} 退社`,
        }
      ]),
    ]),
    { type: "footer", text: "以上", year: "", month: "" },
  ];

  const page1History = combinedHistory.slice(0, 13);
  const page2History = combinedHistory.slice(13, 23);

  return (
    <div ref={ref} id={id} className="w-full bg-gray-100 p-8 overflow-y-auto print:p-0 print:bg-white print:overflow-visible">
      {/* 印刷用スタイル */}
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

      {/* ========== 1ページ目 ========== */}
      <div id="resume-page-1" className="resume-page w-[210mm] min-h-[297mm] bg-white text-black font-serif text-sm p-[10mm] box-border relative print:shadow-none mx-auto">
        {/* ヘッダー */}
        <div className="flex justify-between items-start mb-4">
          <h1 className="text-3xl font-bold tracking-wider">履　歴　書</h1>
          <div className="text-xs mt-2">{renderWithMinchoDigits(data.submissionDate ? data.submissionDate + "現在" : "年　 　月　 　日現在")}</div>
        </div>

        {/* 基本情報エリア */}
        <div className="flex gap-[3mm] mb-4">
          {/* 左側：氏名・生年月日エリア */}
          <div className="flex-1 border-2 border-black">
            {/* ふりがな行 (8mm) */}
            <div className="h-[8mm] border-b border-black flex items-center">
              <div className="w-[20mm] border-r border-black px-1 flex items-center h-full">
                <span className="text-xs">フリガナ</span>
              </div>
              <div className="flex-1 px-2 flex items-center">
                <span className="text-xs">{toKatakana(data.profile.lastNameKana)}　{toKatakana(data.profile.firstNameKana)}</span>
              </div>
            </div>
            {/* 氏名行 (22mm) */}
            <div className="h-[22mm] border-b border-black flex items-center">
              <div className="w-[20mm] border-r border-black px-1 flex items-center h-full">
                <span className="text-xs">氏　名</span>
              </div>
              <div className="flex-1 px-4 flex items-center">
                <span className="text-3xl font-bold">{data.profile.lastName}　{data.profile.firstName}</span>
              </div>
            </div>
            {/* 生年月日・性別行 (10mm) */}
            <div className="h-[10mm] flex items-center">
              <div className="w-[20mm] border-r border-black px-1 flex items-center justify-center h-full">
                <span className="text-xs">生年月日</span>
              </div>
              <div className="flex-1 px-4 border-r border-black h-full flex items-center">
                <span className="text-xs whitespace-nowrap">
                  {renderWithMinchoDigits(`${data.profile.birthday.year}年　 ${data.profile.birthday.month}月　 ${data.profile.birthday.day}日生　 （満 ${age} 歳）`)}
                </span>
              </div>
              <div className="w-[15mm] border-r border-black px-1 flex items-center justify-center h-full">
                <span className="text-xs">性別</span>
              </div>
              <div className="w-[15mm] flex items-center justify-center">
                <span className="text-xs">
                  {data.profile.gender === "male" ? "男" : data.profile.gender === "female" ? "女" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* 右側：写真枠 (40mm) */}
          <div className="w-[30mm] h-[40mm] border border-black flex flex-col items-center justify-start bg-gray-50 relative overflow-hidden">
            {data.photoUrl ? (
              <img
                src={data.photoUrl}
                alt="証明写真"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-[8px] text-center text-gray-600 leading-tight p-2">
                <div className="font-bold mb-1">写真を貼る位置</div>
                <div>{renderWithMinchoDigits("縦 40mm (4cm)")}</div>
                <div>{renderWithMinchoDigits("横 30mm (3cm)")}</div>
                <div>本人単身胸から上</div>
                <div>裏面のりづけ</div>
              </div>
            )}
          </div>
        </div>

        {/* 住所・連絡先 */}
        <div className="border-2 border-black mb-4">

          {/* 現住所エリア全体 (32mm) */}
          <div className="flex border-b border-black h-[32mm]">
            {/* 左側：ふりがなと住所 */}
            <div className="flex-1 flex flex-col border-r border-black">
              {/* ふりがな行 (8mm) */}
              <div className="h-[8mm] flex border-b border-black">
                <div className="w-[20mm] border-r border-black flex items-center px-1 pb-1">
                  <span className="text-xs">フリガナ</span>
                </div>
                <div className="flex-1 flex items-center px-2 pb-1 overflow-hidden">
                  <span className={`block w-full ${data.profile.address.kana.length > 35 ? "text-[9px] leading-[9px]" : data.profile.address.kana.length > 25 ? "text-[10px] leading-[10px]" : "text-xs leading-none"}`}>{toKatakana(data.profile.address.kana)}</span>
                </div>
              </div>
              {/* 住所行 (24mm) */}
              <div className="h-[24mm] flex">
                <div className="w-[20mm] border-r border-black flex items-start px-1 pt-1">
                  <span className="text-xs">現住所</span>
                </div>
                <div className="w-[10mm] flex items-start px-1 pt-1">
                  <span className="text-xs">〒</span>
                </div>
                <div className="flex-1 flex flex-col px-2 pt-1">
                  <span className="text-xs">{renderWithMinchoDigits(data.profile.address.postalCode)}</span>
                  <span className="text-xs mt-1">{data.profile.address.prefecture}{data.profile.address.city}{data.profile.address.block}</span>
                  {data.profile.address.building && <span className="text-xs">{data.profile.address.building}</span>}
                </div>
              </div>
            </div>



            {/* 右側：電話とEmail */}
            <div className="w-[53mm] flex flex-col">
              {/* 電話 (16mm) */}
              <div className="h-[16mm] flex border-b border-black">
                <div className="w-[13mm] border-r border-black flex items-start px-1 pt-1">
                  <span className="text-xs">電話</span>
                </div>
                <div className="flex-1 flex items-center justify-center px-1">
                  <span className="text-xs">{data.profile.contactAddress?.phone || data.profile.phone}</span>
                </div>
              </div>
              {/* Email (16mm) */}
              <div className="h-[16mm] flex">
                <div className="w-[13mm] border-r border-black flex items-start px-1 pt-1">
                  <span className="text-xs">E-mail</span>
                </div>
                <div className="flex-1 flex items-center justify-center px-1 text-[10px] break-all">
                  <span className="text-xs">{data.profile.contactAddress?.email || data.profile.email}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 学歴・職歴テーブル */}
        <div className="border-2 border-black">
          {/* ヘッダー */}
          <div className="h-[8mm] border-b border-black flex bg-white">
            <div className="w-[22mm] border-r border-black flex items-center justify-center">
              <span className="text-xs">年</span>
            </div>
            <div className="w-[12mm] border-r border-black flex items-center justify-center">
              <span className="text-xs">月</span>
            </div>
            <div className="flex-1 flex items-center justify-center px-4">
              <span className="text-xs tracking-wide">学　歴　・　職　歴　（ 各別にまとめて書く ）</span>
            </div>
          </div>

          {/* データ行 */}
          {[...Array(13)].map((_, i) => {
            const item = page1History[i];
            return (
              <div key={i} className={`h-[7.5mm] flex ${i < 12 ? 'border-b border-black' : ''}`}>
                <div className="w-[22mm] border-r border-black flex items-start justify-center pt-1">
                  <span className="text-xs">{renderWithMinchoDigits(item?.year || "")}</span>
                </div>
                <div className="w-[12mm] border-r border-black flex items-start justify-center pt-1">
                  <span className="text-xs">{renderWithMinchoDigits(item?.month || "")}</span>
                </div>
                <div className={`flex-1 flex items-start px-2 pt-1 ${item?.type === "header" ? "justify-center font-bold" : ""} ${item?.type === "footer" ? "justify-end pr-4" : ""}`}>
                  <span className="text-xs whitespace-pre-wrap break-all leading-tight">{renderWithMinchoDigits(item?.text || "")}</span>
                </div>
              </div>
            );
          })}
        </div >
      </div >

      <div className="page-break h-8 bg-gray-100 print:hidden"></div>

      {/* ========== 2ページ目 ========== */}
      <div id="resume-page-2" className="resume-page w-[210mm] min-h-[297mm] bg-white text-black font-serif text-sm p-[10mm] box-border relative print:shadow-none mx-auto">


        {/* 学歴・職歴（続き） */}
        <div className="border-2 border-black mb-4">
          {/* ヘッダー */}
          <div className="h-[8mm] border-b border-black flex bg-white">
            <div className="w-[22mm] border-r border-black flex items-center justify-center">
              <span className="text-xs">年</span>
            </div>
            <div className="w-[12mm] border-r border-black flex items-center justify-center">
              <span className="text-xs">月</span>
            </div>
            <div className="flex-1 flex items-center justify-center px-4">
              <span className="text-xs tracking-wide">学　歴　・　職　歴　（ 各別にまとめて書く ）</span>
            </div>
          </div>

          {/* データ行 */}
          {[...Array(10)].map((_, i) => {
            const item = page2History[i];
            return (
              <div key={i} className={`h-[7.5mm] flex ${i < 9 ? 'border-b border-black' : ''}`}>
                <div className="w-[22mm] border-r border-black flex items-start justify-center pt-1">
                  <span className="text-xs">{renderWithMinchoDigits(item?.year || "")}</span>
                </div>
                <div className="w-[12mm] border-r border-black flex items-start justify-center pt-1">
                  <span className="text-xs">{renderWithMinchoDigits(item?.month || "")}</span>
                </div>
                <div className={`flex-1 flex items-start px-2 pt-1 ${item?.type === "header" ? "justify-center font-bold" : ""} ${item?.type === "footer" ? "justify-end pr-4" : ""}`}>
                  <span className="text-xs whitespace-pre-wrap break-all leading-tight">{renderWithMinchoDigits(item?.text || "")}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 免許・資格 */}
        <div className="border-2 border-black mb-4">
          {/* ヘッダー */}
          <div className="h-[8mm] border-b border-black flex bg-white">
            <div className="w-[22mm] border-r border-black flex items-center justify-center">
              <span className="text-xs">年</span>
            </div>
            <div className="w-[12mm] border-r border-black flex items-center justify-center">
              <span className="text-xs">月</span>
            </div>
            <div className="flex-1 flex items-center justify-center px-4">
              <span className="text-xs">免　許　・　資　格</span>
            </div>
          </div>

          {/* データ行 */}
          {[...Array(6)].map((_, i) => {
            const cert = [...(data.certifications || [])]
              .sort((a, b) => {
                const yearA = parseInt(a.date.year) || 0;
                const monthA = parseInt(a.date.month) || 0;
                const yearB = parseInt(b.date.year) || 0;
                const monthB = parseInt(b.date.month) || 0;
                if (yearA !== yearB) return yearA - yearB;
                return monthA - monthB;
              })[i];
            return (
              <div key={i} className={`h-[7.5mm] flex ${i < 5 ? 'border-b border-black' : ''}`}>
                <div className="w-[22mm] border-r border-black flex items-start justify-center pt-1">
                  <span className="text-xs">{renderWithMinchoDigits(cert?.date.year || "")}</span>
                </div>
                <div className="w-[12mm] border-r border-black flex items-start justify-center pt-1">
                  <span className="text-xs">{renderWithMinchoDigits(cert?.date.month || "")}</span>
                </div>
                <div className="flex-1 flex items-start px-2 pt-1">
                  <span className="text-xs whitespace-pre-wrap break-all leading-tight">{renderWithMinchoDigits(cert?.name || "")}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 志望の動機、特技、アピールポイントなど */}
        <div className="border-2 border-black mb-4 h-[70mm]">
          <div className="border-b border-black px-2 py-1 text-xs">
            志望の動機、特技、アピールポイントなど
          </div>
          <div className="p-2 text-xs leading-relaxed whitespace-pre-wrap h-[calc(70mm-8mm)] overflow-hidden">
            {renderWithMinchoDigits(data.motivation || "")}
          </div>
        </div>

        {/* 本人希望記入欄 */}
        <div className="border-2 border-black h-[40mm]">
          <div className="border-b border-black px-2 py-1 text-xs">
            本人希望記入欄（特に給料、職種、勤務時間、勤務地、その他についての希望などがあれば記入）
          </div>
          <div className="p-2 text-xs leading-relaxed whitespace-pre-wrap h-[calc(40mm-8mm)] overflow-hidden">
            {renderWithMinchoDigits(data.requests || "")}
          </div>
        </div>
      </div>
    </div >
  );
});

ResumePreview.displayName = "ResumePreview";
export default ResumePreview;
