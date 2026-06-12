@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>nul
)

powershell -NoProfile -Command "if (Test-NetConnection -ComputerName 'localhost' -Port 5432 -InformationLevel Quiet) { exit 0 } else { exit 1 }" >nul 2>nul
if errorlevel 1 (
  if not "%POSTGRES_SERVICE_NAME%"=="" (
    sc query "%POSTGRES_SERVICE_NAME%" >nul 2>nul
    if not errorlevel 1 (
      net start "%POSTGRES_SERVICE_NAME%" >nul 2>nul
    )
  ) else (
    for %%s in (postgresql-x64-17 postgresql-x64-16 postgresql-x64-15 postgresql-x64-14 postgresql-x64-13 postgresql-x64-12 postgresql-x64-11 postgresql) do (
      sc query "%%s" >nul 2>nul
      if not errorlevel 1 (
        net start "%%s" >nul 2>nul
        goto :dbwait
      )
    )
  )
)

:dbwait
powershell -NoProfile -Command "for ($i=0;$i -lt 30;$i++){ if (Test-NetConnection -ComputerName 'localhost' -Port 5432 -InformationLevel Quiet){ exit 0}; Start-Sleep -Seconds 1 }; exit 1" >nul 2>nul

start "EasyMarket API" cmd /k "cd /d ""%~dp0"" && set API_PORT=8081 && npm run -w @easymarket/api start:dev"
start "EasyMarket Web" cmd /k "cd /d ""%~dp0"" && npm run -w @easymarket/web dev -- --host"

exit /b 0
