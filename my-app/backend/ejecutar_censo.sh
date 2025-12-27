#!/bin/bash

echo "============================================================"
echo "  Censo de Equipos - CAAST Sistemas"
echo "============================================================"
echo ""
echo "Este programa detectará automáticamente el hardware de tu"
echo "equipo y lo enviará al portal web."
echo ""
echo "Asegúrate de tener tu TOKEN listo. Lo puedes obtener desde:"
echo "http://localhost:5173 (Dashboard de Cliente - Censar Equipo)"
echo ""
echo "============================================================"
echo ""

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 no está instalado."
    echo "Por favor instala Python 3 desde tu gestor de paquetes."
    echo ""
    read -p "Presiona Enter para salir..."
    exit 1
fi

# Verificar si requests está instalado
if ! python3 -c "import requests" &> /dev/null; then
    echo "Instalando módulo 'requests'..."
    pip3 install requests
    echo ""
fi

# Obtener el directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Ejecutar el script de censo
python3 "$SCRIPT_DIR/censo_equipos.py"

echo ""
read -p "Presiona Enter para salir..."
