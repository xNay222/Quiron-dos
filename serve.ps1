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
$types = @{ '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.html'='text/html; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css'; '.webp'='image/webp'; '.png'='image/png'; '.svg'='image/svg+xml'; '.json'='application/json'; '.pdf'='application/pdf'; '.webmanifest'='application/manifest+json' }
function SendFile($c, $f) {
  $t = $types[[IO.Path]::GetExtension($f).ToLower()]; if (-not $t) { $t = 'application/octet-stream' }
  $c.Response.ContentType = $t; $c.Response.Headers.Add('Cache-Control', 'no-cache')   # que siempre cargue la versión más reciente
  # El archivo se cierra siempre, aunque falle el envío (si quedaba abierto, bloqueaba guardar cambios en él)
  $fs = [IO.File]::Open($f, 'Open', 'Read', 'ReadWrite, Delete')
  try {
    $c.Response.ContentLength64 = $fs.Length
    if ($c.Request.HttpMethod -ne 'HEAD') { $fs.CopyTo($c.Response.OutputStream) }
  } finally { $fs.Dispose() }
}
# Seguridad
#  · Solo escucha en localhost (otros equipos de la red no pueden conectarse).
#  · Ninguna otra página web abierta en el navegador puede leer ni escribir datos: se rechazan las peticiones de otro origen.
#  · Política de contenido (CSP): el navegador solo ejecuta los scripts del programa y de los CDN conocidos.
#  · Los archivos subidos se comprueban (tipo real y tamaño) y los errores no muestran detalles internos.
$Origin = "http://localhost:$Port"
$Csp = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' https://cdnjs.cloudflare.com https://ve.dolarapi.com https://api.pwnedpasswords.com; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'"
$IaLog = New-Object System.Collections.Generic.List[datetime]   # límite de lecturas con IA por minuto
function SendText($c, [int]$code, [string]$text) { $c.Response.StatusCode = $code; $b = [Text.Encoding]::UTF8.GetBytes($text); $c.Response.ContentType = 'text/plain; charset=utf-8'; $c.Response.OutputStream.Write($b, 0, $b.Length) }
# Guarda lo recibido en un archivo temporal, comprueba tamaño y contenido, y solo entonces reemplaza el definitivo
function ReceiveFile($c, $dest, [long]$max, [scriptblock]$valid) {
  if ($c.Request.ContentLength64 -gt $max) { return 'El archivo es demasiado grande.' }
  $tmp = $dest + '.subiendo'
  $fs = [IO.File]::Create($tmp)
  try { $buf = New-Object byte[] 65536; $tot = 0; while (($n = $c.Request.InputStream.Read($buf, 0, $buf.Length)) -gt 0) { $tot += $n; if ($tot -gt $max) { break }; $fs.Write($buf, 0, $n) } } finally { $fs.Dispose() }
  if ($tot -gt $max -or $tot -eq 0) { Remove-Item -LiteralPath $tmp -Force; return 'El archivo está vacío o es demasiado grande.' }
  $head = New-Object byte[] 16; $r = [IO.File]::OpenRead($tmp); try { [void]$r.Read($head, 0, 16) } finally { $r.Dispose() }
  if (-not (& $valid $head)) { Remove-Item -LiteralPath $tmp -Force; return 'El contenido no corresponde al tipo de archivo.' }
  Move-Item -LiteralPath $tmp -Destination $dest -Force; return $null
}
$isJson = { param($h) $i = 0; while ($i -lt $h.Length -and $h[$i] -in 32, 9, 10, 13, 0xEF, 0xBB, 0xBF) { $i++ }; $i -lt $h.Length -and $h[$i] -in 0x7B, 0x5B }   # empieza por { o [
$isDoc = { param($h) ($h[0] -eq 0xFF -and $h[1] -eq 0xD8) -or ($h[0] -eq 0x89 -and $h[1] -eq 0x50 -and $h[2] -eq 0x4E -and $h[3] -eq 0x47) -or ([Text.Encoding]::ASCII.GetString($h, 0, 4) -eq 'RIFF' -and [Text.Encoding]::ASCII.GetString($h, 8, 4) -eq 'WEBP') -or [Text.Encoding]::ASCII.GetString($h, 0, 4) -eq '%PDF' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Quiron en http://localhost:$Port/"
while ($l.IsListening) {
  $c = $l.GetContext()
  try {
    $p = [Uri]::UnescapeDataString($c.Request.Url.AbsolutePath.TrimStart('/'))
    $h = $c.Response.Headers
    $h.Add('X-Content-Type-Options', 'nosniff'); $h.Add('X-Frame-Options', 'SAMEORIGIN'); $h.Add('Referrer-Policy', 'no-referrer'); $h.Add('Cross-Origin-Resource-Policy', 'same-origin'); $h.Add('Content-Security-Policy', $Csp)
    # Peticiones hechas por otra página web (no por el programa): se rechazan las de datos, archivos e historias
    $from = $c.Request.Headers['Origin']; $site = $c.Request.Headers['Sec-Fetch-Site']
    $private = $p.StartsWith('__') -or $p.StartsWith('archivos/') -or $p.StartsWith('historias/')
    if (($from -and $from -ne $Origin) -or ($private -and $site -and $site -notin 'same-origin', 'none')) { SendText $c 403 'Acceso no permitido.' }
    elseif ($c.Request.HttpMethod -eq 'PUT' -and $p -eq '__copia') {
      $name = [IO.Path]::GetFileName($c.Request.QueryString['nombre'])
      if (-not $name) { $name = 'copia-quiron.json' }
      $okName = $name.ToLower().EndsWith('.json')   # solo copias .json
      $dest = Join-Path $Backups $name
      # Historial automático del estado compartido: antes de reemplazarlo se guarda comprimido uno por hora (48 h) y uno por día (60 días)
      if ($name -eq '_estado-servidor.json' -and (Test-Path -LiteralPath $dest)) {
        try {
          $hist = Join-Path $Backups 'historial'; New-Item -ItemType Directory -Force $hist | Out-Null; $now = Get-Date
          foreach ($snap in @((Join-Path $hist ('hora-' + $now.ToString('yyyyMMdd-HH') + '.json.gz')), (Join-Path $hist ('dia-' + $now.ToString('yyyyMMdd') + '.json.gz')))) {
            if (-not (Test-Path -LiteralPath $snap)) {
              $in = [IO.File]::OpenRead($dest); $out = [IO.File]::Create($snap); $gz = New-Object IO.Compression.GZipStream($out, [IO.Compression.CompressionMode]::Compress)
              try { $in.CopyTo($gz) } finally { $gz.Dispose(); $out.Dispose(); $in.Dispose() }
            }
          }
          Get-ChildItem -LiteralPath $hist -Filter 'hora-*.json.gz' | Where-Object { $_.LastWriteTime -lt $now.AddHours(-48) } | Remove-Item -Force
          Get-ChildItem -LiteralPath $hist -Filter 'dia-*.json.gz' | Where-Object { $_.LastWriteTime -lt $now.AddDays(-60) } | Remove-Item -Force
        } catch {}
      }
      $err = if ($okName) { ReceiveFile $c $dest 500MB $isJson } else { 'Solo se guardan copias .json.' }
      if ($err) { SendText $c 400 $err } else { $c.Response.StatusCode = 204 }
    } elseif ($c.Request.HttpMethod -eq 'GET' -and $p -eq '__copia') {   # leer una copia para restaurarla
      $f = Join-Path $Backups ([IO.Path]::GetFileName($c.Request.QueryString['nombre']))
      if (Test-Path -LiteralPath $f -PathType Leaf) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    } elseif ($c.Request.HttpMethod -eq 'PUT' -and $p -eq '__archivo') {   # subir un documento: nombre generado por el programa
      $name = [IO.Path]::GetFileName($c.Request.QueryString['nombre'])
      if ($name -notmatch '^[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp|pdf)$') { SendText $c 400 'Tipo de archivo no permitido.' } else {
        $err = ReceiveFile $c (Join-Path $Files $name) 40MB $isDoc   # se comprueba el contenido real, no solo la extensión
        if ($err) { SendText $c 400 $err } else { $c.Response.StatusCode = 204 } }
    } elseif ($p.StartsWith('archivos/')) {
      $f = [IO.Path]::GetFullPath((Join-Path $Files ([IO.Path]::GetFileName($p.Substring(9)))))
      if ($f.StartsWith($Files + '\') -and (Test-Path -LiteralPath $f -PathType Leaf)) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    } elseif ($p -eq '__ping') {   # el programa comprueba que corre con este servidor (sincronización entre equipos)
      $c.Response.StatusCode = 204
    } elseif ($p -eq '__ia') {   # lectura de fotos con IA (Google Gemini). La clave vive en Windows (GEMINI_API_KEY), nunca en la página
      $key = [Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User'); if (-not $key) { $key = $env:GEMINI_API_KEY }
      if (-not $key) { $c.Response.StatusCode = 404 }
      elseif ($c.Request.HttpMethod -ne 'POST') { $c.Response.StatusCode = 204 }   # el programa pregunta si hay IA disponible
      elseif ($c.Request.ContentLength64 -gt 30MB) { SendText $c 413 'Las fotos son demasiado grandes.' }
      elseif (($IaLog.RemoveAll({ param($t) $t -lt (Get-Date).AddMinutes(-1) }) -ge 0) -and $IaLog.Count -ge 15) { SendText $c 429 'Demasiadas lecturas seguidas. Espere un minuto.' }   # protege la cuota gratuita
      else {
        $IaLog.Add((Get-Date))
        $sr = New-Object IO.StreamReader($c.Request.InputStream, [Text.Encoding]::UTF8); $req = $sr.ReadToEnd() | ConvertFrom-Json
        $model = [Environment]::GetEnvironmentVariable('GEMINI_MODEL', 'User'); if (-not $model) { $model = 'gemini-flash-latest' }
        $parts = @(@{ text = [string]$req.prompt }); foreach ($im in @($req.images)) { if ($im) { $parts += @{ inline_data = @{ mime_type = [string]$im.mime; data = [string]$im.data } } } }
        $payload = @{ contents = @(@{ parts = $parts }); generationConfig = @{ responseMimeType = 'application/json'; temperature = 0 } } | ConvertTo-Json -Depth 8 -Compress
        try {
          [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
          $r = Invoke-WebRequest -Method Post -UseBasicParsing -Uri "https://generativelanguage.googleapis.com/v1beta/models/$($model):generateContent" -Headers @{ 'x-goog-api-key' = $key } -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 120
          $j = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray()) | ConvertFrom-Json
          $txt = [string]$j.candidates[0].content.parts[0].text
          $b = [Text.Encoding]::UTF8.GetBytes($txt); $c.Response.ContentType = 'application/json; charset=utf-8'; $c.Response.OutputStream.Write($b, 0, $b.Length)
        } catch { Write-Host "IA: $($_.Exception.Message)"; $code = 0; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
          SendText $c 502 $(if ($code -eq 429) { 'Error de la IA: se agotó la cuota gratuita por ahora. Intente más tarde.' } elseif ($code -in 401, 403) { 'Error de la IA: la clave no es válida.' } else { 'Error de la IA: no respondió. Revise la conexión a internet.' }) }
      }
    } elseif ($p -eq '__datos') {   # datos extraídos de las historias (solo estos archivos de "datos privados")
      $n = [IO.Path]::GetFileName($c.Request.QueryString['nombre'])
      $f = Join-Path (Join-Path $PSScriptRoot 'datos privados') $n
      if ($n -in 'pacientes-datos.json', 'historias-datos.json', 'examenes-datos.json' -and (Test-Path -LiteralPath $f)) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    } elseif ($p -eq '__tasa') {   # tasa oficial del dólar publicada por el BCV (bcv.org.ve no tiene API: se lee su página)
      try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $h = (Invoke-WebRequest -Uri 'https://www.bcv.org.ve/' -UseBasicParsing -TimeoutSec 25).Content
        $usd = [regex]::Match($h, 'id="dolar".{0,800}?<strong[^>]*>\s*([\d\.,]+)\s*</strong>', 'Singleline').Groups[1].Value
        $eur = [regex]::Match($h, 'id="euro".{0,800}?<strong[^>]*>\s*([\d\.,]+)\s*</strong>', 'Singleline').Groups[1].Value
        $fv = [regex]::Match($h, 'Fecha Valor:\s*<span[^>]*content="(\d{4}-\d{2}-\d{2})', 'Singleline').Groups[1].Value
        if (-not $usd -or -not $fv) { throw 'No se encontró la tasa en la página del BCV' }
        $json = @{ rate = [double]($usd -replace '\.', '' -replace ',', '.'); eur = $(if ($eur) { [double]($eur -replace '\.', '' -replace ',', '.') } else { 0 }); fechaValor = $fv; fuente = 'BCV'; leida = (Get-Date).ToString('s') } | ConvertTo-Json -Compress
        $b = [Text.Encoding]::UTF8.GetBytes($json); $c.Response.ContentType = 'application/json; charset=utf-8'; $c.Response.OutputStream.Write($b, 0, $b.Length)
      } catch { Write-Host "Tasa: $($_.Exception.Message)"; $c.Response.StatusCode = 502; $b = [Text.Encoding]::UTF8.GetBytes((@{ error = 'No se pudo leer la tasa del BCV' } | ConvertTo-Json -Compress)); $c.Response.OutputStream.Write($b, 0, $b.Length) }
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
      if ($f.StartsWith($Root + '\') -and (Test-Path -LiteralPath $f -PathType Leaf)) { SendFile $c $f } else { $c.Response.StatusCode = 404 }
    }
  } catch { Write-Host "Error en /$($p): $($_.Exception.Message)"; try { $c.Response.StatusCode = 500 } catch {} }   # el detalle queda en la consola, no se envía
  try { $c.Response.Close() } catch {}
}
