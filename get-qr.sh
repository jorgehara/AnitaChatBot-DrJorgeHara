#!/bin/bash

# ============================================
# get-qr.sh — Descarga el QR de WhatsApp del
# servidor y lo abre en tu máquina local.
#
# Uso:
#   npm run qr
#   bash get-qr.sh
#   bash get-qr.sh jorge@100.120.226.7   (servidor custom)
# ============================================

SERVER="${1:-jorgeharadevs@100.120.226.7}"
REMOTE_QR="/home/jorgeharadevs/Desktop/AnitaChatBot-Odontologia/bot.qr.png"
LOCAL_QR="$TEMP/bot.qr.png"

# En Windows (Git Bash / WSL) TEMP puede no estar, fallback a /tmp
if [ -z "$TEMP" ]; then
    LOCAL_QR="/tmp/bot.qr.png"
fi

echo ""
echo "🤖 ANITA — Get WhatsApp QR"
echo "================================"
echo "Servidor: $SERVER"
echo ""

# Verificar que el bot está corriendo
echo "🔍 Verificando que el bot esté online..."
STATUS=$(ssh "$SERVER" "pm2 jlist 2>/dev/null | python3 -c \"import sys,json; procs=json.load(sys.stdin); p=[x for x in procs if x.get('name')=='chatbot-odontologa']; print(p[0]['pm2_env']['status'] if p else 'not found')\" 2>/dev/null")

if [ "$STATUS" != "online" ]; then
    echo "⚠️  El bot no está online (status: ${STATUS:-desconocido})"
    echo "   Asegurate de que PM2 tenga el proceso 'chatbot-odontologa' corriendo."
    echo ""
fi

# Descargar el QR
echo "📥 Descargando QR desde el servidor..."
scp "$SERVER:$REMOTE_QR" "$LOCAL_QR" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ No se pudo descargar el QR."
    echo ""
    echo "   Posibles causas:"
    echo "   1. El bot todavía no generó el QR (esperá ~10 segundos y reintentá)"
    echo "   2. La sesión ya está activa (no necesita QR)"
    echo "   3. Error de conexión SSH con el servidor"
    echo ""
    echo "   Para verificar manualmente:"
    echo "   ssh $SERVER \"pm2 logs chatbot-odontologa --lines 20 --nostream\""
    exit 1
fi

echo "✅ QR descargado en: $LOCAL_QR"
echo ""
echo "📱 Abriendo QR... Escanealo con WhatsApp:"
echo "   WhatsApp → Dispositivos vinculados → Vincular dispositivo"
echo ""

# Abrir la imagen según el sistema operativo
if command -v explorer.exe &>/dev/null; then
    # Windows (Git Bash)
    explorer.exe "$(wslpath -w "$LOCAL_QR" 2>/dev/null || echo "$LOCAL_QR")"
elif command -v xdg-open &>/dev/null; then
    # Linux
    xdg-open "$LOCAL_QR"
elif command -v open &>/dev/null; then
    # macOS
    open "$LOCAL_QR"
else
    echo "   No se pudo abrir automáticamente."
    echo "   Abrí el archivo manualmente: $LOCAL_QR"
fi

echo "⏱️  El QR expira en ~60 segundos."
echo "   Si expiró, volvé a correr: npm run qr"
echo ""
