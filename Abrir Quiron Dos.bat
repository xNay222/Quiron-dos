@echo off
rem Abre Quiron Dos (nuevo diseno) en http://localhost:8082. No usa los datos de la version 1 (puerto 8080).
cd /d "%~dp0"
start "" http://localhost:8082/
powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1 -Port 8082
