# AnitaChatBot - Odontología

Chatbot de WhatsApp para el consultorio de la **Od. Melina Villalba**. Gestiona reservas de turnos odontológicos integrándose con el backend multi-tenant de CitaMedicaBeta.

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│          VPS (PRODUCCIÓN)               │
│                                         │
│  - CitaMedicaBeta Backend (puerto 3001) │
│  - MongoDB                              │
│  - Nginx (SSL, subdominios)             │
│  - https://od-melinavillalba.           │
│    micitamedica.me/api                  │
└─────────────────────────────────────────┘
                    ▲
                    │
                    │ HTTPS + X-API-Key
                    │
        ┌───────────┴───────────┐
        │                       │
┌───────▼────────┐    ┌────────▼─────────┐
│  Chatbot       │    │  Chatbot         │
│  Dr. Kulinka   │    │  Od. Villalba    │
│  (LOCAL)       │    │  (LOCAL - ESTE)  │
│  Puerto 3008   │    │  Puerto 3010     │
└────────────────┘    └──────────────────┘
```

## 🚀 Stack Tecnológico

- **Framework**: BuilderBot + Baileys (WhatsApp Web API)
- **Runtime**: Node.js + TypeScript
- **DB Local**: MongoDB (sesiones de WhatsApp)
- **HTTP Client**: Axios con retry logic
- **Backend**: `https://od-melinavillalba.micitamedica.me/api`

## 📋 Configuración del Consultorio

- **Días laborales**: Lunes a Jueves (1, 2, 3, 4)
- **Horarios**: 15:00 - 20:00 (solo tarde)
- **Duración de turnos**: 30 minutos
- **Obras sociales**: Solo CONSULTA PARTICULAR

## 🔧 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/jorgehara/AnitaChatBot-Odontologia.git
cd AnitaChatBot-Odontologia
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Copiar el archivo de ejemplo:

```bash
cp .env.example .env
```

Editar `.env` con los valores correctos:

```env
# MongoDB Configuration
MONGO_DB_URI=mongodb://localhost:27017/consultorio-odontologa
MONGO_DB_NAME=consultorio-odontologa

# Backend API Configuration
API_URL=https://od-melinavillalba.micitamedica.me/api
CLINIC_BASE_URL=https://od-melinavillalba.micitamedica.me

# Chatbot API Key (obtener del backend)
CHATBOT_API_KEY=<api-key-generada-en-backend>

# Bot Configuration
PORT=3010

# Admin Configuration
ADMIN_NUMBER=549xxxxxxxxx
```

### 4. Obtener la API Key del backend

**En el VPS**, ejecutar:

```bash
# Conectarse a MongoDB
mongosh 'mongodb://USER:PASS@localhost:27017/consultorio?authSource=admin'

# Consultar la API Key
db.clinics.findOne({ slug: 'od-melinavillalba' }, { 'chatbot.apiKey': 1 })
```

Copiar el valor de `chatbot.apiKey` al `.env` local.

## ▶️ Ejecución

### Desarrollo (con hot reload)

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

## 📱 Primer uso

1. Al iniciar el bot por primera vez, se generará un código QR en la terminal
2. Escanear el código QR desde WhatsApp (Dispositivos vinculados)
3. El bot se conectará y quedará listo para recibir mensajes

## 🔐 Autenticación con el Backend

El chatbot se autentica usando el header `X-API-Key` configurado en el `.env`:

```
X-API-Key: <CHATBOT_API_KEY>
```

Esta API Key debe coincidir con:
```javascript
db.clinics.findOne({ slug: 'od-melinavillalba' }).chatbot.apiKey
```

## 🌐 Endpoints del Backend

| Endpoint | Descripción |
|----------|-------------|
| `GET /appointments/available/:date` | Horarios disponibles |
| `POST /appointments` | Crear turno normal |
| `GET /sobreturnos/date/:date` | Sobreturnos disponibles |
| `POST /sobreturnos` | Crear sobreturno |
| `POST /tokens/generate-public-token` | Generar link de reserva web |

## 📁 Estructura del Proyecto

```
AnitaChatBot-Odontologia/
├── src/
│   ├── app.ts                  # Punto de entrada + flows
│   ├── config/
│   │   ├── axios.ts            # Cliente HTTP con retry
│   │   └── app.ts              # Configuración general
│   ├── utils/
│   │   ├── appointmentService.ts   # Servicio de turnos
│   │   ├── sobreturnoService.ts    # Servicio de sobreturnos
│   │   ├── cache.ts                # Cache en memoria
│   │   ├── dateFormatter.ts        # Formateo de fechas
│   │   └── fallbackData.ts         # Datos offline
│   └── types/
│       └── api.ts              # TypeScript types
├── .env                        # Variables de entorno (NO commitear)
├── .env.example                # Template de variables
└── package.json
```

## 🧪 Testing

Verificar que el backend responde:

```bash
curl https://od-melinavillalba.micitamedica.me/api/health
```

Verificar autenticación:

```bash
curl https://od-melinavillalba.micitamedica.me/api/appointments/available/2026-03-17 \
  -H "X-API-Key: <tu-api-key>"
```

## 🐛 Troubleshooting

### Error: "API Key inválida"

Verificar que `CHATBOT_API_KEY` en `.env` coincide con `clinic.chatbot.apiKey` en MongoDB.

### Error: "No trae turnos"

1. Verificar que la URL del backend es correcta
2. Verificar que el backend responde: `curl https://od-melinavillalba.micitamedica.me/api/health`
3. Verificar logs del backend en el VPS: `pm2 logs cita-medica-backend`

### El bot no se conecta a WhatsApp

1. Eliminar carpeta `bot_sessions/`
2. Reiniciar el bot
3. Escanear el QR nuevamente

## 📝 Convenciones

- Fechas para API: `'yyyy-MM-dd'`
- Fechas para usuario: `formatearFechaEspanol()` → "domingo 19 de enero de 2026"
- Horarios: `'HH:mm'` (formato 24h)
- Logs: `console.log('[SOBRETURNO]', ...)`

## 📚 Documentación Relacionada

- [BuilderBot Docs](https://builderbot.vercel.app/)
- [CitaMedicaBeta Backend](https://github.com/tuusuario/CitaMedicaBeta)

## 👥 Autores

- **Jorge Hara** - [GitHub](https://github.com/jorgehara)

## 📄 Licencia

MIT

---

**Última actualización**: 2026-03-15
