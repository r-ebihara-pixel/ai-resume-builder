// lib/wordGenerator.ts
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  VerticalAlign,
  ImageRun,
  HeightRule,
  VerticalMergeType,
} from "docx";
import { ResumeData } from "@/types/resume";
import { calculateAge } from "@/lib/dateUtils";
import { toKatakana } from "@/lib/textUtils";

const BORDER_THICK = { style: BorderStyle.SINGLE, size: 12, color: "000000" }; // 1.5pt approx
const BORDER_THIN = { style: BorderStyle.SINGLE, size: 2, color: "000000" };   // 0.5pt approx
const FONT_FAMILY = "MS Mincho"; // Standard Japanese font

/**
 * 履歴書データから Word（.docx）ファイルを生成してダウンロードさせる
 */
export async function downloadResumeDocx(resumeData: ResumeData) {
  const { profile, education, workHistory, certifications, motivation, selfPromotion, requests, submissionDate, photoUrl } = resumeData;

  // 年齢計算
  const age = profile.birthday.year && profile.birthday.month && profile.birthday.day
    ? calculateAge(`${profile.birthday.year}-${profile.birthday.month.padStart(2, '0')}-${profile.birthday.day.padStart(2, '0')}`)
    : "";

  // 写真データの処理
  let photoImage: ImageRun | undefined;
  if (photoUrl) {
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      photoImage = new ImageRun({
        data: buffer,
        transformation: {
          width: 30 * 3.78, // 30mm to px (approx) -> Word handles sizing, but let's try to fit 30mm x 40mm
          height: 40 * 3.78,
        },
        type: "png",
      });
    } catch (e) {
      console.error("Failed to load photo", e);
    }
  }

  // 学歴・職歴の結合
  const historyList = [
    { type: "header", text: "学歴", year: "", month: "" },
    ...education.flatMap(edu => [
      { type: "item", year: edu.startDate.year, month: edu.startDate.month, text: `${edu.schoolName} ${edu.department} 入学` },
      { type: "item", year: edu.endDate.year, month: edu.endDate.month, text: `${edu.schoolName} ${edu.department} ${edu.status === "graduated" ? "卒業" : edu.status === "expected" ? "卒業見込" : edu.status === "enrolled" ? "在学中" : "中退"}` },
    ]),
    { type: "header", text: "職歴", year: "", month: "" },
    ...workHistory.flatMap(work => [
      { type: "item", year: work.startDate.year, month: work.startDate.month, text: `${work.companyName} 入社` },
      ...(work.description ? [{ type: "item", year: "", month: "", text: `　${work.description}` }] : []),
      ...(work.isCurrent ? [] : [{ type: "item", year: work.endDate.year, month: work.endDate.month, text: `${work.companyName} 退社` }]),
    ]),
    { type: "footer", text: "以上", year: "", month: "" },
  ];

  // ページ分割 (1ページ目: 14行, 2ページ目: 12行)
  const page1History = historyList.slice(0, 14);
  const page2History = historyList.slice(14, 26);

  // ヘッダー部分
  const headerSection = [
    new Paragraph({
      children: [
        new TextRun({ text: "履　歴　書", font: FONT_FAMILY, size: 48, bold: true }),
      ],
      alignment: AlignmentType.LEFT,
    }),
    new Paragraph({
      children: [
        new TextRun({ text: submissionDate ? `${submissionDate} 現在` : "年　月　日 現在", font: FONT_FAMILY, size: 20 }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 200 },
    }),
  ];

  // 寸法定義 (Twips: 1mm ≒ 56.7twips)
  const MM_TO_TWIPS = 56.7;
  const ROW_HEIGHT_STD = Math.floor(7.5 * MM_TO_TWIPS); // 7.5mm
  const ROW_HEIGHT_FURIGANA = Math.floor(8 * MM_TO_TWIPS); // 8mm
  const ROW_HEIGHT_NAME = Math.floor(24 * MM_TO_TWIPS); // 24mm
  const ROW_HEIGHT_ADDRESS = Math.floor(24 * MM_TO_TWIPS); // 24mm

  // 基本情報テーブル
  const profileTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: BORDER_THICK, bottom: BORDER_THICK, left: BORDER_THICK, right: BORDER_THICK,
      insideHorizontal: BORDER_THIN, insideVertical: BORDER_THIN,
    },
    rows: [
      // ふりがな行
      new TableRow({
        height: { value: ROW_HEIGHT_FURIGANA, rule: HeightRule.EXACT },
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "フリガナ", font: FONT_FAMILY, size: 16 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${toKatakana(profile.lastNameKana)} ${toKatakana(profile.firstNameKana)}`, font: FONT_FAMILY, size: 20 })] })], width: { size: 60, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({
            children: [
              new Paragraph({
                children: photoImage ? [photoImage] : [
                  new TextRun({ text: "写真を貼る位置", size: 16 }),
                  new TextRun({ text: "\n縦 36mm-40mm", size: 12 }),
                  new TextRun({ text: "\n横 24mm-30mm", size: 12 }),
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            verticalMerge: VerticalMergeType.RESTART,
            width: { size: 30, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }),
        ],
      }),
      // 氏名行
      new TableRow({
        height: { value: ROW_HEIGHT_NAME, rule: HeightRule.EXACT },
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "氏　名", font: FONT_FAMILY, size: 20 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${profile.lastName} ${profile.firstName}`, font: FONT_FAMILY, size: 48, bold: true })] })], width: { size: 60, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, width: { size: 30, type: WidthType.PERCENTAGE } }),
        ],
      }),
      // 生年月日行
      new TableRow({
        height: { value: ROW_HEIGHT_FURIGANA, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "生年月日", font: FONT_FAMILY, size: 20 }),
                ],
              })
            ],
            columnSpan: 1,
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: `${profile.birthday.year}年 ${profile.birthday.month}月 ${profile.birthday.day}日生 （満 ${age} 歳）`, font: FONT_FAMILY, size: 24 }),
                  new TextRun({ text: "　　　　性別　", font: FONT_FAMILY, size: 20 }),
                  new TextRun({ text: profile.gender === "male" ? "男" : profile.gender === "female" ? "女" : "", font: FONT_FAMILY, size: 24 }),
                ],
              })
            ],
            columnSpan: 1,
            verticalAlign: VerticalAlign.CENTER
          }),
          new TableCell({ children: [], verticalMerge: VerticalMergeType.CONTINUE, width: { size: 30, type: WidthType.PERCENTAGE } }),
        ],
      }),
    ],
  });

  // 住所・連絡先テーブル
  const addressTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: BORDER_THICK, bottom: BORDER_THICK, left: BORDER_THICK, right: BORDER_THICK,
      insideHorizontal: BORDER_THIN, insideVertical: BORDER_THIN,
    },
    rows: [
      // 現住所 ふりがな
      new TableRow({
        height: { value: ROW_HEIGHT_FURIGANA, rule: HeightRule.EXACT },
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "フリガナ", font: FONT_FAMILY, size: 16 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: toKatakana(profile.address.kana), font: FONT_FAMILY, size: 18 })] })], width: { size: 60, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "電話", font: FONT_FAMILY, size: 16 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: profile.phone, font: FONT_FAMILY, size: 20 })] })], width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
        ],
      }),
      // 現住所
      new TableRow({
        height: { value: ROW_HEIGHT_ADDRESS, rule: HeightRule.EXACT },
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "現住所", font: FONT_FAMILY, size: 20 })] }), new Paragraph({ children: [new TextRun({ text: `〒 ${profile.address.postalCode}`, font: FONT_FAMILY, size: 18 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: `${profile.address.prefecture}${profile.address.city}${profile.address.building || ""}`, font: FONT_FAMILY, size: 20 })] })], width: { size: 60, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Email", font: FONT_FAMILY, size: 16 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: profile.email, font: FONT_FAMILY, size: 16 })] })], width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
        ],
      }),
      // 連絡先 ふりがな
      new TableRow({
        height: { value: ROW_HEIGHT_FURIGANA, rule: HeightRule.EXACT },
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "フリガナ", font: FONT_FAMILY, size: 16 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: toKatakana(profile.contactAddress.kana), font: FONT_FAMILY, size: 18 })] })], width: { size: 60, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "電話", font: FONT_FAMILY, size: 16 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: profile.contactAddress.phone, font: FONT_FAMILY, size: 20 })] })], width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
        ],
      }),
      // 連絡先
      new TableRow({
        height: { value: ROW_HEIGHT_ADDRESS, rule: HeightRule.EXACT },
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "連絡先", font: FONT_FAMILY, size: 20 })] }), new Paragraph({ children: [new TextRun({ text: profile.contactAddress.postalCode ? `〒 ${profile.contactAddress.postalCode}` : "", font: FONT_FAMILY, size: 18 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.TOP }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: profile.contactAddress.prefecture ? `${profile.contactAddress.prefecture}${profile.contactAddress.city}${profile.contactAddress.building || ""}` : "（現住所と同じ）", font: FONT_FAMILY, size: 20 })] })], width: { size: 60, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Email", font: FONT_FAMILY, size: 16 })] })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: profile.contactAddress.email, font: FONT_FAMILY, size: 16 })] })], width: { size: 20, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
        ],
      }),
    ],
  });

  // 学歴・職歴テーブル生成関数
  const createHistoryTable = (historyItems: any[], minRows: number) => {
    const rows = [
      new TableRow({
        height: { value: ROW_HEIGHT_FURIGANA, rule: HeightRule.EXACT },
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "年", font: FONT_FAMILY, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "月", font: FONT_FAMILY, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "学歴・職歴", font: FONT_FAMILY, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 85, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
        ],
      }),
    ];

    for (let i = 0; i < minRows; i++) {
      const item = historyItems[i];
      rows.push(new TableRow({
        height: { value: ROW_HEIGHT_STD, rule: HeightRule.EXACT },
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item?.year || "", font: FONT_FAMILY, size: 20 })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: item?.month || "", font: FONT_FAMILY, size: 20 })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
          new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ text: item?.text || "", font: FONT_FAMILY, size: 20 })],
              alignment: item?.type === "header" ? AlignmentType.CENTER : item?.type === "footer" ? AlignmentType.RIGHT : AlignmentType.LEFT
            })],
            verticalAlign: VerticalAlign.CENTER
          }),
        ],
      }));
    }
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: BORDER_THICK, bottom: BORDER_THICK, left: BORDER_THICK, right: BORDER_THICK,
        insideHorizontal: BORDER_THIN, insideVertical: BORDER_THIN,
      },
      rows,
    });
  };

  const historyTable1 = createHistoryTable(page1History, 14);
  const historyTable2 = createHistoryTable(page2History, 12);

  // 免許・資格テーブル
  const certRows = [
    new TableRow({
      height: { value: ROW_HEIGHT_FURIGANA, rule: HeightRule.EXACT },
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "年", font: FONT_FAMILY, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 10, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "月", font: FONT_FAMILY, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 5, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "免許・資格", font: FONT_FAMILY, size: 18 })], alignment: AlignmentType.CENTER })], width: { size: 85, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlign.CENTER }),
      ],
    }),
  ];

  for (let i = 0; i < 6; i++) {
    const cert = certifications[i];
    certRows.push(new TableRow({
      height: { value: ROW_HEIGHT_STD, rule: HeightRule.EXACT },
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cert?.date.year || "", font: FONT_FAMILY, size: 20 })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cert?.date.month || "", font: FONT_FAMILY, size: 20 })], alignment: AlignmentType.CENTER })], verticalAlign: VerticalAlign.CENTER }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: cert?.name || "", font: FONT_FAMILY, size: 20 })] })], verticalAlign: VerticalAlign.CENTER }),
      ],
    }));
  }

  const certTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: BORDER_THICK, bottom: BORDER_THICK, left: BORDER_THICK, right: BORDER_THICK,
      insideHorizontal: BORDER_THIN, insideVertical: BORDER_THIN,
    },
    rows: certRows,
  });

  // Calculate remaining height for Motivation and Requests to match Page 1
  // Page 1: Profile (40mm) + Address (64mm) + History (14 * 7.5 = 105mm) + Header (approx 25mm) = 234mm
  // Page 2: History (12 * 7.5 = 90mm) + Certs (6 * 7.5 = 45mm) = 135mm
  // Remaining for Motivation + Requests = 234 - 135 = 99mm
  // Let's allocate 60mm to Motivation and 39mm to Requests
  const HEIGHT_MOTIVATION = Math.floor(60 * MM_TO_TWIPS);
  const HEIGHT_REQUESTS = Math.floor(39 * MM_TO_TWIPS);

  // 志望動機・自己PRテーブル
  const motivationTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: BORDER_THICK, bottom: BORDER_THICK, left: BORDER_THICK, right: BORDER_THICK,
      insideHorizontal: BORDER_THIN, insideVertical: BORDER_THIN,
    },
    rows: [
      new TableRow({
        height: { value: ROW_HEIGHT_FURIGANA, rule: HeightRule.EXACT },
        children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "志望の動機、特技、自己PR、アピールポイントなど", font: FONT_FAMILY, size: 18 })] })], verticalAlign: VerticalAlign.CENTER })],
      }),
      new TableRow({
        height: { value: HEIGHT_MOTIVATION, rule: HeightRule.EXACT },
        children: [new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({
                text: motivation && selfPromotion ? `【志望動機】\n${motivation}\n\n【自己PR】\n${selfPromotion}` : (motivation || selfPromotion || ""),
                font: FONT_FAMILY,
                size: 20
              })]
            })
          ]
        })],
      }),
    ],
  });

  // 本人希望記入欄テーブル
  const requestsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: BORDER_THICK, bottom: BORDER_THICK, left: BORDER_THICK, right: BORDER_THICK,
      insideHorizontal: BORDER_THIN, insideVertical: BORDER_THIN,
    },
    rows: [
      new TableRow({
        height: { value: ROW_HEIGHT_FURIGANA, rule: HeightRule.EXACT },
        children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "本人希望記入欄（特に給料、職種、勤務時間、勤務地、その他についての希望などがあれば記入）", font: FONT_FAMILY, size: 18 })] })], verticalAlign: VerticalAlign.CENTER })],
      }),
      new TableRow({
        height: { value: HEIGHT_REQUESTS, rule: HeightRule.EXACT },
        children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: requests || "", font: FONT_FAMILY, size: 20 })] })] })],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
          },
        },
        children: [
          ...headerSection,
          profileTable,
          new Paragraph({ text: "", spacing: { after: 100 } }),
          addressTable,
          new Paragraph({ text: "", spacing: { after: 100 } }),
          historyTable1,
        ],
      },
      {
        properties: {
          page: {
            margin: { top: "15mm", right: "15mm", bottom: "15mm", left: "15mm" },
          },
        },
        children: [
          historyTable2,
          new Paragraph({ text: "", spacing: { after: 100 } }),
          certTable,
          new Paragraph({ text: "", spacing: { after: 100 } }),
          motivationTable,
          new Paragraph({ text: "", spacing: { after: 100 } }),
          requestsTable,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filenameBase = `${profile.lastName}${profile.firstName}`.replace(/\s+/g, "") || "履歴書";
  const fileName = `履歴書_${filenameBase}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
