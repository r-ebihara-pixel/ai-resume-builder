$ErrorActionPreference = "Stop"

# ディレクトリ作成
$fontDir = "c:\Projects\ai-resume-builder\lib\fonts"
if (-not (Test-Path $fontDir)) {
    New-Item -ItemType Directory -Path $fontDir | Out-Null
    Write-Host "Created directory: $fontDir"
}

# フォントダウンロード (Noto Sans CJK JP Regular)
# サイズを抑えるため、Google Fontsのサブセットがあれば良いが、今回はGitHubのRawファイルを使用
# 注意: ファイルサイズが大きい(数MB)
$fontUrl = "https://raw.githubusercontent.com/googlefonts/noto-cjk/main/Sans/OTF/Japanese/NotoSansCJKjp-Regular.otf"
$tempFontFile = "$fontDir\temp_font.otf"
$outputTsFile = "$fontDir\NotoSansJP.ts"

Write-Host "Downloading font from $fontUrl ..."
try {
    Invoke-WebRequest -Uri $fontUrl -OutFile $tempFontFile
}
catch {
    Write-Error "Failed to download font: $_"
    exit 1
}

if (-not (Test-Path $tempFontFile)) {
    Write-Error "Downloaded file not found."
    exit 1
}

$fileSize = (Get-Item $tempFontFile).Length
Write-Host "Downloaded font size: $fileSize bytes"

# Base64変換
Write-Host "Converting to Base64..."
$bytes = [System.IO.File]::ReadAllBytes($tempFontFile)
$base64 = [System.Convert]::ToBase64String($bytes)

# TSファイル生成
Write-Host "Generating $outputTsFile ..."
$content = "export const NotoSansJPRegular = `"$base64`";"
[System.IO.File]::WriteAllText($outputTsFile, $content)

# 一時ファイル削除
Remove-Item $tempFontFile
Write-Host "Done! Font saved to $outputTsFile"
