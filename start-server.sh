#!/bin/bash

# ============================================
# Script de inicio para AnitaChatBot - Od. Villalba
# ============================================

set -e  # Detener si hay errores

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║  AnitaChatBot - Od. Melina Villalba                 ║"
echo "║  Script de inicio del servidor                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# 1. Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: No se encuentra package.json${NC}"
    echo "Ejecutá este script desde la raíz del proyecto"
    exit 1
fi

# 2. Verificar que existe el archivo .env
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: No se encuentra el archivo .env${NC}"
    echo ""
    echo "Creá un archivo .env basado en .env.example:"
    echo "  cp .env.example .env"
    echo ""
    echo "Y completá las variables necesarias:"
    echo "  - CHATBOT_API_KEY"
    echo "  - MONGO_DB_URI"
    echo "  - API_URL"
    exit 1
fi

# 3. Validar variables críticas del .env
echo -e "${YELLOW}📋 Validando configuración...${NC}"

source .env 2>/dev/null || true

missing_vars=()

if [ -z "$CHATBOT_API_KEY" ]; then
    missing_vars+=("CHATBOT_API_KEY")
fi

if [ -z "$MONGO_DB_URI" ]; then
    missing_vars+=("MONGO_DB_URI")
fi

if [ -z "$API_URL" ]; then
    missing_vars+=("API_URL")
fi

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo -e "${RED}❌ Faltan variables críticas en .env:${NC}"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Editá el archivo .env y completá estas variables"
    exit 1
fi

echo -e "${GREEN}✅ Archivo .env válido${NC}"

# 4. Verificar MongoDB
echo -e "${YELLOW}🔍 Verificando MongoDB...${NC}"

if command -v systemctl &> /dev/null; then
    # Systemd (Ubuntu, Debian, Arch, etc.)
    if systemctl is-active --quiet mongod; then
        echo -e "${GREEN}✅ MongoDB está corriendo${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB no está corriendo. Intentando iniciar...${NC}"
        sudo systemctl start mongod || {
            echo -e "${RED}❌ No se pudo iniciar MongoDB${NC}"
            echo "Iniciá MongoDB manualmente: sudo systemctl start mongod"
            exit 1
        }
        echo -e "${GREEN}✅ MongoDB iniciado${NC}"
    fi
elif command -v service &> /dev/null; then
    # SysV Init (sistemas más viejos)
    if service mongod status &> /dev/null; then
        echo -e "${GREEN}✅ MongoDB está corriendo${NC}"
    else
        echo -e "${YELLOW}⚠️  MongoDB no está corriendo. Intentando iniciar...${NC}"
        sudo service mongod start || {
            echo -e "${RED}❌ No se pudo iniciar MongoDB${NC}"
            exit 1
        }
    fi
else
    echo -e "${YELLOW}⚠️  No se pudo verificar el estado de MongoDB${NC}"
    echo "Asegurate de que MongoDB esté corriendo manualmente"
fi

# 5. Liberar puerto si está ocupado
PORT=${PORT:-3010}
EXPRESS_PORT=3011

echo -e "${YELLOW}🔧 Verificando puertos...${NC}"

for port in $PORT $EXPRESS_PORT; do
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Puerto $port está ocupado. Liberando...${NC}"
        PID=$(lsof -t -i:$port)
        kill -9 $PID 2>/dev/null || sudo kill -9 $PID 2>/dev/null || true
        sleep 2
        echo -e "${GREEN}✅ Puerto $port liberado${NC}"
    fi
done

# 6. Verificar que node_modules existe
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Instalando dependencias...${NC}"
    npm install
fi

# 7. Limpiar sesiones anteriores (opcional, comentar si querés mantener la sesión de WhatsApp)
# echo -e "${YELLOW}🧹 Limpiando sesiones anteriores...${NC}"
# rm -rf bot_sessions/

# 8. Iniciar el servidor
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  🚀 Iniciando AnitaChatBot...                       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Puerto del bot:${NC} $PORT"
echo -e "${BLUE}Puerto Express:${NC} $EXPRESS_PORT"
echo -e "${BLUE}API URL:${NC} $API_URL"
echo -e "${BLUE}MongoDB:${NC} $MONGO_DB_URI"
echo ""
echo -e "${YELLOW}💡 Para detener el servidor: Ctrl+C${NC}"
echo -e "${YELLOW}💡 Para ver logs: tail -f logs/*.log${NC}"
echo ""

# Ejecutar con npm run dev (desarrollo) o npm start (producción)
npm run dev
