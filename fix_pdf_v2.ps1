# 単純な行ベースのアプローチで確実に修正
$file = "c:\Projects\ai-resume-builder\lib\pdfGenerator.ts";
$lines = Get-Content $file -Encoding UTF8;
$output = @();
$skipLines = $false;

for ($i = 0; $i -lt $lines.Length; $i++) {
    # Line 98から149までをスキップ（ネストされた関数定義）
    if ($i -ge 98 -and $i -le 149) {
        continue;
    }
    
    # Line 97の後（インデックス97）に新しい関数を追加
    if ($i -eq 97) {
        $output += $lines[$i];
        $output += "}";
        $output += "";
        $output += "/**";
        $output += " * 複数行テキストをボックス内に描画（折り返し対応）";
        $output += " */";
        $output += "function drawMultilineTextInBox(";
        $output += "    doc: jsPDF,";
        $output += "    x: number,";
        $output += "    y: number,";
        $output += "    w: number,";
        $output += "    h: number,";
        $output += "    text: string,";
        $output += "    options: {";
        $output += "        size?: number;";
        $output += "        lineHeight?: number;";
        $output += "        paddingX?: number;";
        $output += "        paddingY?: number;";
        $output += "    } = {}";
        $output += ") {";
        $output += "    const {";
        $output += "        size = 9,";
        $output += "        lineHeight = 5,";
        $output += "        paddingX = 2,";
        $output += "        paddingY = 2,";
        $output += "    } = options;";
        $output += "";
        $output += "    doc.setFontSize(size);";
        $output += "";
        $output += "    const lines = text.split('\n');";
        $output += "    const allLines: string[] = [];";
        $output += "    ";
        $output += "    lines.forEach(line => {";
        $output += "        if (!line) {";
        $output += "            allLines.push('');";
        $output += "            return;";
        $output += "        }";
        $output += "        const wrappedLines = doc.splitTextToSize(line, w - (paddingX * 2));";
        $output += "        allLines.push(...wrappedLines);";
        $output += "    });";
        $output += "";
        $output += "    const boxTop = convertY(y);";
        $output += "    let currentLineY = boxTop - paddingY - (size * 0.35);";
        $output += "";
        $output += "    allLines.forEach((line, idx) => {";
        $output += "        if (currentLineY > boxTop - h + paddingY) {";
        $output += "            doc.text(line, x + paddingX, currentLineY);";
        $output += "            currentLineY -= lineHeight;";
        $output += "        }";
        $output += "    });";
        $output += "}";
        continue;
    }
    
    # Line 535の後にテキストセクションを追加
    if ($lines[$i] -match '^\s+currentY -= \(8 \+ \(ROWS_CERT \* H_ROW\) \+ 4\);') {
        $output += $lines[$i];
        $output += "";
        $output += "    // 志望動機・自己PR・アピールポイントなど";
        $output += "    const H_MOTIVATION = 120;";
        $output += "    drawRect(doc, MARGIN, currentY - H_MOTIVATION, CONTENT_WIDTH, H_MOTIVATION, LINE_THICK);";
        $output += "    ";
        $output += "    // タイトル";
        $output += "    const H_TITLE = 8;";
        $output += "    drawLine(doc, MARGIN, currentY - H_TITLE, MARGIN + CONTENT_WIDTH, currentY - H_TITLE, LINE_THIN);";
        $output += "    drawTextInBox(doc, MARGIN, currentY - H_TITLE, CONTENT_WIDTH, H_TITLE, ";
        $output += "        \"志望の動機、特技、自己PR、アピールポイントなど\", { size: 9, paddingX: 2 });";
        $output += "    ";
        $output += "    // テキスト内容";
        $output += "    let motivationText = \"\";";
        $output += "    if (data.motivation && data.selfPromotion) {";
        $output += "        motivationText = ``【志望動機】\n``${data.motivation}\n\n【自己PR】\n``${data.selfPromotion}``;";
        $output += "    } else if (data.motivation) {";
        $output += "        motivationText = data.motivation;";
        $output += "    } else if (data.selfPromotion) {";
        $output += "        motivationText = data.selfPromotion;";
        $output += "    }";
        $output += "    ";
        $output += "    if (motivationText) {";
        $output += "        drawMultilineTextInBox(doc, MARGIN, currentY - H_TITLE, CONTENT_WIDTH, H_MOTIVATION - H_TITLE, ";
        $output += "            motivationText, { size: 9, lineHeight: 5, paddingX: 3, paddingY: 3 });";
        $output += "    }";
        $output += "    ";
        $output += "    currentY -= (H_MOTIVATION + 4);";
        $output += "    ";
        $output += "    // 本人希望記入欄";
        $output += "    const H_REQUESTS = 60;";
        $output += "    drawRect(doc, MARGIN, currentY - H_REQUESTS, CONTENT_WIDTH, H_REQUESTS, LINE_THICK);";
        $output += "    ";
        $output += "    // タイトル";
        $output += "    drawLine(doc, MARGIN, currentY - H_TITLE, MARGIN + CONTENT_WIDTH, currentY - H_TITLE, LINE_THIN);";
        $output += "    drawTextInBox(doc, MARGIN, currentY - H_TITLE, CONTENT_WIDTH, H_TITLE, ";
        $output += "        \"本人希望記入欄（特に給料、職種、勤務時間、勤務地、その他についての希望などがあれば記入）\", { size: 9, paddingX: 2 });";
        $output += "    ";
        $output += "    // テキスト内容";
        $output += "    if (data.requests) {";
        $output += "        drawMultilineTextInBox(doc, MARGIN, currentY - H_TITLE, CONTENT_WIDTH, H_REQUESTS - H_TITLE, ";
        $output += "            data.requests, { size: 9, lineHeight: 5, paddingX: 3, paddingY: 3 });";
        $output += "    }";
        continue;
    }
    
    $output += $lines[$i];
}

# ファイルに保存
[System.IO.File]::WriteAllLines($file, $output, [System.Text.UTF8Encoding]::new($false));
Write-Host "Successfully fixed pdfGenerator.ts!";
Write-Host "- Removed nested function definition (lines 99-149)";
Write-Host "- Added drawMultilineTextInBox function correctly";
Write-Host "- Added motivation and requests sections";
