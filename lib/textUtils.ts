/**
 * テキスト整形と文字数制限ユーティリティ
 */

/**
 * 余計な改行やスペースを削除
 */
export function normalizeText(text: string): string {
    if (!text) return "";

    let normalized = text
        // 連続する改行を2つまでに制限
        .replace(/\n{3,}/g, "\n\n")
        // 行頭・行末の空白を削除
        .split("\n")
        .map(line => line.trim())
        .join("\n")
        // 全体の前後の空白を削除
        .trim();

    // 半角カッコを全角に変換
    normalized = normalized
        .replace(/\(/g, "（")
        .replace(/\)/g, "）");

    // 半角角カッコを全角に変換
    normalized = normalized
        .replace(/\[/g, "［")
        .replace(/\]/g, "］");

    // ダブルクォーテーションで囲まれた部分を全角カギカッコに変換
    normalized = normalized.replace(/"([^"]+)"/g, "「$1」");

    // シングルクォーテーションで囲まれた部分を二重カギカッコに変換
    normalized = normalized.replace(/'([^']+)'/g, "『$1』");

    return normalized;
}

/**
 * 文字数制限を適用
 */
export function limitTextLength(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.substring(0, maxLength);
}

/**
 * テキストの行数を計算
 */
export function countLines(text: string): number {
    return text.split("\n").length;
}

/**
 * 指定された行数に収まるようにテキストを切り詰め
 */
export function limitLines(text: string, maxLines: number): string {
    const lines = text.split("\n");
    if (lines.length <= maxLines) {
        return text;
    }
    return lines.slice(0, maxLines).join("\n");
}

/**
 * 志望動機用の文字数制限（約600文字、15行程度）
 */
export const MOTIVATION_MAX_LENGTH = 600;
export const MOTIVATION_MAX_LINES = 15;

/**
 * 本人希望記入欄用の文字数制限（約300文字、8行程度）
 */
export const REQUESTS_MAX_LENGTH = 300;
export const REQUESTS_MAX_LINES = 8;

/**
 * 全角英数字を半角に変換
 */
export function toHalfWidth(str: string): string {
    return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, function (s) {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
}
