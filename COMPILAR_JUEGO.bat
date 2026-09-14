@echo off
setlocal
cd /d "%~dp0"
title Compilar Crisis en Electroingenieria

if not exist node_modules call npm install
if errorlevel 1 exit /b 1
call npm run build
if errorlevel 1 (
  echo.
  echo La compilacion termino con errores.
  pause
  exit /b 1
)
echo.
echo Build generado en la carpeta dist.
pause
