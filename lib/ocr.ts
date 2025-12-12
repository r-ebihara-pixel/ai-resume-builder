import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";

const REGION = process.env.AWS_REGION ?? "ap-northeast-1";
const MOCK_OCR = process.env.MOCK_OCR === "true";

/**
 * 画像ベース PDF / スキャン PDF からテキストを抽出する
 * - Mock mode: MOCK_OCR=true で明示的にダミーデータを返す
 * - Real mode: AWS Textract DetectDocumentText を利用
 */
export async function extractTextFromPdfByOcr(
  fileBuffer: Buffer | Uint8Array
): Promise<string> {
  // 1) MOCK MODE – for pipeline testing only
  if (MOCK_OCR) {
    const MOCK_TEXT = `
氏名  テスト 太郎（テスト タロウ）
生年月日  1990/01/01
住所  東京都テスト区テスト町1-2-3
学歴
2010/04 テスト大学 テスト学部 入学
2014/03 テスト大学 テスト学部 卒業

職歴
2014/04 テスト株式会社 入社
2020/03 テスト株式会社 退職

免許・資格
2015/06 普通自動車第一種運転免許 取得

志望動機
テスト用のダミーテキストです。

自己PR
テスト用のダミーテキストです。

本人希望記入欄
特にありません。
`;
    console.log("[OCR MOCK] Returning mock resume text");
    return MOCK_TEXT;
  }

  // 2) REAL TEXTRACT MODE
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.warn("[TEXTRACT WARNING] Missing AWS credentials");
      return "";
    }

    const client = new TextractClient({ region: REGION });

    const command = new DetectDocumentTextCommand({
      Document: { Bytes: fileBuffer instanceof Buffer ? fileBuffer : Buffer.from(fileBuffer) },
    });

    const response = await client.send(command);

    const lines =
      response.Blocks?.filter((b) => b.BlockType === "LINE" && b.Text)
        .map((b) => b.Text as string) ?? [];

    const text = lines.join("\n");

    // Production: Avoid logging full sensitive text. Log length only or first few chars if needed for debug.
    if (process.env.NODE_ENV === "development") {
      console.log("[TEXTRACT RAW TEXT]", text.slice(0, 500));
    } else {
      console.log("[TEXTRACT] Extracted text length:", text.length);
    }

    return text;
  } catch (err) {
    console.error("[TEXTRACT ERROR]", err);
    return "";
  }
}
