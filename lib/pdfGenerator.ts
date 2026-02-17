import { jsPDF } from "jspdf";
import { ResumeData } from "@/types/resume";
import { calculateAge } from "@/lib/dateUtils";
import { NotoSansJPRegular } from "@/lib/fonts/NotoSansJP";
import { toKatakana } from "@/lib/textUtils";

// 定数定義（Pythonコードから移植）
const MARGIN = 15; // mm
const LINE_THIN = 0.5;
const LINE_THICK = 1.8;

// A4サイズ（mm）
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

/**
 * 座標変換: ReportLab (原点左下) → jsPDF (原点左上)
 */
function convertY(reportlabY: number): number {
    return PAGE_HEIGHT - reportlabY;
}

/**
 * 線を描画
 */
function drawLine(
    doc: jsPDF,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width: number = LINE_THIN
) {
    doc.setLineWidth(width);
    doc.line(x1, convertY(y1), x2, convertY(y2));
}

/**
 * 矩形を描画
 */
function drawRect(
    doc: jsPDF,
    x: number,
    y: number,
    w: number,
    h: number,
    width: number = LINE_THIN
) {
    doc.setLineWidth(width);
    doc.rect(x, convertY(y) - h, w, h);
}

/**
 * ボックス内にテキストを描画
 */
function drawTextInBox(
    doc: jsPDF,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    options: {
        size?: number;
        align?: "left" | "center" | "right";
        valign?: "top" | "center" | "bottom";
        paddingX?: number;
    } = {}
) {
    const {
        size = 10.5,
        align = "left",
        valign = "center",
        paddingX = 2,
    } = options;

    doc.setFontSize(size);
    const fontHeight = size * 0.35;

    let textY: number;
    const boxTop = convertY(y);
    const boxBottom = convertY(y) - h;

    if (valign === "center") {
        textY = boxTop - (h / 2) + (fontHeight / 2);
    } else if (valign === "top") {
        textY = boxTop - 2 - fontHeight;
    } else {
        textY = boxBottom + 2 + fontHeight;
    }

    if (align === "center") {
        doc.text(text, x + w / 2, textY, { align: "center" });
    } else if (align === "right") {
        doc.text(text, x + w - paddingX, textY, { align: "right" });
    } else {
        doc.text(text, x + paddingX, textY);
    }
}

/**
 * 複数行テキストを枠内に表示するヘルパー関数
 */
function drawMultiLineSection(
    doc: jsPDF,
    title: string,
    text: string,
    x: number,
    y: number,
    width: number,
    height: number
) {
    // 全体の枠 (y is Top Y, drawRect expects Bottom Y)
    drawRect(doc, x, y - height, width, height, LINE_THIN);

    const titleWidth = 22;
    const titleHeight = 8;

    // 見出し（左上の小さい枠）
    drawRect(doc, x, y - titleHeight, titleWidth, titleHeight, LINE_THIN);
    drawTextInBox(doc, x, y - titleHeight, titleWidth, titleHeight, title, {
        size: 10,
        align: "center",
        valign: "center",
    });

    // 本文エリア
    const bodyX = x + titleWidth + 2;
    const bodyWidth = width - titleWidth - 4;
    const lineHeight = 5;

    doc.setFontSize(9);
    const content = text || "";
    const lines = doc.splitTextToSize(content, bodyWidth);
    const maxLines = Math.floor((height - 6) / lineHeight);

    lines.slice(0, maxLines).forEach((line: string, i: number) => {
        // Calculate Bottom Y for the line
        const lineBottomY = y - 4 - (i * lineHeight) - lineHeight;

        drawTextInBox(doc, bodyX, lineBottomY, bodyWidth, lineHeight, line, {
            size: 9,
            align: "left",
            valign: "center",
        });
    });
}

/**
 * テーブルセクションを描画
 */
function drawTableSection(
    doc: jsPDF,
    startY: number,
    rowHeight: number,
    numRows: number,
    wYear: number,
    wMonth: number,
    titleText: string
): number {
    const H_HEADER = 8;
    const headerBottom = startY - H_HEADER;
    const bodyHeight = numRows * rowHeight;
    const bodyBottom = headerBottom - bodyHeight;

    const X_Y = MARGIN + wYear;
    const X_M = X_Y + wMonth;

    drawLine(doc, X_Y, startY, X_Y, headerBottom, LINE_THIN);
    drawLine(doc, X_M, startY, X_M, headerBottom, LINE_THIN);

    drawTextInBox(doc, MARGIN, headerBottom, wYear, H_HEADER, "年", { align: "center" });
    drawTextInBox(doc, X_Y, headerBottom, wMonth, H_HEADER, "月", { align: "center" });
    drawTextInBox(doc, X_M, headerBottom, 100, H_HEADER, titleText, { paddingX: 10 });

    for (let i = 0; i < numRows; i++) {
        const y = headerBottom - (i * rowHeight);
        drawLine(doc, MARGIN, y, MARGIN + CONTENT_WIDTH, y, LINE_THIN);
    }

    drawLine(doc, X_Y, startY, X_Y, bodyBottom, LINE_THIN);
    drawLine(doc, X_M, startY, X_M, bodyBottom, LINE_THIN);

    drawRect(doc, MARGIN, bodyBottom, CONTENT_WIDTH, H_HEADER + bodyHeight, LINE_THICK);
    drawLine(doc, MARGIN, headerBottom, MARGIN + CONTENT_WIDTH, headerBottom, LINE_THICK);

    return bodyBottom;
}

/**
 * 学歴・職歴データを描画
 */
function drawHistoryData(
    doc: jsPDF,
    startY: number,
    rowHeight: number,
    items: Array<{ year: string; month: string; text: string; type: string }>,
    wYear: number,
    wMonth: number
) {
    const H_HEADER = 8;
    const X_Y = MARGIN + wYear;
    const X_M = X_Y + wMonth;

    items.forEach((item, i) => {
        const rowY = startY - H_HEADER - (i * rowHeight);

        drawTextInBox(doc, MARGIN, rowY, wYear, rowHeight, item.year, {
            size: 9,
            align: "center",
            valign: "top",
        });

        drawTextInBox(doc, X_Y, rowY, wMonth, rowHeight, item.month, {
            size: 9,
            align: "center",
            valign: "top",
        });

        const textAlign = item.type === "header" ? "center" : item.type === "footer" ? "right" : "left";
        drawTextInBox(doc, X_M, rowY, CONTENT_WIDTH - wYear - wMonth, rowHeight, item.text, {
            size: 9,
            align: textAlign as "left" | "center" | "right",
            valign: "top",
            paddingX: item.type === "footer" ? 4 : 2,
        });
    });
}

function setupJapaneseFont(doc: jsPDF) {
    doc.addFileToVFS("NotoSansJP-Regular.otf", NotoSansJPRegular);
    doc.addFont("NotoSansJP-Regular.otf", "NotoSansJP", "normal");
    doc.setFont("NotoSansJP");
}

/**
 * 履歴書PDFを生成
 */
export function generateResumePDF(data: ResumeData): jsPDF {
    const doc = new jsPDF("p", "mm", "a4");

    setupJapaneseFont(doc);

    // 学歴・職歴データの準備
    const combinedHistory: Array<{ year: string; month: string; text: string; type: string }> = [
        { type: "header", text: "学歴", year: "", month: "" },
        ...data.education.flatMap(edu => [
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
                text: `${edu.schoolName} ${edu.department} ${edu.status === "graduated" ? "卒業" : edu.status === "expected" ? "卒業見込" : "中途退学"}`,
            },
        ]),
        { type: "header", text: "職歴", year: "", month: "" },
        ...data.workHistory.flatMap(work => [
            {
                type: "work",
                year: work.startDate.year,
                month: work.startDate.month,
                text: `${work.companyName} 入社`,
            },
            ...(work.description ? [{
                type: "work",
                year: "",
                month: "",
                text: `　${work.description}`,
            }] : []),
            ...(work.isCurrent ? [] : [{
                type: "work",
                year: work.endDate.year,
                month: work.endDate.month,
                text: `${work.companyName} 退社`,
            }]),
        ]),
        { type: "footer", text: "以上", year: "", month: "" },
    ];

    let currentY = PAGE_HEIGHT - MARGIN;

    // ==========================================
    // 1ページ目
    // ==========================================

    // ヘッダー
    doc.setFontSize(24);
    doc.text("履　歴　書", MARGIN, convertY(currentY - 10));
    doc.setFontSize(10);
    const submissionDateText = data.submissionDate ? `${data.submissionDate}現在` : "年　 　月　 　日現在";
    doc.text(submissionDateText, PAGE_WIDTH - MARGIN, convertY(currentY - 10), { align: "right" });
    currentY -= 18;

    // 基本情報（氏名・写真）
    const BLOCK_H = 36;
    const PHOTO_W = 30;
    const GAP = 3;
    const NAME_W = CONTENT_WIDTH - PHOTO_W - GAP;

    const topY = currentY;
    const bottomY = topY - BLOCK_H;

    // 写真枠
    drawRect(doc, PAGE_WIDTH - MARGIN - PHOTO_W, bottomY, PHOTO_W, BLOCK_H, LINE_THIN);

    // 写真がある場合は埋め込み、ない場合は説明文
    if (data.photoUrl) {
        try {
            // Base64画像を埋め込み
            doc.addImage(
                data.photoUrl,
                'JPEG',
                PAGE_WIDTH - MARGIN - PHOTO_W,
                convertY(topY) - BLOCK_H,
                PHOTO_W,
                BLOCK_H
            );
        } catch (error) {
            console.error('Failed to embed photo:', error);
            // エラーの場合は説明文を表示
            doc.setFontSize(8);
            const photoLines = ["写真を貼る位置", "縦 36～40mm", "横 24～30mm", "本人単身胸から上", "裏面のりづけ"];
            photoLines.forEach((line, i) => {
                doc.text(line, PAGE_WIDTH - MARGIN - PHOTO_W + 4, convertY(topY - 8 - (i * 3)));
            });
        }
    } else {
        // 写真がない場合は説明文を表示
        doc.setFontSize(8);
        const photoLines = ["写真を貼る位置", "縦 36～40mm", "横 24～30mm", "本人単身胸から上", "裏面のりづけ"];
        photoLines.forEach((line, i) => {
            doc.text(line, PAGE_WIDTH - MARGIN - PHOTO_W + 4, convertY(topY - 8 - (i * 3)));
        });
    }

    // 氏名枠
    drawRect(doc, MARGIN, bottomY, NAME_W, BLOCK_H, LINE_THICK);

    const FURI_H = 8;
    const NAME_H = BLOCK_H - FURI_H;

    drawLine(doc, MARGIN, topY - FURI_H, MARGIN + NAME_W, topY - FURI_H, LINE_THIN);
    drawTextInBox(doc, MARGIN, topY - FURI_H, 20, FURI_H, "フリガナ", { size: 9 });
    drawTextInBox(doc, MARGIN + 20, topY - FURI_H, NAME_W - 20, FURI_H,
        `${toKatakana(data.profile.lastNameKana)}　${toKatakana(data.profile.firstNameKana)}`, { size: 9 });

    drawTextInBox(doc, MARGIN, bottomY, 20, NAME_H, "氏　　名", { size: 10.5, valign: "top" });
    drawTextInBox(doc, MARGIN + 20, bottomY, NAME_W - 20, NAME_H,
        `${data.profile.lastName}　${data.profile.firstName}`, { size: 28, valign: "center" });

    currentY = bottomY;

    // 生年月日
    const BIRTH_H = 10;
    drawRect(doc, MARGIN, currentY - BIRTH_H, NAME_W, BIRTH_H, LINE_THICK);

    // 年齢計算
    let age = "";
    if (data.profile.birthday.year && data.profile.birthday.month && data.profile.birthday.day) {
        const birthDateStr = `${data.profile.birthday.year}-${data.profile.birthday.month.toString().padStart(2, '0')}-${data.profile.birthday.day.toString().padStart(2, '0')}`;
        age = calculateAge(birthDateStr).toString();
    }

    drawTextInBox(doc, MARGIN, currentY - BIRTH_H, NAME_W, BIRTH_H,
        `${data.profile.birthday.year}年　${data.profile.birthday.month}月　${data.profile.birthday.day}日生　（満 ${age} 歳）`,
        { paddingX: 20 });

    currentY -= (BIRTH_H + 6);

    // 住所・連絡先（詳細版）
    const H_ADDR_BLOCK = 32; // 現住所・連絡先それぞれのブロックの高さ
    const H_FURI = 8;       // ふりがな行の高さ
    const H_ADDR_MAIN = 24;  // 住所本体の高さ
    const W_LABEL = 20;      // ラベル幅
    const W_TEL_EMAIL = 53;  // 電話・メール欄の幅
    const H_TEL = 16;        // 電話・メール各行の高さ

    // 住所・連絡先全体の枠
    drawRect(doc, MARGIN, currentY - (H_ADDR_BLOCK * 2), CONTENT_WIDTH, H_ADDR_BLOCK * 2, LINE_THICK);

    // ===== 現住所エリア =====
    const addrTopY = currentY;
    const addrBottomY = currentY - H_ADDR_BLOCK;

    // 現住所エリアの下線
    drawLine(doc, MARGIN, addrBottomY, MARGIN + CONTENT_WIDTH, addrBottomY, LINE_THIN);

    // 左右の分割線
    const addrLeftW = CONTENT_WIDTH - W_TEL_EMAIL;
    drawLine(doc, MARGIN + addrLeftW, addrTopY, MARGIN + addrLeftW, addrBottomY, LINE_THIN);

    // == 左側：ふりがな + 住所 ==
    // ふりがな行
    drawLine(doc, MARGIN, addrTopY - H_FURI, MARGIN + addrLeftW, addrTopY - H_FURI, LINE_THIN);
    drawLine(doc, MARGIN + W_LABEL, addrTopY, MARGIN + W_LABEL, addrTopY - H_FURI, LINE_THIN);
    drawTextInBox(doc, MARGIN, addrTopY - H_FURI, W_LABEL, H_FURI, "フリガナ", { size: 9, valign: "bottom" });
    drawTextInBox(doc, MARGIN + W_LABEL, addrTopY - H_FURI, addrLeftW - W_LABEL, H_FURI,
        toKatakana(data.profile.address.kana), { size: 9, valign: "bottom" });

    // 住所行
    drawLine(doc, MARGIN + W_LABEL, addrTopY - H_FURI, MARGIN + W_LABEL, addrBottomY, LINE_THIN);
    drawTextInBox(doc, MARGIN, addrBottomY, W_LABEL, H_ADDR_MAIN, "現住所", { size: 9, valign: "top" });

    // 〒マーク
    const W_POST_MARK = 10;
    drawTextInBox(doc, MARGIN + W_LABEL, addrBottomY, W_POST_MARK, H_ADDR_MAIN, "〒", { size: 9, valign: "top" });

    // 郵便番号と住所
    const addressText = `${data.profile.address.postalCode}\n${data.profile.address.prefecture}${data.profile.address.city}${data.profile.address.building ? '\n' + data.profile.address.building : ''}`;
    const addressLines = addressText.split('\n');
    let lineY = addrTopY - H_FURI - 3;
    addressLines.forEach((line, idx) => {
        drawTextInBox(doc, MARGIN + W_LABEL + W_POST_MARK, lineY - (idx * 5), addrLeftW - W_LABEL - W_POST_MARK, 5,
            line, { size: 9, valign: "top", paddingX: 1 });
    });

    // == 右側：電話 + Email ==
    const telEmailX = MARGIN + addrLeftW;

    // 電話行
    drawLine(doc, telEmailX, addrTopY - H_TEL, MARGIN + CONTENT_WIDTH, addrTopY - H_TEL, LINE_THIN);
    const W_TEL_LABEL = 13;
    drawLine(doc, telEmailX + W_TEL_LABEL, addrTopY, telEmailX + W_TEL_LABEL, addrTopY - H_TEL, LINE_THIN);
    drawTextInBox(doc, telEmailX, addrTopY - H_TEL, W_TEL_LABEL, H_TEL, "電話", { size: 9, valign: "top" });
    drawTextInBox(doc, telEmailX + W_TEL_LABEL, addrTopY - H_TEL, W_TEL_EMAIL - W_TEL_LABEL, H_TEL,
        data.profile.phone, { size: 9, align: "center" });

    // Email行
    drawLine(doc, telEmailX + W_TEL_LABEL, addrTopY - H_TEL, telEmailX + W_TEL_LABEL, addrBottomY, LINE_THIN);
    drawTextInBox(doc, telEmailX, addrBottomY, W_TEL_LABEL, H_TEL, "E-mail", { size: 9, valign: "top" });
    drawTextInBox(doc, telEmailX + W_TEL_LABEL, addrBottomY, W_TEL_EMAIL - W_TEL_LABEL, H_TEL,
        data.profile.email, { size: 8, align: "center" });

    // ===== 連絡先エリア（現住所以外） =====
    const contactTopY = addrBottomY;
    const contactBottomY = contactTopY - H_ADDR_BLOCK;

    // 左右の分割線
    drawLine(doc, MARGIN + addrLeftW, contactTopY, MARGIN + addrLeftW, contactBottomY, LINE_THIN);

    // == 左側：ふりがな + 住所 ==
    // ふりがな行
    drawLine(doc, MARGIN, contactTopY - H_FURI, MARGIN + addrLeftW, contactTopY - H_FURI, LINE_THIN);
    drawLine(doc, MARGIN + W_LABEL, contactTopY, MARGIN + W_LABEL, contactTopY - H_FURI, LINE_THIN);
    drawTextInBox(doc, MARGIN, contactTopY - H_FURI, W_LABEL, H_FURI, "フリガナ", { size: 9, valign: "bottom" });
    drawTextInBox(doc, MARGIN + W_LABEL, contactTopY - H_FURI, addrLeftW - W_LABEL, H_FURI,
        toKatakana(data.profile.contactAddress?.kana || ""), { size: 9, valign: "bottom" });

    // 住所行
    drawLine(doc, MARGIN + W_LABEL, contactTopY - H_FURI, MARGIN + W_LABEL, contactBottomY, LINE_THIN);
    drawTextInBox(doc, MARGIN, contactBottomY, W_LABEL, H_ADDR_MAIN, "連絡先", { size: 9, valign: "top" });

    // 〒マーク
    drawTextInBox(doc, MARGIN + W_LABEL, contactBottomY, W_POST_MARK, H_ADDR_MAIN, "〒", { size: 9, valign: "top" });

    // 説明文 + 住所
    let contactAddrY = contactTopY - H_FURI - 3;
    drawTextInBox(doc, MARGIN + W_LABEL + W_POST_MARK, contactAddrY, addrLeftW - W_LABEL - W_POST_MARK, 5,
        "（現住所以外に連絡を希望する場合のみ記入）", { size: 8, valign: "top", paddingX: 1 });

    if (data.profile.contactAddress?.postalCode) {
        const contactAddressText = `${data.profile.contactAddress.postalCode}\n${data.profile.contactAddress.prefecture}${data.profile.contactAddress.city}${data.profile.contactAddress.building ? '\n' + data.profile.contactAddress.building : ''}`;
        const contactLines = contactAddressText.split('\n');
        contactLines.forEach((line, idx) => {
            drawTextInBox(doc, MARGIN + W_LABEL + W_POST_MARK, contactAddrY - 5 - (idx * 5), addrLeftW - W_LABEL - W_POST_MARK, 5,
                line, { size: 9, valign: "top", paddingX: 1 });
        });
    }

    // == 右側：電話 + Email ==
    // 電話行
    drawLine(doc, telEmailX, contactTopY - H_TEL, MARGIN + CONTENT_WIDTH, contactTopY - H_TEL, LINE_THIN);
    drawLine(doc, telEmailX + W_TEL_LABEL, contactTopY, telEmailX + W_TEL_LABEL, contactTopY - H_TEL, LINE_THIN);
    drawTextInBox(doc, telEmailX, contactTopY - H_TEL, W_TEL_LABEL, H_TEL, "電話", { size: 9, valign: "top" });
    drawTextInBox(doc, telEmailX + W_TEL_LABEL, contactTopY - H_TEL, W_TEL_EMAIL - W_TEL_LABEL, H_TEL,
        data.profile.contactAddress?.phone || "", { size: 9, align: "center" });

    // Email行
    drawLine(doc, telEmailX + W_TEL_LABEL, contactTopY - H_TEL, telEmailX + W_TEL_LABEL, contactBottomY, LINE_THIN);
    drawTextInBox(doc, telEmailX, contactBottomY, W_TEL_LABEL, H_TEL, "E-mail", { size: 9, valign: "top" });
    drawTextInBox(doc, telEmailX + W_TEL_LABEL, contactBottomY, W_TEL_EMAIL - W_TEL_LABEL, H_TEL,
        data.profile.contactAddress?.email || "", { size: 8, align: "center" });

    currentY = contactBottomY - 4;

    // 学歴・職歴テーブル
    const H_ROW = 7.5;
    const W_YEAR = 22;
    const W_MONTH = 12;
    const bottomLimit = 25;
    const availableH = (currentY - 8) - bottomLimit;
    const numRowsP1 = Math.floor(availableH / H_ROW);

    drawTableSection(doc, currentY, H_ROW, numRowsP1, W_YEAR, W_MONTH,
        "学　歴　・　職　歴　（各別にまとめて書く）");

    const page1History = combinedHistory.slice(0, numRowsP1);
    drawHistoryData(doc, currentY, H_ROW, page1History, W_YEAR, W_MONTH);

    // ==========================================
    // 2ページ目
    // ==========================================
    doc.addPage();
    currentY = PAGE_HEIGHT - MARGIN;

    // 学歴・職歴（続き）
    const ROWS_HISTORY_P2 = 12;
    drawTableSection(doc, currentY, H_ROW, ROWS_HISTORY_P2, W_YEAR, W_MONTH,
        "学　歴　・　職　歴　（各別にまとめて書く）");

    const page2History = combinedHistory.slice(numRowsP1, numRowsP1 + ROWS_HISTORY_P2);
    drawHistoryData(doc, currentY, H_ROW, page2History, W_YEAR, W_MONTH);

    currentY -= (8 + (ROWS_HISTORY_P2 * H_ROW));



    const sectionWidth = CONTENT_WIDTH;
    const sectionX = MARGIN;

    // 志望動機
    const motivationHeight = 36;
    drawMultiLineSection(
        doc,
        "志望動機",
        data.motivation || "",
        sectionX,
        currentY,
        sectionWidth,
        motivationHeight
    );
    currentY -= motivationHeight + 4;

    // 自己PR
    const selfPromotionHeight = 36;
    drawMultiLineSection(
        doc,
        "自己PR",
        data.selfPromotion || "",
        sectionX,
        currentY,
        sectionWidth,
        selfPromotionHeight
    );
    currentY -= selfPromotionHeight + 4;

    // 資格・免許（あれば）
    const certText = (data.certifications || [])
        .map(cert => `${cert.date.year}年${cert.date.month}月 ${cert.name}`)
        .join("\n");

    if (certText) {
        const certHeight = 28;
        drawMultiLineSection(
            doc,
            "資格・免許",
            certText,
            sectionX,
            currentY,
            sectionWidth,
            certHeight
        );
        currentY -= certHeight + 4;
    }

    // 本人希望記入欄
    const requestsHeight = 28;
    drawMultiLineSection(
        doc,
        "本人希望記入欄",
        data.requests || "",
        sectionX,
        currentY,
        sectionWidth,
        requestsHeight
    );
    currentY -= requestsHeight + 4;

    return doc;
}

/**
 * PDFをダウンロード
 */
export function downloadResumePDF(data: ResumeData, filename: string = "resume.pdf") {
    const doc = generateResumePDF(data);
    doc.save(filename);
}
