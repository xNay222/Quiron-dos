# A partir del texto leído (datos privados\ocr), arma:
#  1) "datos privados\fragmentos\lote-NN.txt": por historia, solo las líneas útiles (diagnósticos, procedimiento, médico, fechas),
#     para revisarlas y normalizar nombres de cirugías y cirujanos.
#  2) "datos privados\examenes-detectados.json": páginas de laboratorio e imagen de cada historia (tipo, fecha, laboratorio, página).
param([int]$PorLote = 45)
$proj = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $proj 'datos privados\ocr'; $fr = Join-Path $proj 'datos privados\fragmentos'
New-Item -ItemType Directory -Force $fr | Out-Null; Get-ChildItem $fr -Filter 'lote-*.txt' | Remove-Item -Force
$RX = @{
  informe  = '(?i)INFORME\s+M[EÉ]DICO|EGRESO|EPICRISIS|RESUMEN\s+DE\s+(ALTA|HOSPITALIZ)'
  operat   = '(?i)DESCRIPCI[OÓ]N\s+(OPERATORIA|QUIR)|NOTA\s+OPERATORIA|PROTOCOLO\s+(OPERATORIO|QUIR)|INFORME\s+(OPERATORIO|QUIR[UÚ]RGICO)|T[EÉ]CNICA\s+QUIR|HALLAZGOS'
  consent  = '(?i)CONSENTIMIENTO'
  util     = '(?i)diagn|procedim|intervenc|cirug[ií]a\s+(realiz|practic)|operaci[oó]n|\bPOI?\b|\bPO\s+de|post\s*operatorio|fecha|ingres|egres|\bDra?\.|cirujano|anestesi|ayudante|paciente\s+(femenin|masculin)|\ba[ñn]os\b|tel[eé]f|direcci|t[eé]cnica|hallazgo|indicaci|tratamiento'
}
# Exámenes: palabras clave por tipo (se exige al menos 3 términos de laboratorio en la página)
$LAB = [ordered]@{
  'Hematología completa' = 'HEMATOLOG|HEMOGLOBINA|HEMATOCRITO|LEUCOCITOS|PLAQUETAS'
  'Química sanguínea' = 'QU[IÍ]MICA|GLICEMIA|GLUCOSA|UREA|CREATININA|[AÁ]CIDO [UÚ]RICO|COLESTEROL|TRIGLIC'
  'Perfil de coagulación' = 'COAGULACI|PROTROMBINA|TROMBOPLASTINA|\bPTT?\b|\bINR\b|FIBRIN[OÓ]GENO'
  'Uroanálisis' = 'ORINA|UROAN[AÁ]LISIS|SEDIMENTO|DENSIDAD'
  'Grupo sanguíneo y Rh' = 'GRUPO\s+SANGU|FACTOR\s+RH|\bRH\b'
  'Serología (HIV, VDRL, hepatitis)' = '\bHIV\b|\bVIH\b|VDRL|HEPATITIS|HBSAG|\bHCV\b'
  'Electrolitos' = 'SODIO|POTASIO|CLORO|ELECTROLITOS'
  'Prueba de embarazo (β-hCG)' = 'HCG|EMBARAZO|GONADOTROPINA'
  'Heces' = 'HECES|COPROAN[AÁ]LISIS|PARASIT'
  'Gases arteriales' = 'GASOMETR|GASES\s+ARTERIALES|\bPCO2\b|\bPO2\b'
}
$IMG = [ordered]@{
  'Ecografía' = 'ECOGRAF[IÍ]A|ECOSONOGRAM|ULTRASONIDO|ECO\s+DOPPLER'
  'Rayos X' = 'RADIOGRAF[IÍ]A|RAYOS\s*X|\bRX\b'
  'Tomografía' = 'TOMOGRAF[IÍ]A|\bTAC\b'
  'Resonancia magnética' = 'RESONANCIA\s+MAGN'
  'Electrocardiograma' = 'ELECTROCARDIOGRAMA|\bEKG\b|\bECG\b'
  'Mamografía' = 'MAMOGRAF'
  'Ecocardiograma' = 'ECOCARDIOGRAMA'
}
$labTerms = 'HEMOGLOBINA|HEMATOCRITO|LEUCOCITOS|PLAQUETAS|GLICEMIA|GLUCOSA|UREA|CREATININA|PROTROMBINA|\bPTT?\b|ORINA|VDRL|\bHIV\b|SODIO|POTASIO|NEUTR[OÓ]FILOS|LINFOCITOS|VALOR(ES)?\s+(NORMAL|DE\s+REFERENCIA)|RESULTADO'
function FechaDe($t) { $m = [regex]::Match($t, '\b(\d{1,2})[/\.-](\d{1,2})[/\.-](20\d{2}|\d{2})\b'); if (-not $m.Success) { return $null }
  $y = [int]$m.Groups[3].Value; if ($y -lt 100) { $y += 2000 }; $mo = [int]$m.Groups[2].Value; $d = [int]$m.Groups[1].Value
  if ($mo -lt 1 -or $mo -gt 12 -or $d -lt 1 -or $d -gt 31 -or $y -lt 2020 -or $y -gt 2027) { return $null }; '{0:d4}-{1:d2}-{2:d2}' -f $y, $mo, $d }
$docs = Get-ChildItem $dir -Filter *.json | ForEach-Object { Get-Content -Raw -Encoding UTF8 $_.FullName | ConvertFrom-Json | Add-Member -PassThru NoteProperty id $_.BaseName } | Sort-Object rel
$exams = New-Object System.Collections.ArrayList; $lote = New-Object System.Text.StringBuilder; $nl = 0; $nb = 0
function Flush { if ($lote.Length) { $script:nb++; [IO.File]::WriteAllText((Join-Path $fr ('lote-{0:d2}.txt' -f $script:nb)), $lote.ToString(), [Text.UTF8Encoding]::new($false)); $lote.Clear() | Out-Null; $script:nl = 0 } }
foreach ($d in $docs) {
  $pages = @($d.pages); $snip = New-Object System.Collections.ArrayList; $kinds = @()
  for ($k = 0; $k -lt $pages.Count; $k++) {
    $p = [string]$pages[$k]; $U = $p.ToUpper()
    # Exámenes
    $nLab = ([regex]::Matches($U, $labTerms)).Count
    $isImgReport = $U -match 'INFORME|CONCLUSI|IMPRESI[OÓ]N\s+DIAGN|HALLAZGOS|SE\s+OBSERVA|SE\s+EVIDENCIA'
    $panels = @(); if ($nLab -ge 3) { foreach ($t in $LAB.Keys) { if ($U -match $LAB[$t]) { $panels += $t } } }
    $imgs = @(); if ($isImgReport -and $U -notmatch 'INFORME\s+M[EÉ]DICO\s+DE\s+EGRESO') { foreach ($t in $IMG.Keys) { if ($U -match "^.{0,400}($($IMG[$t]))" -or ([regex]::Matches($U, $IMG[$t])).Count -ge 2) { $imgs += $t } } }
    if ($panels.Count -or $imgs.Count) {
      $first = ($p -split "`n" | Where-Object { $_.Trim().Length -ge 6 } | Select-Object -First 2) -join ' / '
      [void]$exams.Add([pscustomobject]@{ id = $d.id; rel = $d.rel; page = $k + 1; area = $(if ($panels.Count) { 'laboratorio' } else { 'imagen' }); tests = @($panels + $imgs); date = (FechaDe $p); lab = $first.Substring(0, [math]::Min(90, $first.Length))
        text = $(if (-not $panels.Count) { $p.Substring(0, [math]::Min(1500, $p.Length)) } else { '' }) })
    }
    # Fragmentos clínicos
    $kind = if ($p -match $RX.informe) { 'INFORME' } elseif ($p -match $RX.operat) { 'OPERATORIA' } elseif ($p -match $RX.consent) { 'CONSENT' } else { $null }
    if ($kind -and $kinds.Count -lt 4 -and $panels.Count -eq 0) {
      $kinds += $kind; $lines = $p -split "`n"; $keep = New-Object System.Collections.ArrayList
      for ($i = 0; $i -lt $lines.Count; $i++) { $ln = $lines[$i].Trim(); if ($ln.Length -lt 3) { continue }
        if ($ln -match $RX.util) { [void]$keep.Add($ln); if ($ln -match '(?i)diagn|procedim|intervenc|t[eé]cnica|indicaci') { for ($j = 1; $j -le 4 -and ($i + $j) -lt $lines.Count; $j++) { $nx = $lines[$i + $j].Trim(); if ($nx.Length -ge 3 -and -not $keep.Contains($nx)) { [void]$keep.Add($nx) } } } } }
      $txt = ($keep | Select-Object -Unique) -join ' | '; if ($txt.Length -gt 900) { $txt = $txt.Substring(0, 900) }
      [void]$snip.Add("[$kind p$($k+1)] $txt")
    }
  }
  [void]$lote.AppendLine("### $($d.id) · $($d.rel) · $($pages.Count) págs")
  if ($snip.Count) { foreach ($s in $snip) { [void]$lote.AppendLine($s) } } else { [void]$lote.AppendLine('(sin páginas de informe, nota operatoria ni consentimiento legibles)') }
  [void]$lote.AppendLine(''); $nl++; if ($nl -ge $PorLote) { Flush }
}
Flush
$exams | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 (Join-Path $proj 'datos privados\examenes-detectados.json')
"Historias: $($docs.Count) · lotes: $nb · páginas de exámenes: $($exams.Count) en $(($exams | Select-Object -ExpandProperty id -Unique).Count) historias"
$exams | Group-Object area | ForEach-Object { "  $($_.Name): $($_.Count)" }
$exams | ForEach-Object { $_.tests } | Group-Object | Sort-Object Count -Descending | ForEach-Object { "  {0}: {1}" -f $_.Name, $_.Count }