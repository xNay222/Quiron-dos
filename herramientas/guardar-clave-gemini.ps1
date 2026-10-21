# Guarda la clave de Google Gemini en este computador (variable de usuario GEMINI_API_KEY) para que el servidor local
# pueda leer fotos con IA. La clave se escribe oculta y no se muestra en pantalla ni se guarda en ningún archivo.
Write-Host ''
Write-Host 'Clave de Google Gemini para Quiron' -ForegroundColor Green
Write-Host 'Copie la clave en Google AI Studio (empieza por AIza) y pegue aqui con clic derecho o Ctrl+V. No se vera mientras la pega.'
Write-Host ''
$s = Read-Host 'Clave' -AsSecureString
$k = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)).Trim()
if ($k -notmatch '^AIza[0-9A-Za-z_\-]{30,}$') {
  Write-Host ''
  Write-Host 'Eso no parece una clave de Gemini (debe empezar por AIza y no tener espacios). No se guardo nada.' -ForegroundColor Red
} else {
  [Environment]::SetEnvironmentVariable('GEMINI_API_KEY', $k, 'User')
  Write-Host ''
  Write-Host ('Clave guardada (' + $k.Length + ' caracteres). Cierre y vuelva a abrir "Abrir Quiron Dos".') -ForegroundColor Green
}
Write-Host ''
Read-Host 'Pulse Enter para cerrar'
