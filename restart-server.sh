#!/bin/bash
# ============================================
# Script de inicio - Dr. Jorge Hara
# Usa PM2 para restart automático
# ============================================

# Usar Node v22 con path absoluto (PM2 no carga NVM profile)
export PATH="/root/.nvm/versions/node/v22.16.0/bin:$PATH"
echo "Using node $(node -v) (npm v$(npm -v))"

# Aumentar límite de archivos abiertos
ulimit -n 65536

# Ir al directorio del proyecto
cd ~/AnitaChatBot-DrJorgeHara

# Iniciar en modo producción (SIN nodemon — PM2 maneja restarts)
npm run start