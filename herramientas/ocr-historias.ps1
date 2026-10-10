# Lee el texto de las historias escaneadas con el OCR de Windows (en esta computadora; nada sale a internet).
# Por cada PDF guarda "datos privados\ocr\<id>.json" con el texto de cada página. Si ya existe, lo salta (se puede reanudar).
#   powershell -File herramientas\ocr-historias.ps1 [-Worker 0 -Workers 1] [-Solo "texto en la ruta"]
param([int]$Worker = 0, [int]$Workers = 1, [string]$Solo = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Foundation, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new('es-ES'))

$proj = Split-Path $PSScriptRoot -Parent
$out = Join-Path $proj 'datos privados\ocr'; New-Item -ItemType Directory -Force $out | Out-Null
# La carpeta del Escritorio termina en un carácter invisible: se busca por comodín
$o = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'OneDrive\Escritorio') -Directory -Force | Where-Object Name -like 'HISTORIAS MEDICAS QUIRON*' | Select-Object -First 1
$base = (Get-ChildItem -LiteralPath $o.FullName -Directory -Force | Where-Object Name -like 'HISTORIAS MEDICAS QUIRON*' | Select-Object -First 1).FullName
$files = Get-ChildItem -LiteralPath $base -Recurse -File -Force -Filter *.pdf | Where-Object { $_.Name -notlike '._*' } | Sort-Object FullName
if ($Solo) { $files = $files | Where-Object { $_.FullName -like "*$Solo*" } }
$md5 = [Security.Cryptography.MD5]::Create()
$latin = [Text.Encoding]::GetEncoding(28591)
$n = 0; $done = 0
foreach ($f in $files) {
  $n++; if (($n - 1) % $Workers -ne $Worker) { continue }
  $rel = ($f.FullName.Substring($base.Length + 1)) -replace '\\', '/'
  $id = -join ($md5.ComputeHash([Text.Encoding]::UTF8.GetBytes($rel)) | ForEach-Object { $_.ToString('x2') })
  $dst = Join-Path $out "$id.json"; if (Test-Path -LiteralPath $dst) { continue }
  $t0 = Get-Date; $bytes = [IO.File]::ReadAllBytes($f.FullName); $s = $latin.GetString($bytes)
  $pages = @(); $skipped = 0
  foreach ($m in [regex]::Matches($s, '/Subtype\s*/Image(.{0,600}?)stream\r?\n', 'Singleline')) {
    if ($m.Groups[1].Value -notmatch 'DCTDecode') { $skipped++; continue }
    $start = $m.Index + $m.Length; $end = $s.IndexOf('endstream', $start); if ($end -lt 0) { continue }
    $len = $end - $start; while ($len -gt 0 -and ($bytes[$start + $len - 1] -eq 10 -or $bytes[$start + $len - 1] -eq 13)) { $len-- }
    try {
      $ms = New-Object IO.MemoryStream($bytes, $start, $len, $false)
      $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
      $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
      $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
      $res = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
      $pages += , (($res.Lines | ForEach-Object { $_.Text }) -join "`n")
      $bmp.Dispose(); $ras.Dispose(); $ms.Dispose()
    } catch { $pages += , '' }
  }
  [pscustomobject]@{ rel = $rel; pages = $pages; skipped = $skipped; secs = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1) } | ConvertTo-Json -Depth 3 -Compress | Out-File -Encoding utf8 -LiteralPath $dst
  $done++; Write-Host ("[{0}] {1} · {2} páginas · {3:n1} s" -f $Worker, $rel, $pages.Count, ((Get-Date) - $t0).TotalSeconds)
}
Write-Host "Trabajador $Worker terminado: $done historias leídas."
