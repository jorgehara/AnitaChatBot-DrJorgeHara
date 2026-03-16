# 🚀 Guía de Inicio Rápido - AnitaChatBot Od. Villalba

## 📋 Pre-requisitos

1. **Node.js** instalado (versión 18 o superior)
2. **MongoDB** instalado y corriendo
3. **Archivo `.env`** configurado

---

## ⚡ Inicio Rápido

### En Linux / WSL / Git Bash (Windows)

```bash
# 1. Copiar el .env desde tu otra máquina
#    (o crear uno desde .env.example)
cp .env.example .env
# Editar .env y completar las variables

# 2. Dar permisos de ejecución al script
chmod +x start-server.sh

# 3. Iniciar el servidor
npm run start:server

# O directamente:
./start-server.sh
```

### En Windows (PowerShell)

```powershell
# 1. Copiar el .env desde tu otra máquina
#    (o crear uno desde .env.example)
Copy-Item .env.example .env
# Editar .env y completar las variables

# 2. Iniciar el servidor
npm run start:server:win

# O directamente:
powershell -ExecutionPolicy Bypass -File start-server.ps1
```

---

## 📝 Configuración del `.env`

**Mínimo necesario para que funcione:**

```env
# API Key del chatbot (debe coincidir con MongoDB del backend)
CHATBOT_API_KEY=04a5d1ae7c4b9b843084daf954ab1db5456f358b5da502d70cb5f05d44913f64

# URL del backend
API_URL=https://od-melinavillalba.micitamedica.me/api
CLINIC_BASE_URL=https://od-melinavillalba.micitamedica.me

# MongoDB (puede ser local o remoto)
MONGO_DB_URI=mongodb://localhost:27017/consultorio-odontologa
MONGO_DB_NAME=consultorio-odontologa

# Puerto del bot
PORT=3010

# Número de admin (opcional)
ADMIN_NUMBER=549xxxxxxxxx
```

---

## 🔧 Scripts Disponibles

### Desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm run start:server` | **Linux/Mac/WSL**: Inicia el servidor con validaciones |
| `npm run start:server:win` | **Windows**: Inicia el servidor con validaciones |
| `npm run dev` | Inicia el servidor en modo desarrollo (sin validaciones) |
| `npm run build` | Compila TypeScript a JavaScript |

### Producción (PM2)

| Comando | Descripción |
|---------|-------------|
| `npm run pm2:start` | Inicia el bot con PM2 |
| `npm run pm2:restart` | Reinicia el bot |
| `npm run pm2:stop` | Detiene el bot |
| `npm run pm2:logs` | Ver logs en tiempo real |
| `npm run pm2:status` | Ver estado de procesos |
| `npm run server:deploy` | Deploy completo (reinicio automático + PM2) |

---

## ✅ Validaciones Automáticas

Los scripts `start-server.sh` y `start-server.ps1` hacen las siguientes validaciones antes de iniciar:

1. ✅ Verifica que exista `package.json` (directorio correcto)
2. ✅ Verifica que exista el archivo `.env`
3. ✅ Valida que estén las variables críticas: `CHATBOT_API_KEY`, `MONGO_DB_URI`, `API_URL`
4. ✅ Verifica que MongoDB esté corriendo (y lo inicia si está detenido)
5. ✅ Libera los puertos 3010 y 3011 si están ocupados
6. ✅ Instala dependencias si no existen (`node_modules`)
7. 🚀 Inicia el servidor

---

## 🐛 Solución de Problemas

### Error: "No se encuentra el archivo .env"

**Solución:**
```bash
cp .env.example .env
# Editar .env y completar CHATBOT_API_KEY
```

### Error: "MongoDB no está corriendo"

**Linux:**
```bash
sudo systemctl start mongod
# O instalar MongoDB:
sudo apt install mongodb-org  # Ubuntu/Debian
```

**Windows:**
```powershell
net start MongoDB
```

### Error: "Puerto 3010 está ocupado"

Los scripts liberan automáticamente los puertos. Si aún falla:

**Linux:**
```bash
lsof -ti:3010 | xargs kill -9
```

**Windows:**
```powershell
Get-NetTCPConnection -LocalPort 3010 | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force
```

### Error: "Invalid API Key" / "Unauthorized"

Verificá que `CHATBOT_API_KEY` en el `.env` coincida con el valor en MongoDB del backend:

```bash
# En el servidor del backend, conectar a MongoDB:
mongo
use citamedica
db.clinics.findOne({ slug: 'od-melinavillalba' }, { 'chatbot.apiKey': 1 })
```

La API key debe ser:
```
04a5d1ae7c4b9b843084daf954ab1db5456f358b5da502d70cb5f05d44913f64
```

---

## 📦 Copiar `.env` entre máquinas

### Desde Windows a Linux (SSH)

```powershell
# En Windows PowerShell:
scp .env usuario@IP_LINUX:~/AnitaChatBot-Odontologia/
```

### Manualmente

**Windows:**
1. Abrir `.env` con Notepad
2. Copiar todo el contenido

**Linux:**
```bash
cd ~/AnitaChatBot-Odontologia
nano .env
# Pegar el contenido
# Ctrl+O para guardar, Ctrl+X para salir
```

---

## 🔄 Reinicio Automático (Producción)

Para que el bot se reinicie automáticamente cada 10 minutos o cuando detecta errores:

```bash
# Iniciar con PM2 (reinicio automático):
npm run server:deploy

# Ver logs:
npm run pm2:logs

# Detener reinicio automático:
pm2 stop restart-server-odontologa
```

---

## 📱 Primera vez: Escanear QR de WhatsApp

1. Iniciar el servidor: `npm run start:server`
2. Esperar a que aparezca el QR en la consola
3. Abrir WhatsApp en el teléfono → Dispositivos vinculados → Vincular dispositivo
4. Escanear el QR
5. Listo! El bot responde en WhatsApp

---

## 🎯 Verificación Completa

Después de iniciar el servidor, verificar:

```bash
# 1. El bot está corriendo:
curl http://localhost:3011/health
# Respuesta: OK

# 2. El backend reconoce la API key:
curl -X POST https://od-melinavillalba.micitamedica.me/api/tokens/generate-public-token \
  -H "X-API-Key: 04a5d1ae7c4b9b843084daf954ab1db5456f358b5da502d70cb5f05d44913f64"
# Respuesta: { "data": { "token": "..." } }

# 3. Enviar "hola" por WhatsApp al bot
# Debería responder con el mensaje de bienvenida
```

---

## 📞 Contacto

Si seguís teniendo problemas, revisá los logs:

```bash
# Logs de la aplicación:
tail -f logs/*.log

# Logs de PM2:
npm run pm2:logs

# Logs del script de reinicio:
tail -f restart-server.log
```
