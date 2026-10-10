# Extrae automáticamente, del texto leído (datos privados\ocr), los datos escritos a máquina de cada historia:
# cirujano, procedimiento, diagnósticos, fechas, sexo, edad, teléfono, nombre completo y medicación al alta.
# Salida: datos privados\extraccion-auto.json  +  listas de valores distintos para normalizar (valores-*.txt)
$proj = Split-Path $PSScriptRoot -Parent
$dir = Join-Path $proj 'datos privados\ocr'
$RXINF = '(?i)INFORME\s+M[EÉ]DICO|INFORME\s+DE\s+EGRESO|EPICRISIS|RESUMEN\s+DE\s+(ALTA|HOSPITALIZ)|DIAGN[OÓ]STICOS?\s+DE\s+EGRESO'
$RXOPE = '(?i)DESCRIPCI[OÓ]N\s+(OPERATORIA|QUIR)|NOTA\s+OPERATORIA|PROTOCOLO\s+(OPERATORIO|QUIR)|INFORME\s+(OPERATORIO|QUIR[UÚ]RGICO)'
$NAME = "[A-ZÁÉÍÓÚÑa-záéíóúñü][A-ZÁÉÍÓÚÑa-záéíóúñü\.']+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñü][A-ZÁÉÍÓÚÑa-záéíóúñü\.']*){1,4}"
$NOMED = '(?i)reposo|control|dieta|cura|retiro|evitar|acudir|ducha|deambul|faja|hielo|compres|sugerenc|cita|consulta|signos|alarma|herida|actividad|esfuerzo|ba[ñn]o|sol\b|aseo|vendaje|curas|seguimiento|llevar|traer|presentar'
function Clean($s) { if (-not $s) { return $null }; $s = ($s -replace '\s+', ' ' -replace '^[\s\.\-:;,\d\)\(]+', '' -replace '[\s\.\-:;,]+$', '').Trim(); if ($s.Length -lt 3) { $null } else { $s } }
function After($text, $rx, [int]$lines = 3) {
  $L = $text -split "`n"; for ($i = 0; $i -lt $L.Count; $i++) { $m = [regex]::Match($L[$i], $rx); if ($m.Success) {
      $out = @(); $rest = Clean ($L[$i].Substring($m.Index + $m.Length)); if ($rest) { $out += $rest }
      for ($j = 1; $j -le $lines -and ($i + $j) -lt $L.Count -and $out.Count -lt $lines; $j++) { $nx = $L[$i + $j]; if ($nx -match '(?i)^\s*(fecha|diagn|indicac|tratamiento|plan|sugerenc|dr\.?|dra\.?|firma|hallazgo|evoluci|examen|paraclin|antecedent)') { break }; $c = Clean $nx; if ($c) { $out += $c } }
      if ($out.Count) { return , $out } } }
  return , @() }
function FechaN($s) { $m = [regex]::Match([string]$s, '(\d{1,2})\s*[/\.\-]\s*(\d{1,2})\s*[/\.\-]\s*(20\d{2}|\d{2})'); if (-not $m.Success) { return $null }
  $y = [int]$m.Groups[3].Value; if ($y -lt 100) { $y += 2000 }; $mo = [int]$m.Groups[2].Value; $d = [int]$m.Groups[1].Value
  if ($mo -lt 1 -or $mo -gt 12 -or $d -lt 1 -or $d -gt 31 -or $y -lt 2021 -or $y -gt 2026) { return $null }; '{0:d4}-{1:d2}-{2:d2}' -f $y, $mo, $d }
$res = foreach ($f in (Get-ChildItem $dir -Filter *.json)) {
  $d = Get-Content -Raw -Encoding UTF8 $f.FullName | ConvertFrom-Json; $pages = @($d.pages | ForEach-Object { [string]$_ })
  $inf = ($pages | Where-Object { $_ -match $RXINF }) -join "`n"; $ope = ($pages | Where-Object { $_ -match $RXOPE }) -join "`n"
  $con = ($pages | Where-Object { $_ -match '(?i)CONSENTIMIENTO' }) -join "`n"; $all = $pages -join "`n"
  $key = "$inf`n$ope"
  # Cirujano
  $sur = $null
  $m = [regex]::Match($con, "(?i)realizar\s+por\s+(?:el|la)\s+(Dra?\.?\s*$NAME)"); if ($m.Success) { $sur = $m.Groups[1].Value }
  if (-not $sur) { $m = [regex]::Match($key, "(?im)^\s*(?:Cirujano\s*:?\s*)?(Dra?\.\s*$NAME)\s*$"); if ($m.Success) { $sur = $m.Groups[1].Value } }
  if (-not $sur) { $m = [regex]::Match($all, "(?i)(?:a\s+cargo\s+de(?:l|\s+la)?|m[eé]dico\s+tratante\s*:?)\s*(Dra?\.?\s*$NAME)"); if ($m.Success) { $sur = $m.Groups[1].Value } }
  $anes = $null; $m = [regex]::Match($all, "(?i)anestesi[oó]log[oa]\s*:?\s*(Dra?\.?\s*$NAME)"); if ($m.Success) { $anes = Clean $m.Groups[1].Value }
  # Procedimiento y diagnósticos
  $proc = @(); foreach ($m in [regex]::Matches($key, '(?i)\b(?:POI|POM|POT|PO|P\.O\.I?\.?|post\s*operatorio(?:\s+(?:inmediato|mediato|tard[ií]o))?)\s+de\s+([^\n|]{5,140})')) { $c = Clean $m.Groups[1].Value; if ($c -and $proc -notcontains $c) { $proc += $c } }
  foreach ($rx in '(?i)procedimiento\s*(?:realizado|quir[uú]rgico|efectuado)?\s*:', '(?i)intervenci[oó]n\s*(?:quir[uú]rgica|realizada)?\s*:', '(?i)cirug[ií]a\s+(?:realizada|practicada)\s*:', '(?i)operaci[oó]n\s+realizada\s*:') { foreach ($x in (After $key $rx 1)) { if ($proc -notcontains $x) { $proc += $x } } }
  $dxE = After $key '(?i)diagn[oó]sticos?\s+(?:de\s+egreso|final(?:es)?|definitivos?|post\s*operatorios?)\s*:?' 3
  $dxI = After $key '(?i)diagn[oó]sticos?\s+(?:de\s+ingreso|pre\s*operatorios?)\s*:?' 3
  if (-not $dxE.Count -and -not $dxI.Count) { $dxI = After $key '(?i)diagn[oó]sticos?\s*:?' 3 }
  # Fechas, paciente
  $fi = FechaN ((After $all '(?i)fecha\s+de\s+ingreso\s*:?' 1) -join ' '); $fe = FechaN ((After $all '(?i)fecha\s+de\s+egreso\s*:?' 1) -join ' ')
  $sex = if ($all -match '(?i)paciente\s+femenin|\bfemenina\s+de\s+\d') { 'F' } elseif ($all -match '(?i)paciente\s+masculin|\bmasculino\s+de\s+\d') { 'M' } else { $null }
  $age = $null; $m = [regex]::Match($inf + "`n" + $all, '(?i)(?:edad\s*:?\s*|de\s+)(\d{1,3})\s*a[ñn]os'); if ($m.Success -and [int]$m.Groups[1].Value -le 105) { $age = [int]$m.Groups[1].Value }
  $phone = $null; $m = [regex]::Match($all, '\b0\s?(41[246]|42[46]|212)\s*[-\.]?\s*(\d{3})\s*[-\.]?\s*(\d{4})\b'); if ($m.Success) { $phone = "0$($m.Groups[1].Value)-$($m.Groups[2].Value)-$($m.Groups[3].Value)" }
  $full = $null; $m = [regex]::Match($inf, "(?i)(?:nombre\s+y\s+apellidos?|paciente|nombre)\s*:?\s*($NAME)"); if ($m.Success) { $full = Clean ($m.Groups[1].Value -replace '(?i)\s+(C\.?\s*I|EDAD|FECHA|TEL).*$', '') }
  $addr = $null; $m = [regex]::Match($inf, '(?i)direcci[oó]n\s*:?\s*([^\n|]{3,60})'); if ($m.Success -and $m.Groups[1].Value -notmatch '(?i)choron|chuao|quir[oó]n') { $addr = Clean $m.Groups[1].Value }
  # Medicación al alta (sección Indicaciones del informe)
  $meds = @(); $ix = [regex]::Match($inf, '(?i)indicaciones|tratamiento\s+(?:ambulatorio|al\s+egreso|m[eé]dico)'); if ($ix.Success) {
    foreach ($ln in (($inf.Substring($ix.Index) -split "`n") | Select-Object -Skip 1 -First 14)) { if ($ln -match '(?i)^\s*(dr\.?|dra\.?|firma|fecha)') { break }
      $c = Clean $ln; if ($c -and $c -notmatch $NOMED -and $c -match '^[A-Za-zÁÉÍÓÚÑáéíóúñ]{4,}') { $meds += ($c -replace '\s+\d.*$', '') } } }
  [pscustomobject]@{ id = $f.BaseName; rel = $d.rel; pages = $pages.Count; hasInf = [bool]$inf; hasOpe = [bool]$ope; surgeon = (Clean $sur); anesth = $anes; proc = $proc; dxE = $dxE; dxI = $dxI
    fIng = $fi; fEgr = $fe; sex = $sex; age = $age; phone = $phone; fullName = $full; addr = $addr; meds = @($meds | Select-Object -Unique -First 10) }
}
$res | ConvertTo-Json -Depth 4 | Out-File -Encoding utf8 (Join-Path $proj 'datos privados\extraccion-auto.json')
$n = @($res).Count
"Historias: $n"; "  con informe a máquina: " + @($res | Where-Object hasInf).Count; "  con cirujano: " + @($res | Where-Object surgeon).Count
"  con procedimiento: " + @($res | Where-Object { $_.proc.Count }).Count; "  con diagnóstico: " + @($res | Where-Object { $_.dxE.Count -or $_.dxI.Count }).Count
"  con medicación al alta: " + @($res | Where-Object { $_.meds.Count }).Count; "  con sexo: " + @($res | Where-Object sex).Count; "  con edad: " + @($res | Where-Object age).Count; "  con teléfono: " + @($res | Where-Object phone).Count
$out = Join-Path $proj 'datos privados'
$res | Where-Object surgeon | Group-Object surgeon | Sort-Object Count -Descending | ForEach-Object { "{0}`t{1}" -f $_.Count, $_.Name } | Out-File -Encoding utf8 (Join-Path $out 'valores-cirujanos.txt')
$res | ForEach-Object { @($_.proc) + @($_.dxE) } | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | ForEach-Object { "{0}`t{1}" -f $_.Count, $_.Name } | Out-File -Encoding utf8 (Join-Path $out 'valores-procedimientos.txt')
$res | ForEach-Object { $_.meds } | Where-Object { $_ } | Group-Object | Sort-Object Count -Descending | ForEach-Object { "{0}`t{1}" -f $_.Count, $_.Name } | Out-File -Encoding utf8 (Join-Path $out 'valores-medicamentos.txt')
