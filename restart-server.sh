#!/bin/bash

# ============================================
# Script de reinicio automático - Od. Villalba
# Reinicia el bot cada 10 minutos o si detecta errores
# ============================================

# Usar Node v20 con path absoluto (PM2 no carga NVM profile)
export PATH="/home/jorgeharadevs/.nvm/versions/node/v20.19.5/bin:$PATH"
echo "Now using node $(node -v) (npm v$(npm -v))"

# Aumentar límite de archivos abiertos
ulimit -n 65536

interval=600
restart_count=0
log_file="restart-server.log"
PORT=3012
EXPRESS_PORT=3013

while true; do
    restart_count=$((restart_count+1))
    timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] Reinicio #$restart_count" >> "$log_file"
    
    # Liberar puertos si están ocupados
    echo "Liberando puertos $PORT y $EXPRESS_PORT si están ocupados..."
    for port in $PORT $EXPRESS_PORT; do
        fuser -k $port/tcp 2>/dev/null
        PID=$(lsof -t -i:$port 2>/dev/null)
        if [ ! -z "$PID" ]; then
            kill -9 $PID 2>/dev/null
            echo "Proceso $PID en puerto $port eliminado."
        fi
    done
    
    npm run dev &
    server_pid=$!

    for ((i=0; i<$interval; i++)); do
        sleep 1
        if grep -q "app crashed" restart-server.log 2>/dev/null; then
            echo "App crashed detectado. Reiniciando inmediatamente..." >> "$log_file"
            kill $server_pid 2>/dev/null
            break
        fi
    done

    kill $server_pid 2>/dev/null
    echo "Servidor detenido o reiniciado."
done
