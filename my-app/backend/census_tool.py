#!/usr/bin/env python3
"""
Herramienta de Censo de Equipos - CAAST Sistemas
Recopila información de hardware y la envía al portal ERP-S
"""

import platform
import subprocess
import json
import sys
import os

try:
    import requests
except ImportError:
    print("ERROR: Módulo 'requests' no instalado.")
    print("Instala con: pip install requests")
    sys.exit(1)

def get_windows_info():
    """Obtiene información de hardware en Windows usando WMIC"""
    info = {}
    
    try:
        # Sistema Operativo
        info['sistema_operativo'] = platform.platform()
        
        # Procesador
        cpu = subprocess.check_output("wmic cpu get name", shell=True).decode().strip().split('\n')[1].strip()
        info['procesador'] = cpu
        
        # Memoria RAM
        ram = subprocess.check_output("wmic computersystem get totalphysicalmemory", shell=True).decode().strip().split('\n')[1].strip()
        ram_gb = round(int(ram) / (1024**3))
        info['memoria_ram'] = f"{ram_gb}GB"
        
        # Disco Duro
        disk = subprocess.check_output("wmic diskdrive get size,model", shell=True).decode().strip().split('\n')[1].strip()
        info['disco_duro'] = disk
        
        # Serie Disco Duro
        disk_serial = subprocess.check_output("wmic diskdrive get serialnumber", shell=True).decode().strip().split('\n')[1].strip()
        info['serie_disco_duro'] = disk_serial
        
        # Número de serie del equipo
        serial = subprocess.check_output("wmic bios get serialnumber", shell=True).decode().strip().split('\n')[1].strip()
        info['no_serie'] = serial
        
        # Marca y Modelo
        manufacturer = subprocess.check_output("wmic computersystem get manufacturer", shell=True).decode().strip().split('\n')[1].strip()
        model = subprocess.check_output("wmic computersystem get model", shell=True).decode().strip().split('\n')[1].strip()
        info['marca'] = manufacturer
        info['modelo'] = model
        
        # Nombre del equipo
        info['nombre_equipo'] = platform.node()
        
        # Usuario actual
        info['nombre_usuario_equipo'] = os.getlogin()
        
        # Tipo de equipo
        chassis = subprocess.check_output("wmic systemenclosure get chassistypes", shell=True).decode().strip().split('\n')[1].strip()
        tipo = "Desktop" if chassis in ["3", "4", "5", "6", "7"] else "Laptop"
        info['tipo_equipo'] = tipo
        
    except Exception as e:
        print(f"Error obteniendo info de Windows: {e}")
    
    return info

def get_linux_info():
    """Obtiene información de hardware en Linux"""
    info = {}
    
    try:
        # Sistema Operativo
        info['sistema_operativo'] = f"{platform.system()} {platform.release()}"
        
        # Procesador
        with open('/proc/cpuinfo', 'r') as f:
            for line in f:
                if 'model name' in line:
                    info['procesador'] = line.split(':')[1].strip()
                    break
        
        # Memoria RAM
        with open('/proc/meminfo', 'r') as f:
            mem = f.readline().split()[1]
            ram_gb = round(int(mem) / (1024**2))
            info['memoria_ram'] = f"{ram_gb}GB"
        
        # Disco Duro
        try:
            disk = subprocess.check_output("lsblk -d -o SIZE,MODEL | grep -v loop | tail -1", shell=True).decode().strip()
            info['disco_duro'] = disk
        except:
            info['disco_duro'] = "N/A"
        
        # Serie Disco Duro
        try:
            disk_serial = subprocess.check_output("lsblk -d -o SERIAL | tail -1", shell=True).decode().strip()
            info['serie_disco_duro'] = disk_serial
        except:
            info['serie_disco_duro'] = "N/A"
        
        # Número de serie del equipo
        try:
            serial = subprocess.check_output("sudo dmidecode -s system-serial-number", shell=True).decode().strip()
            info['no_serie'] = serial
        except:
            info['no_serie'] = "N/A"
        
        # Marca y Modelo
        try:
            manufacturer = subprocess.check_output("sudo dmidecode -s system-manufacturer", shell=True).decode().strip()
            model = subprocess.check_output("sudo dmidecode -s system-product-name", shell=True).decode().strip()
            info['marca'] = manufacturer
            info['modelo'] = model
        except:
            info['marca'] = "N/A"
            info['modelo'] = "N/A"
        
        # Nombre del equipo
        info['nombre_equipo'] = platform.node()
        
        # Usuario actual
        info['nombre_usuario_equipo'] = os.getlogin()
        
        # Tipo de equipo
        try:
            chassis = subprocess.check_output("sudo dmidecode -s chassis-type", shell=True).decode().strip()
            tipo = "Laptop" if "Laptop" in chassis or "Notebook" in chassis else "Desktop"
            info['tipo_equipo'] = tipo
        except:
            info['tipo_equipo'] = "Desktop"
        
    except Exception as e:
        print(f"Error obteniendo info de Linux: {e}")
    
    return info

def get_hardware_info():
    """Detecta el SO y obtiene información de hardware"""
    system = platform.system()
    
    if system == "Windows":
        return get_windows_info()
    elif system == "Linux":
        return get_linux_info()
    else:
        print(f"Sistema operativo {system} no soportado")
        return {}

def send_to_portal(info, api_url, token, empresa_id):
    """Envía la información al portal"""
    endpoint = f"{api_url}/equipment-requests"
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        **info,
        "codigo_registro": info.get('no_serie', 'N/A')  # Usar serie como código de registro por defecto
    }
    
    try:
        response = requests.post(endpoint, json=payload, headers=headers)
        
        if response.status_code == 201:
            print("\n✓ Información enviada exitosamente al portal")
            print("El administrador programará el censo de este equipo.")
            return True
        else:
            print(f"\n✗ Error al enviar: {response.status_code}")
            print(f"Detalle: {response.text}")
            return False
            
    except Exception as e:
        print(f"\n✗ Error de conexión: {e}")
        return False

def main():
    print("=" * 60)
    print("  Herramienta de Censo de Equipos - CAAST Sistemas")
    print("=" * 60)
    print()
    
    # Token embebido (será reemplazado al generar el script personalizado)
    EMBEDDED_TOKEN = "__TOKEN_PLACEHOLDER__"
    
    # Obtener información de hardware
    print("Recopilando información del equipo...")
    info = get_hardware_info()
    
    if not info:
        print("No se pudo obtener información del equipo")
        input("\nPresiona Enter para salir...")
        sys.exit(1)
    
    # Mostrar información recopilada
    print("\nInformación detectada:")
    print("-" * 60)
    for key, value in info.items():
        label = key.replace('_', ' ').title()
        print(f"  {label}: {value}")
    print("-" * 60)
    
    # Usar token embebido o solicitar
    token = EMBEDDED_TOKEN
    if token == "__TOKEN_PLACEHOLDER__" or not token:
        print("\nConfiguracion del portal:")
        print("URL del API: http://localhost:3000 (predeterminada)")
        token = input("\nIngresa tu Token de autenticacion: ").strip()
        
        if not token:
            print("\n✗ Token es obligatorio")
            print("\nPuedes obtener tu token desde el portal web:")
            print("1. Inicia sesión en http://localhost:5173")
            print("2. Después de iniciar sesión, haz clic en 'Censar Equipo Automático'")
            input("\nPresiona Enter para salir...")
            sys.exit(1)
    else:
        print("\n✓ Token detectado automáticamente")
    
    # Enviar al portal con URL fija
    print("\nEnviando información al portal...")
    success = send_to_portal(info, "http://localhost:3000", token, None)
    
    if success:
        print("\n¡Proceso completado!")
        print("La información ya está disponible en el portal web.")
    else:
        print("\nNo se pudo completar el proceso")
    
    input("\nPresiona Enter para salir...")
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProceso cancelado por el usuario")
        sys.exit(0)
