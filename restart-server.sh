#!/bin/bash

# ============================================
# Script de reinicio automático - Od. Villalba
# Reinicia el bot cada 10 minutos o si detecta errores
# ============================================

interval=600 # en segundos (10 minutos)
restart_count=0
log_file="restart-server.log"
PORT=3010  # Puerto del bot Od. Villalba
EXPRESS_PORT=3011  # Puerto Express

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
            kill -9 $PID 2>/dev/null || sudo kill -9 $PID 2>/dev/null
            echo "Proceso $PID en puerto $port eliminado."
        fi
    done
    
    npm run dev &
    server_pid=$!

    for ((i=0; i<$interval; i++)); do
        sleep 1
     if grep -q "SOBRETURNO TIMEOUT" restart-server.log || \
         grep -q "\\[SOBRETURNO SERVICE\\] Sistema en modo offline:" restart-server.log || \
         grep -q "\\[nodemon\\] app crashed" restart-server.log || \
         grep -q "Timed Out" restart-server.log || \
         grep -q "Missed call" restart-server.log || \
         grep -q "Buffer" restart-server.log || \
         grep -iq "crash" restart-server.log || \
         grep -iq "crashed" restart-server.log || \
         grep -q "Failed to decrypt message with any known session" restart-server.log || \
         grep -q "Bad MAC" restart-server.log || \
         grep -q $'0|restart- | \xE2\x9C\x85 Connected Provider\n0|restart- | Tell a contact on your WhatsApp to write "hello"...\n0|restart- | \n0|restart- | [nodemon] app crashed - waiting for file changes before starting...' restart-server.log; then
        echo "SOBRETURNO TIMEOUT, modo offline, app crashed, Timed Out, llamada perdida, error de clave, Bad MAC o crash detectado. Reiniciando inmediatamente..." >> "$log_file"
        kill $server_pid 2>/dev/null
        break
        fi
    done

    kill $server_pid 2>/dev/null
    echo "Servidor detenido o reiniciado."
done