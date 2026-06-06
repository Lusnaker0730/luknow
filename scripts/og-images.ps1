# Generate per-article OG share images (1200x630) from data/articles.json
# Brand palette: warm paper / ink / crimson. Title text rendered with Microsoft JhengHei.
# Usage:  powershell -ExecutionPolicy Bypass -File scripts/og-images.ps1
Add-Type -AssemblyName System.Drawing
$repo  = Split-Path $PSScriptRoot -Parent
$ogDir = Join-Path $repo "img\og"
if (-not (Test-Path $ogDir)) { New-Item -ItemType Directory -Path $ogDir -Force | Out-Null }
$articles = Get-Content (Join-Path $repo "data\articles.json") -Raw -Encoding UTF8 | ConvertFrom-Json

$paper = [System.Drawing.Color]::FromArgb(244,240,232)
$ink   = [System.Drawing.Color]::FromArgb(20,50,58)
$crim  = [System.Drawing.Color]::FromArgb(196,61,52)
$line  = [System.Drawing.Color]::FromArgb(227,219,204)
$inkBrush  = New-Object System.Drawing.SolidBrush($ink)
$crimBrush = New-Object System.Drawing.SolidBrush($crim)

$count = 0
foreach ($a in $articles) {
  $w = 1200; $h = 630
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear($paper)
  $g.DrawRectangle((New-Object System.Drawing.Pen($line, 3)), 28, 28, ($w-56), ($h-56))
  $g.FillRectangle($crimBrush, 90, 98, 46, 6)            # crimson accent bar
  # eyebrow = tag label
  $ebFont = New-Object System.Drawing.Font("Microsoft JhengHei", 27, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $g.DrawString([string]$a.tagLabel, $ebFont, $crimBrush, 86, 120)
  # title (auto-sized + wrapped)
  $len = ([string]$a.title).Length
  $ts = if ($len -le 18) { 66 } elseif ($len -le 30) { 54 } else { 44 }
  $tFont = New-Object System.Drawing.Font("Microsoft JhengHei", $ts, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $rect = New-Object System.Drawing.RectangleF(88, 178, 1024, 318)
  $g.DrawString([string]$a.title, $tFont, $inkBrush, $rect)
  # brand + ecg at bottom
  $brandFont = New-Object System.Drawing.Font("Microsoft JhengHei", 27, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  # 呂侑穎醫師的臨床筆記 — built from code points so PS 5.1 file-encoding can't garble it
  $brand = -join ([char[]](0x5442,0x4F91,0x7A4E,0x91AB,0x5E2B,0x7684,0x81E8,0x5E8A,0x7B46,0x8A18))
  $g.DrawString($brand, $brandFont, $inkBrush, 86, 540)
  $ecg = New-Object System.Drawing.Pen($crim, 4); $ecg.StartCap='Round'; $ecg.EndCap='Round'; $ecg.LineJoin='Round'
  $pts = @(
    (New-Object System.Drawing.PointF(792,558)),(New-Object System.Drawing.PointF(905,558)),
    (New-Object System.Drawing.PointF(930,532)),(New-Object System.Drawing.PointF(956,584)),
    (New-Object System.Drawing.PointF(980,548)),(New-Object System.Drawing.PointF(1000,558)),
    (New-Object System.Drawing.PointF(1110,558)))
  $g.DrawLines($ecg, $pts)
  $bmp.Save((Join-Path $ogDir ([string]$a.slug + ".png")), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose(); $count++
}
Write-Output "generated $count OG images in img/og/"
