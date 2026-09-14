@echo off
setlocal
cd /d "%~dp0"
title Crisis en Electroingenieria - Vertical Slice 01

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] No se encontro Node.js.
  echo Instala Node.js 20 o superior y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
  if errorlevel 1 (
    echo.
    echo [ERROR] No fue posible instalar las dependencias.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando Crisis en Electroingenieria...
call npm run dev -- --open
pause
