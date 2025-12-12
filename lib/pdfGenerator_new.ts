import { jsPDF } from "jspdf";
import { ResumeData } from "@/types/resume";
import { calculateAge } from "@/lib/dateUtils";

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
 * 複数行テキストをボックス内に描画（折り返し対応）
 */
function drawMultilineTextInBox(
    doc: jsPDF,
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
    options: {
        size?: number;
        lineHeight?: number;
        paddingX?: number;
        paddingY?: number;
    } = {}
) {
    const {
        size = 9,
        lineHeight = 5,
        paddingX = 2,
        paddingY = 2,
    } = options;

    doc.setFontSize(size);

    const lines = text.split('\n');
    const allLines: string[] = [];

    lines.forEach(line => {
        if (!line) {
            allLines.push('');
            return;
        }
        const wrappedLines = doc.splitTextToSize(line, w - (paddingX * 2));
        allLines.push(...wrappedLines);
    });

    const boxTop = convertY(y);
    let currentLineY = boxTop - paddingY - (size * 0.35);

    allLines.forEach((line, idx) => {
        if (currentLineY > boxTop - h + paddingY) {
            doc.text(line, x + paddingX, currentLineY);
            currentLineY -= lineHeight;
        }
    });
}
