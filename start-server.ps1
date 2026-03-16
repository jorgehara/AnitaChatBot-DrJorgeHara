# ============================================
# Script de inicio para AnitaChatBot - Od. Villalba (Windows)
# ============================================

$ErrorActionPreference = "Stop"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

function Write-Header {
    Write-ColorOutput "╔══════════════════════════════════════════════════════╗" "Blue"
    Write-ColorOutput "║  AnitaChatBot - Od. Melina Villalba                 ║" "Blue"
    Write-ColorOutput "║  Script de inicio del servidor                      ║" "Blue"
    Write-ColorOutput "╚══════════════════════════════════════════════════════╝" "Blue"
    Write-Host ""
}

Write-Header

# 1. Verificar que estamos en el directorio correcto
if (-not (Test-Path "package.json")) {
    Write-ColorOutput "❌ Error: No se encuentra package.json" "Red"
    Write-ColorOutput "Ejecutá este script desde la raíz del proyecto" "Yellow"
    exit 1
}

# 2. Verificar que existe el archivo .env
if (-not (Test-Path ".env")) {
    Write-ColorOutput "❌ Error: No se encuentra el archivo .env" "Red"
    Write-Host ""
    Write-ColorOutput "Creá un archivo .env basado en .env.example:" "Yellow"
    Write-Host "  Copy-Item .env.example .env"
    Write-Host ""
    Write-ColorOutput "Y completá las variables necesarias:" "Yellow"
    Write-Host "  - CHATBOT_API_KEY"
    Write-Host "  - MONGO_DB_URI"
    Write-Host "  - API_URL"
    exit 1
}

# 3. Validar variables críticas del .env
Write-ColorOutput "📋 Validando configuración..." "Yellow"

$envContent = Get-Content ".env" -Raw
$missingVars = @()

if ($envContent -notmatch "CHATBOT_API_KEY=.+") {
    $missingVars += "CHATBOT_API_KEY"
}

if ($envContent -notmatch "MONGO_DB_URI=.+") {
    $missingVars += "MONGO_DB_URI"
}

if ($envContent -notmatch "API_URL=.+") {
    $missingVars += "API_URL"
}

if ($missingVars.Count -gt 0) {
    Write-ColorOutput "❌ Faltan variables críticas en .env:" "Red"
    foreach ($var in $missingVars) {
        Write-Host "  - $var"
    }
    Write-Host ""
    Write-ColorOutput "Editá el archivo .env y completá estas variables" "Yellow"
    exit 1
}

Write-ColorOutput "✅ Archivo .env válido" "Green"

# 4. Verificar MongoDB (Windows)
Write-ColorOutput "🔍 Verificando MongoDB..." "Yellow"

$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue

if ($mongoService) {
    if ($mongoService.Status -eq "Running") {
        Write-ColorOutput "✅ MongoDB está corriendo" "Green"
    } else {
        Write-ColorOutput "⚠️  MongoDB no está corriendo. Intentando iniciar..." "Yellow"
        try {
            Start-Service -Name "MongoDB"
            Write-ColorOutput "✅ MongoDB iniciado" "Green"
        } catch {
            Write-ColorOutput "❌ No se pudo iniciar MongoDB" "Red"
            Write-ColorOutput "Iniciá MongoDB manualmente: net start MongoDB" "Yellow"
            exit 1
        }
    }
} else {
    Write-ColorOutput "⚠️  Servicio MongoDB no encontrado" "Yellow"
    Write-ColorOutput "Asegurate de que MongoDB esté corriendo manualmente" "Yellow"
}

# 5. Liberar puertos si están ocupados
Write-ColorOutput "🔧 Verificando puertos..." "Yellow"

$PORT = 3010
$EXPRESS_PORT = 3011

foreach ($port in @($PORT, $EXPRESS_PORT)) {
    $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($connection) {
        Write-ColorOutput "⚠️  Puerto $port está ocupado. Liberando..." "Yellow"
        $processId = $connection.OwningProcess
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Write-ColorOutput "✅ Puerto $port liberado" "Green"
    }
}

# 6. Verificar que node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-ColorOutput "📦 Instalando dependencias..." "Yellow"
    npm install
}

# 7. Limpiar sesiones anteriores (opcional)
# Write-ColorOutput "🧹 Limpiando sesiones anteriores..." "Yellow"
# Remove-Item -Recurse -Force "bot_sessions" -ErrorAction SilentlyContinue

# 8. Iniciar el servidor
Write-Host ""
Write-ColorOutput "╔══════════════════════════════════════════════════════╗" "Green"
Write-ColorOutput "║  🚀 Iniciando AnitaChatBot...                       ║" "Green"
Write-ColorOutput "╚══════════════════════════════════════════════════════╝" "Green"
Write-Host ""

# Leer variables del .env para mostrar info
$envLines = Get-Content ".env"
$apiUrl = ($envLines | Where-Object { $_ -match "^API_URL=" }) -replace "API_URL=", ""
$mongoUri = ($envLines | Where-Object { $_ -match "^MONGO_DB_URI=" }) -replace "MONGO_DB_URI=", ""

Write-Host "Puerto del bot: " -NoNewline
Write-ColorOutput $PORT "Cyan"
Write-Host "Puerto Express: " -NoNewline
Write-ColorOutput $EXPRESS_PORT "Cyan"
Write-Host "API URL: " -NoNewline
Write-ColorOutput $apiUrl "Cyan"
Write-Host "MongoDB: " -NoNewline
Write-ColorOutput $mongoUri "Cyan"
Write-Host ""
Write-ColorOutput "💡 Para detener el servidor: Ctrl+C" "Yellow"
Write-Host ""

# Ejecutar con npm run dev (desarrollo)
npm run dev
