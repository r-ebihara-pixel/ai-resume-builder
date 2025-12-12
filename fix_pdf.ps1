# Phase 1-5完成スクリプト
$file = "c:\Projects\ai-resume-builder\lib\pdfGenerator.ts";
$content = Get-Content $file -Raw -Encoding UTF8;

# 1. Line 99-149のネストされた関数定義を削除
$content = $content -replace '(?s)(\s+} else \{\r\n\s+doc\.text\(text, x \+ paddingX, textY\);\r\n\s+\}\r\n)\r\n\s+/\*\*\r\n\s+\* 複数行テキストをボックス内に描画.*?\}\r\n\s+\}\r\n\}', '$1}';

# 2. drawTextInBox関数の後にdrawMultilineTextInBox関数を追加
$drawMultilineFunc = @"

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
"@;

$content = $content -replace '(\s+} else \{\r\n\s+doc\.text\(text, x \+ paddingX, textY\);\r\n\s+\}\r\n\})', "`$1$drawMultilineFunc";

# 3. 志望動機・自己PR・本人希望のセクションを追加
$textSections = @"

    // 志望志向・自己PR・アピールポイントなど
    const H_MOTIVATION = 120;
    drawRect(doc, MARGIN, currentY - H_MOTIVATION, CONTENT_WIDTH, H_MOTIVATION, LINE_THICK);
    
    // タイトル
    const H_TITLE = 8;
    drawLine(doc, MARGIN, currentY - H_TITLE, MARGIN + CONTENT_WIDTH, currentY - H_TITLE, LINE_THIN);
    drawTextInBox(doc, MARGIN, currentY - H_TITLE, CONTENT_WIDTH, H_TITLE, 
        "志望の動機、特技、自己PR、アピールポイントなど", { size: 9, paddingX: 2 });
    
    // テキスト内容
    let motivationText = "";
    if (data.motivation && data.selfPromotion) {
        motivationText = `【志望動機】\n${data.motivation}\n\n【自己PR】\n${data.selfPromotion}`;
    } else if (data.motivation) {
        motivationText = data.motivation;
    } else if (data.selfPromotion) {
        motivationText = data.selfPromotion;
    }
    
    if (motivationText) {
        drawMultilineTextInBox(doc, MARGIN, currentY - H_TITLE, CONTENT_WIDTH, H_MOTIVATION - H_TITLE, 
            motivationText, { size: 9, lineHeight: 5, paddingX: 3, paddingY: 3 });
    }
    
    currentY -= (H_MOTIVATION + 4);
    
    // 本人希望記入欄
    const H_REQUESTS = 60;
    drawRect(doc, MARGIN, currentY - H_REQUESTS, CONTENT_WIDTH, H_REQUESTS, LINE_THICK);
    
    // タイトル
    drawLine(doc, MARGIN, currentY - H_TITLE, MARGIN + CONTENT_WIDTH, currentY - H_TITLE, LINE_THIN);
    drawTextInBox(doc, MARGIN, currentY - H_TITLE, CONTENT_WIDTH, H_TITLE, 
        "本人希望記入欄（特に給料、職種、勤務時間、勤務地、その他についての希望などがあれば記入）", { size: 9, paddingX: 2 });
    
    // テキスト内容
    if (data.requests) {
        drawMultilineTextInBox(doc, MARGIN, currentY - H_TITLE, CONTENT_WIDTH, H_REQUESTS - H_TITLE, 
            data.requests, { size: 9, lineHeight: 5, paddingX: 3, paddingY: 3 });
    }
"@;

$content = $content -replace '(\s+currentY -= \(8 \+ \(ROWS_CERT \* H_ROW\) \+ 4\);)\r\n\r\n(\s+return doc;)', "`$1$textSections`r`n`r`n`$2";

# ファイルに保存
[System.IO.File]::WriteAllText($file, $content, [System.Text.UTF8Encoding]::new($false));
Write-Host "Phase 1-5 implementation completed successfully!";
