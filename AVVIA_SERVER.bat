@echo off
title AIA Gubbio — Server Designazioni

:: Chiudi eventuali istanze precedenti sulla porta 3456
echo Chiusura server precedente (se attivo)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3456" 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Vai nella cartella dello script
cd /d "%~dp0"

:: Avvia il server
echo.
echo ============================================
echo   AIA Gubbio - Avvio server in corso...
echo ============================================
echo.
node server.js

:: Se il server si chiude inaspettatamente, mostra l'errore
echo.
echo Server terminato. Premi un tasto per chiudere.
pause >nul
