# Servidor local para abrir Quirón en http://localhost:8082 (sin Python ni Node).
#  · PUT /__copia?nombre=archivo.json   guarda una copia de los datos en "copias de seguridad"
#  · PUT /__archivo?nombre=x.jpg · GET /archivos/x.jpg   documentos subidos (firmados), en la carpeta "archivos"
#  · GET /__historias                   lista las historias escaneadas (nombre, cédula, año y mes, según carpeta y archivo)
#  · GET /historias/<año>/<mes>/<archivo>.pdf   abre una historia escaneada (solo lectura; los PDF no se copian ni se mueven)
param([int]$Port = 8082)
$Root = Join-Path $PSScriptRoot 'quiron'
$Backups = Join-Path $PSScriptRoot 'copias de seguridad'
New-Item -ItemType Directory -Force $Backups | Out-Null
# Documentos subidos (historias y consentimientos firmados, etc.): fuera del navegador, que tiene poco espacio
$Files = Join-Path $PSScriptRoot 'archivos'
New-Item -ItemType Directory -Force $Files | Out-Null
# Carpeta de historias en el Escritorio. Se busca por comodín porque su nombre termina en un carácter invisible (copiada desde una Mac).
function HistoriasDir {
  $o = Get-ChildItem -LiteralPath (Join-Path $env:USERPROFILE 'OneDrive\Escritorio') -Directory -Force -ErrorAction SilentlyContinue | Where-Object Name -like 'HISTORIAS MEDICAS QUIRON*' | Select-Object -First 1
  if (-not $o) { return $null }
  $i = Get-ChildItem -LiteralPath $o.FullName -Directory -Force | Where-Object Name -like 'HISTORIAS MEDICAS QUIRON*' | Select-Object -First 1
  if ($i) { $i.FullName } else { $o.FullName }
}
$Meses = [ordered]@{ ENERO=1; FEBRERO=2; MARZO=3; ABRIL=4; MAYO=5; JUNIO=6; JULIO=7; AGOSTO=8; SEPTIEMBRE=9; OCTUBRE=10; NOVIEMBRE=11; DICIEMBRE=12 }
function HistoriasIndex($base) {
  Get-ChildItem -LiteralPath $base -Recurse -File -Force -Filter *.pdf | Where-Object { $_.Name -notlike '._*' } | ForEach-Object {
    $rel = $_.FullName.Substring($base.Length + 1); $parts = $rel.Split('\'); $mon = $null
    if ($parts.Count -gt 2) { foreach ($k in $Meses.Keys) { if ($parts[1].ToUpper().Trim().StartsWith($k)) { $mon = $Meses[$k] } } }
    $stem = [IO.Path]::GetFileNameWithoutExtension($_.Name)
    [pscustomobject]@{ rel = ($rel -replace '\\', '/'); year = $parts[0]; month = $mon
      name = ($stem -replace '\d{6,9}', '' -replace '(?i)HISTORIA MEDICA', '' -replace '\s+\d\s*$', '' -replace '\s+', ' ').Trim(' ', '.')
      ci = ([regex]::Match($stem, '\d{6,9}')).Value; mb = [math]::Round($_.Length / 1MB, 2) }
  }
}
$types = @{ '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css'; '.webp'='image/webp'; '.png'='image/png'; '.svg'='image/svg+xml'; '.json'='application/json'; '.pdf'='application/pdf' }
function SendFile($c, $f) {
  $t = $types[[IO.Path]::GetExtension($f).ToLower()]; if (-not $t) { $t = 'application/octet-stream' }
  $c.Response.ContentType = $t; $c.Response.Headers.Add('Cache-Control', 'no-cache')   # que siempre cargue la versión más reciente
  $fs = [IO.File]::OpenRead($f); $c.Response.ContentLength64 = $fs.Length; $fs.CopyTo($c.Response.OutputStream); $fs.Close()
}
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Quiron en http://localhost:$Port/"
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    if ($c.Request.HttpMethod -eq 'PUT' -and $p -eq '__copia') {
      $name = [IO.Path]::GetFileName($c.Request.QueryString['nombre'])
      if (-not $name) { $name = 'copia-quiron.json' }
      $fs = [IO.File]::Create((Join-Path $Backups $name)); $c.Request.InputStream.CopyTo($fs); $fs.Close()
      $c.Response.StatusCode = 204
    } elseif ($c.Request.HttpMethod -eq 'GET' -and $p -eq '__copia') {   # leer una copia para restaurarla
      $f = Join-Path $Backups ([IO.Path]::GetFileName($c.Request.QueryString['nombre']))
      if (Test-Path -LiteralPath $f -PathType Leaf) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    } elseif ($c.Request.HttpMethod -eq 'PUT' -and $p -eq '__archivo') {   # subir un documento: nombre generado por el programa
      $name = [IO.Path]::GetFileName($c.Request.QueryString['nombre'])
      if ($name -notmatch '^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|pdf)$') { $c.Response.StatusCode = 400 } else {
        $fs = [IO.File]::Create((Join-Path $Files $name)); $c.Request.InputStream.CopyTo($fs); $fs.Close(); $c.Response.StatusCode = 204 }
    } elseif ($p.StartsWith('archivos/')) {
      $f = [IO.Path]::GetFullPath((Join-Path $Files ([IO.Path]::GetFileName($p.Substring(9)))))
      if ($f.StartsWith($Files + '\') -and (Test-Path -LiteralPath $f -PathType Leaf)) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    } elseif ($p -eq '__datos') {   # datos extraídos de las historias (solo estos archivos de "datos privados")
      $n = [IO.Path]::GetFileName($c.Request.QueryString['nombre'])
      $f = Join-Path (Join-Path $PSScriptRoot 'datos privados') $n
      if ($n -in 'pacientes-datos.json', 'historias-datos.json', 'examenes-datos.json' -and (Test-Path -LiteralPath $f)) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    } elseif ($p -eq '__tasa') {   # tasa oficial del dólar publicada por el BCV (bcv.org.ve no tiene API: se lee su página)
      try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $h = (Invoke-WebRequest -Uri 'https://www.bcv.org.ve/' -UseBasicParsing -TimeoutSec 25).Content
        $usd = [regex]::Match($h, 'id="dolar".{0,800}?<strong[^>]*>\s*([\d\.,]+)\s*</strong>', 'Singleline').Groups[1].Value
        $fv = [regex]::Match($h, 'Fecha Valor:\s*<span[^>]*content="(\d{4}-\d{2}-\d{2})', 'Singleline').Groups[1].Value
        if (-not $usd -or -not $fv) { throw 'No se encontró la tasa en la página del BCV' }
        $json = @{ rate = [double]($usd -replace '\.', '' -replace ',', '.'); fechaValor = $fv; fuente = 'BCV'; leida = (Get-Date).ToString('s') } | ConvertTo-Json -Compress
        $b = [Text.Encoding]::UTF8.GetBytes($json); $c.Response.ContentType = 'application/json; charset=utf-8'; $c.Response.OutputStream.Write($b, 0, $b.Length)
      } catch { $c.Response.StatusCode = 502; $b = [Text.Encoding]::UTF8.GetBytes((@{ error = $_.Exception.Message } | ConvertTo-Json -Compress)); $c.Response.OutputStream.Write($b, 0, $b.Length) }
    } elseif ($p -eq '__historias') {
      $base = HistoriasDir
      if (-not $base) { $c.Response.StatusCode = 404 } else {
        $json = @(HistoriasIndex $base) | ConvertTo-Json -Depth 3 -Compress; if (-not $json) { $json = '[]' }
        $b = [Text.Encoding]::UTF8.GetBytes($json); $c.Response.ContentType = 'application/json; charset=utf-8'; $c.Response.OutputStream.Write($b, 0, $b.Length)
      }
    } elseif ($p.StartsWith('historias/')) {
      $base = HistoriasDir; $f = if ($base) { [IO.Path]::GetFullPath((Join-Path $base ($p.Substring(10) -replace '/', '\'))) }
      if ($f -and $f.StartsWith($base + '\') -and $f.ToLower().EndsWith('.pdf') -and (Test-Path -LiteralPath $f -PathType Leaf)) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    } else {
      if ($p -eq '') { $p = 'index.html' }
      $f = [IO.Path]::GetFullPath((Join-Path $Root $p))
      if ($f.StartsWith($Root) -and (Test-Path -LiteralPath $f -PathType Leaf)) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    }
  } catch { try { $c.Response.StatusCode = 500 } catch {} }
  try { $c.Response.Close() } catch {}
}
