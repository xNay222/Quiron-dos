# Para las historias cuyo procedimiento está escrito a mano: recorta de cada PDF la zona clave
#  · hoja de CONSENTIMIENTO: "procedimiento a realizar" y "médico tratante" (franja superior)
#  · si no hay consentimiento: HISTORIA CLÍNICA de ingreso, franja inferior (diagnóstico, fecha, médico tratante)
# y junta 4 historias por imagen, numeradas, en "datos privados\recortes\r-NNN.jpg" + "recortes.json" (qué historia es cada número).
param([int]$PorImagen = 3, [switch]$Todas)
Add-Type -AssemblyName System.Drawing
$proj = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $proj 'datos privados\ocr'; $out = Join-Path $proj 'datos privados\recortes'
New-Item -ItemType Directory -Force $out | Out-Null; Get-ChildItem $out -Filter 'r-*.jpg' | Remove-Item -Force
$auto = @{}; $ap = Join-Path $proj 'datos privados\extraccion-auto.json'
if (Test-Path $ap) { (Get-Content -Raw -Encoding UTF8 $ap | ConvertFrom-Json) | ForEach-Object { $auto[$_.id] = $_ } }
$o = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'OneDrive\Escritorio') -Directory -Force | Where-Object Name -like 'HISTORIAS MEDICAS QUIRON*' | Select-Object -First 1
$base = (Get-ChildItem -LiteralPath $o.FullName -Directory -Force | Where-Object Name -like 'HISTORIAS MEDICAS QUIRON*' | Select-Object -First 1).FullName
$latin = [Text.Encoding]::GetEncoding(28591)
function PageJpeg($pdfPath, [int]$k) {   # k-ésima imagen JPEG del PDF (mismo orden que el OCR)
  $bytes = [IO.File]::ReadAllBytes($pdfPath); $s = $latin.GetString($bytes); $n = -1
  foreach ($m in [regex]::Matches($s, '/Subtype\s*/Image(.{0,600}?)stream\r?\n', 'Singleline')) {
    if ($m.Groups[1].Value -notmatch 'DCTDecode') { continue }; $n++; if ($n -ne $k) { continue }
    $start = $m.Index + $m.Length; $end = $s.IndexOf('endstream', $start)
    $len = $end - $start; while ($len -gt 0 -and ($bytes[$start + $len - 1] -eq 10 -or $bytes[$start + $len - 1] -eq 13)) { $len-- }
    return [Drawing.Image]::FromStream((New-Object IO.MemoryStream($bytes, $start, $len, $false))) }
  return $null }
$items = New-Object System.Collections.ArrayList
foreach ($f in (Get-ChildItem $dir -Filter *.json | Sort-Object Name)) {
  $d = Get-Content -Raw -Encoding UTF8 $f.FullName | ConvertFrom-Json; $a = $auto[$f.BaseName]
  if (-not $Todas -and $a -and $a.proc.Count -gt 0 -and $a.surgeon) { continue }   # ya se sabe por el texto a máquina
  $pages = @($d.pages | ForEach-Object { [string]$_ })
  $zones = @()
  for ($i = 0; $i -lt $pages.Count; $i++) { if ($pages[$i] -match '(?i)HISTORIA\s+CL[IÍ]NICA' -and $pages[$i] -match '(?i)MOTIVO|DIAGN') { $zones += [pscustomobject]@{ page = $i + 1; zone = 'historia'; y0 = 0.55; y1 = 0.97 }; break } }
  for ($i = 0; $i -lt $pages.Count; $i++) { if ($pages[$i] -match '(?i)CONSENTIMIENTO') { $zones += [pscustomobject]@{ page = $i + 1; zone = 'consent'; y0 = 0.18; y1 = 0.38 }; break } }
  if (-not $zones.Count) { continue }
  [void]$items.Add([pscustomobject]@{ id = $f.BaseName; rel = $d.rel; zones = $zones })
}$font = New-Object Drawing.Font('Arial', 34, [Drawing.FontStyle]::Bold); $W = 1300
$map = @(); $img = 0
for ($g = 0; $g -lt $items.Count; $g += $PorImagen) {
  $grp = $items[$g..([math]::Min($g + $PorImagen, $items.Count) - 1)]; $crops = @()
  foreach ($it in $grp) {
    $num = $map.Count + 1; $pdf = Join-Path $base ($it.rel -replace '/', '\')
    foreach ($z in $it.zones) {
      $src = PageJpeg $pdf ($z.page - 1); if (-not $src) { continue }
      $rect = New-Object Drawing.Rectangle(0, [int]($src.Height * $z.y0), $src.Width, [int]($src.Height * ($z.y1 - $z.y0)))
      $h = [int]($rect.Height * $W / $rect.Width); $bmp = [Drawing.Bitmap]::new($W, $h + 50); $gr = [Drawing.Graphics]::FromImage($bmp)
      $gr.Clear([Drawing.Color]::White); $gr.InterpolationMode = 'HighQualityBicubic'; $gr.DrawImage($src, (New-Object Drawing.Rectangle(0, 50, $W, $h)), $rect, 'Pixel')
      $gr.FillRectangle([Drawing.Brushes]::Black, 0, 0, $W, 48); $gr.DrawString("#$num  $($z.zone)", $font, [Drawing.Brushes]::Yellow, 8, 2)
      $gr.Dispose(); $src.Dispose(); $crops += $bmp }
    $map += [pscustomobject]@{ n = $num; id = $it.id; rel = $it.rel; zones = ($it.zones | ForEach-Object { "$($_.zone):$($_.page)" }) -join ' '; img = $img + 1 }
  }  if (-not $crops.Count) { continue }
  $img++; $H = ($crops | Measure-Object Height -Sum).Sum + 8 * $crops.Count
  $sheet = New-Object Drawing.Bitmap($W, $H); $gs = [Drawing.Graphics]::FromImage($sheet); $gs.Clear([Drawing.Color]::Gray); $y = 0
  foreach ($c in $crops) { $gs.DrawImage($c, 0, $y); $y += $c.Height + 8; $c.Dispose() }
  $enc = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'; $ep = New-Object Drawing.Imaging.EncoderParameters(1); $ep.Param[0] = New-Object Drawing.Imaging.EncoderParameter([Drawing.Imaging.Encoder]::Quality, [long]70)
  $sheet.Save((Join-Path $out ('r-{0:d3}.jpg' -f $img)), $enc, $ep); $gs.Dispose(); $sheet.Dispose()
}
$map | ConvertTo-Json -Depth 3 | Out-File -Encoding utf8 (Join-Path $out 'recortes.json')
"Historias a leer a mano: $($items.Count) · imágenes: $img · con historia de ingreso: $(@($items | Where-Object { $_.zones.zone -contains 'historia' }).Count) · con consentimiento: $(@($items | Where-Object { $_.zones.zone -contains 'consent' }).Count)"
