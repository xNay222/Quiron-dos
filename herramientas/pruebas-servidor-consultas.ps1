# Pruebas del bloque real /__ia, sin servidor, claves reales ni llamadas externas.
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$tokens = $null; $parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile((Join-Path $project 'serve.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors) { throw ($parseErrors.Message -join '; ') }
$branch = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.IfStatementAst] -and $node.Clauses[0].Item1.Extent.Text -eq '$p -eq ''__ia'''  }, $true)
# Se identifica y ejecuta únicamente el bloque real del endpoint.
if (-not $branch) {
  $branch = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.IfStatementAst] -and $node.Clauses[0].Item1.Extent.Text.Contains("'__ia'") }, $true)
}
if (-not $branch) { throw 'No se encontró el endpoint /__ia' }
$endpointCode = $branch.Clauses[0].Item2.Extent.Text.Trim().TrimStart('{').TrimEnd('}')
$block = [scriptblock]::Create('$PSScriptRoot = $project; ' + $endpointCode)
$Port = 8093
# Sombra local para impedir leer gemini.key; afecta solo a este proceso de pruebas.
function Test-Path { param($LiteralPath, $PathType) return $false }
function Invoke-RestMethod {
  param($Method,$Uri,$Headers,$ContentType,$Body,$TimeoutSec,$ErrorAction)
  if ($script:providerFail) { throw 'Fallo de proveedor simulado' }
  $script:providerRequest = [Text.Encoding]::UTF8.GetString($Body) | ConvertFrom-Json
  if ($Uri -notmatch '^https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent$') { throw 'Endpoint de proveedor incorrecto' }
  if ($TimeoutSec -ne 20 -or $Headers['x-goog-api-key'] -ne 'clave-simulada') { throw 'Configuración del proveedor incorrecta' }
  return @{ candidates = @(@{ finishReason = if ($script:truncated) { 'MAX_TOKENS' } else { 'STOP' }; content = @{ parts = @(@{ text = 'Borrador simulado, sin firma.' }) } }) }
}
function Check($condition, $label) { if (-not $condition) { throw $label }; Write-Output ('OK ' + $label) }
function Request($method, $body, $origin = '') {
  $bytes = [Text.Encoding]::UTF8.GetBytes($body)
  $c = [pscustomobject]@{ Request = [pscustomobject]@{ HttpMethod = $method; Headers = @{ Origin = $origin }; ContentLength64 = $bytes.Length; InputStream = [IO.MemoryStream]::new($bytes) }; Response = [pscustomobject]@{ StatusCode = 200; ContentType = ''; Headers = @{}; OutputStream = [IO.MemoryStream]::new() } }
  & $block
  $out = [Text.Encoding]::UTF8.GetString($c.Response.OutputStream.ToArray()) | ConvertFrom-Json
  return [pscustomobject]@{ status = $c.Response.StatusCode; body = $out; cache = $c.Response.Headers['Cache-Control'] }
}
$env:QUIRON_GEMINI_KEY = ''
$r = Request POST '{}'; Check ($r.status -eq 503) 'Sin clave: 503 y sin llamada externa'
Check ($r.cache -eq 'no-store') 'Respuestas clínicas no se almacenan en caché'
$r = Request GET '{}'; Check ($r.status -eq 405) 'Método no permitido: 405'
$r = Request POST '{}' 'https://example.invalid'; Check ($r.status -eq 403) 'Origen ajeno rechazado: 403'
$env:QUIRON_GEMINI_KEY = 'clave-simulada'; $env:QUIRON_GEMINI_MODEL = ''
$r = Request POST '{'; Check ($r.status -eq 400) 'JSON inválido: 400'
$r = Request POST '{"patient":{"name":"Nombre no permitido"},"mode":"quick"}'; Check ($r.status -eq 400) 'Paciente identificativo rechazado'
$r = Request POST '{"patient":{"initials":"P.P."},"mode":"quick","pid":"identificador"}'; Check ($r.status -eq 400) 'Campos extra identificativos rechazados'
$r = Request POST '{"patient":{"initials":"P.P.","age":40,"sex":"F"},"mode":"quick","reasons":[]}'; Check ($r.status -eq 200 -and $r.body.text -eq 'Borrador simulado, sin firma.') 'Gemini simulado: devuelve borrador, no firma'
Check ($script:providerRequest.systemInstruction.parts[0].text -match '16\.') 'Prompt con 16 reglas documentales'
$script:providerFail = $true
$r = Request POST '{"patient":{"initials":"P.P."},"mode":"quick"}'; Check ($r.status -eq 502 -and $r.body.error -notmatch 'simulado|clave') 'Fallo externo: 502 sin detalles ni credenciales'
$script:providerFail = $false; $script:truncated = $true
$r = Request POST '{"patient":{"initials":"P.P."},"mode":"quick"}'; Check ($r.status -eq 502) 'Respuesta truncada rechazada'
$env:QUIRON_GEMINI_MODEL = 'modelo/incorrecto'
$r = Request POST '{"patient":{"initials":"P.P."},"mode":"quick"}'; Check ($r.status -eq 503) 'Modelo inválido: 503'
Write-Output '12 comprobaciones correctas. No sustituyen la prueba HTTP del servidor reiniciado.'
