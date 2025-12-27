@echo off
title Censo de Equipos - CAAST Sistemas
color 0A
echo ============================================================
echo   Censo de Equipos - CAAST Sistemas
echo ============================================================
echo.
echo Este programa detectara automaticamente el hardware de tu
echo equipo y lo enviara al portal web.
echo.
echo Asegurate de tener tu TOKEN listo. Lo puedes obtener desde:
echo http://localhost:5173 (Dashboard de Cliente - Censar Equipo)
echo.
echo ============================================================
echo.

REM Verificar si Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado.
    echo Por favor instala Python 3 desde https://www.python.org/
    echo.
    pause
    exit /b 1
)

REM Verificar si requests está instalado
python -c "import requests" >nul 2>&1
if errorlevel 1 (
    echo Instalando modulo 'requests'...
    pip install requests
    echo.
)

REM Ejecutar el script de censo
python "%~dp0censo_equipos.py"

echo.
pause
