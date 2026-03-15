# GUÍA COMPLETA: Clonar ANITACHATBOT para Od. Melina Villalba

**Proyecto base:** AnitaByCitaMedica (Dr. Kulinka)
**Proyecto destino:** ANITACHATBOT-odontologa (Od. Melina Villalba)
**Fecha:** 2026-03-13
**Prerequisito:** Backend CitaMedicaBeta con soporte multi-tenant deployado y Clinic `od-melinavillalba` creada en MongoDB.

---

## Tabla de Contenidos

1. [Resumen del proyecto base](#1-resumen-del-proyecto-base)
2. [Arquitectura y archivos clave](#2-arquitectura-y-archivos-clave)
3. [Flujos de conversación](#3-flujos-de-conversación)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Valores hardcodeados a cambiar](#5-valores-hardcodeados-a-cambiar)
6. [Textos de mensajes a personalizar](#6-textos-de-mensajes-a-personalizar)
7. [Paso a paso: clonar y configurar](#7-paso-a-paso-clonar-y-configurar)
8. [Configuración MongoDB (Clinic)](#8-configuración-mongodb-clinic)
9. [Configuración PM2](#9-configuración-pm2)
10. [Verificación final](#10-verificación-final)
11. [Diferencias Od. Villalba vs Dr. Kulinka](#11-diferencias-od-villalba-vs-dr-kulinka)

---

## 1. Resumen del proyecto base

**AnitaByCitaMedica** es un chatbot de WhatsApp para gestión de citas médicas/odontológicas.

| Atributo | Valor actual (Dr. Kulinka) |
|----------|---------------------------|
| Framework | BuilderBot 1.3.14 |
| Provider WhatsApp | Baileys (escaneo QR) |
| Base de datos | MongoDB (MongoAdapter) |
| Lenguaje | TypeScript / Node.js (ESM) |
| Puerto bot (BuilderBot) | 3008 |
| Puerto Express (webhook/health) | 3009 |
| PM2 process name | `anita-bot` |
| API backend | `https://micitamedica.me/api` |
| Timezone | `America/Argentina/Buenos_Aires` |

### Stack de dependencias

```json
"@builderbot/bot": "1.3.14",
"@builderbot/provider-baileys": "1.3.14",
"@builderbot/database-mongo": "1.3.14",
"date-fns": "^4.1.0",
"date-fns-tz": "^3.2.0",
"dotenv": "^17.2.1",
"express": "^5.1.0"
```

---

## 2. Arquitectura y archivos clave

```
AnitaByCitaMedica/
├── src/
│   ├── app.ts                    ⭐ ARCHIVO PRINCIPAL — contiene todos los flujos principales
│   ├── flows/
│   │   ├── sobreturnoFlow.ts     Flujo de sobreturnos (VERSIÓN LEGACY — no se usa en producción)
│   │   └── availableSlots.flow.ts Flujo de slots (VERSIÓN LEGACY — no se usa en producción)
│   ├── utils/
│   │   ├── appointmentService.ts  Servicio para turnos normales (GET disponibles, POST crear)
│   │   ├── sobreturnoService.ts   Servicio para sobreturnos (GET disponibles, POST crear)
│   │   ├── dateFormatter.ts       Formatea fechas en español
│   │   ├── cache.ts               Cache en memoria (TTL 5 minutos, Singleton)
│   │   ├── fallbackData.ts        Slots hardcodeados cuando el backend no responde
│   │   └── botControl.ts          Control de bot activo/inactivo por conversación
│   ├── config/
│   │   ├── app.ts                 ⭐ Config central (API_URL, obras sociales, timezone)
│   │   └── axios.ts               ⭐ Instancia Axios con X-API-Key y retry logic
│   └── types/
│       └── api.ts                 Tipos TypeScript de la API
├── .env                           Variables de entorno
├── package.json
└── tsconfig.json
```

### Nota importante sobre los archivos de flows/

Los archivos `src/flows/sobreturnoFlow.ts` y `src/flows/availableSlots.flow.ts` son versiones anteriores que **NO están registrados en el bot** (no aparecen en el `createFlow()` de app.ts). Toda la lógica activa está en `src/app.ts`.

---

## 3. Flujos de conversación

Todos los flujos activos se definen y registran en `src/app.ts`.

### 3.1 `welcomeFlow` — Flujo principal de bienvenida

**Trigger:** palabras clave de saludo + `turnos`, `turno`
```
['hi', 'hello', 'hola', 'buenas', 'hola doctor', 'doctor', 'buenos días',
 'buenas tardes', 'buenas noches', 'ho', 'ola', 'turnos', 'turno']
```

**Lógica:**
1. Detecta la hora actual en timezone Argentina
2. Calcula el próximo día hábil (lunes-viernes, si es después de las 20:30 pasa al siguiente día)
3. Consulta si el médico tiene bloqueo ese día: `GET /unavailability?date=YYYY-MM-DD`
   - Si hay bloqueo `full`: informa que no hay atención y muestra próximo día disponible
   - Si hay bloqueo `morning` o `afternoon`: filtra los horarios de ese período
4. Muestra mensaje de bienvenida: `"¡Bienvenido al Asistente Virtual del Dr.Kulinka!"`
5. Consulta horarios disponibles: `GET /appointments/available/{fecha}`
6. Muestra lista de horarios mañana/tarde
7. Si no hay turnos normales → consulta sobreturnos: `GET /sobreturnos/date/{fecha}`
8. Guarda slots en estado y espera selección del usuario

### 3.2 `bookSobreturnoFlow` (en app.ts, línea ~315) — Flujo de sobreturnos

**Trigger:** `['sobreturnos', 'sobreturno', 'Sobreturnos', 'Sobreturno']`

**Lógica paso a paso:**
1. Chequea bloqueo de disponibilidad del médico para el día
2. Pide nombre y apellido del paciente (validación: mínimo 2 palabras)
3. Muestra lista de obras sociales y pide selección (número 1-6)
4. Consulta sobreturnos disponibles usando doble verificación:
   - `sobreturnoService.getSobreturnosStatus(fecha)` → obtiene reservados
   - `sobreturnoService.getAvailableSobreturnos(fecha)` → obtiene disponibles
   - Verificación paralela por número: `GET /sobreturnos/validate/{numero}`
5. Muestra sobreturnos disponibles divididos en mañana (1-5) y tarde (6-10)
   - Mañana: 11:00, 11:15, 11:30, 11:45, 12:00
   - Tarde: 19:00, 19:15, 19:30, 19:45, 20:00
6. Usuario elige número → crea sobreturno: `POST /sobreturnos`
7. Confirma el sobreturno con todos los datos

### 3.3 `sobreTurnosTemporario` (en app.ts, línea ~223) — Flujo info de sobreturnos

**Trigger:** mismo que `bookSobreturnoFlow`
**Nota:** Este flujo parece estar duplicado. En producción, el que se registra en `createFlow()` es el que importa.

### 3.4 `cancelFlow`

**Trigger:** `['cancelar', 'cancel', 'salir']`
Limpia el estado y despide al usuario. Muestra teléfono de contacto.

### 3.5 `goodbyeFlow`

**Trigger:** `['bye', 'adiós', 'chao', 'chau']`
Mensaje de despedida simple.

### 3.6 `adminFlow`

**Trigger:** `['!admin', '!help']` (solo si `ctx.from === ADMIN_NUMBER`)
Comandos: `!help`, `!disconnect`, `!status`

### 3.7 Flujo de selección y reserva (parte de welcomeFlow)

Después de mostrar horarios, `welcomeFlow` captura la respuesta del usuario:
- Si el usuario eligió un slot normal → navega al flujo de datos del paciente (nombre + obra social) → crea turno: `POST /appointments`
- Si el usuario eligió un sobreturno (modo sobreturno) → crea sobreturno: `POST /sobreturnos`

---

## 4. Variables de entorno

### `.env` actual (Dr. Kulinka)

```env
# Puerto del chatbot BuilderBot
PORT=3008

# MongoDB
MONGO_DB_URI=mongodb://...
MONGO_DB_NAME=consultorio

# API del backend CitaMedica
API_URL=https://micitamedica.me/api
CHATBOT_API_KEY=<api-key-actual>

# Admin WhatsApp
ADMIN_NUMBER=<número-admin>
```

### `.env` para Od. Villalba (nuevo archivo)

```env
# ============================================
# ANITACHATBOT — Od. Melina Villalba
# ============================================

# Puerto del chatbot BuilderBot (DIFERENTE para evitar conflicto con Dr. Kulinka)
PORT=3010

# MongoDB (puede usar la misma instancia, diferente DB)
MONGO_DB_URI=mongodb://localhost:27017/consultorio-odontologa
MONGO_DB_NAME=consultorio-odontologa

# API del backend CitaMedica — subdominio de la odontóloga
# ⚠️ CRÍTICO: el subdominio determina el tenant en el backend multi-tenant
API_URL=https://od-melinavillalba.micitamedica.me/api

# API Key del chatbot — debe coincidir con Clinic.chatbot.apiKey en MongoDB
CHATBOT_API_KEY=GENERAR-API-KEY-ODONTOLOGA

# Admin WhatsApp (número del admin para comandos !admin)
ADMIN_NUMBER=<número-admin>
```

> **Nota sobre puertos:** El Dr. Kulinka usa 3008 (bot) y 3009 (Express). Para la odontóloga usar 3010 (bot) y 3011 (Express), o según lo que esté disponible en el servidor.

---

## 5. Valores hardcodeados a cambiar

Estos valores están escritos directamente en el código (no en `.env`) y **deben cambiarse** en el clon.

### 5.1 En `src/app.ts`

| Línea aprox. | Valor actual | Cambiar a |
|-------------|-------------|-----------|
| 46 | `const API_URL = 'https://micitamedica.me/api'` | `const API_URL = process.env.API_URL \|\| 'https://od-melinavillalba.micitamedica.me/api'` |
| 205-218 | `bookingUrl = 'https://micitamedica.me/seleccionar-sobreturno'` | `bookingUrl = \`https://od-melinavillalba.micitamedica.me/seleccionar-sobreturno\`` |
| 263 | `bookingUrl = 'https://micitamedica.me/agendar-turno'` | URL de la odontóloga |
| 273 | `bookingUrl = \`https://micitamedica.me/reservar-turno?token=${token}\`` | URL de la odontóloga |
| 217, 292, etc. | `3735604949` (teléfono del consultorio) | Teléfono real de Od. Villalba |
| 59 | `const expressPort = 3009` | `3011` (o el que no esté en uso) |
| 1200, 1286 | `"Dr. Kulinka"` | `"Od. Melina Villalba"` |
| Múltiples | `"cita médica"`, `"médico"` | `"consulta odontológica"`, `"odontológica"` |

### 5.2 En `src/config/app.ts`

| Campo | Valor actual | Cambiar a |
|-------|-------------|-----------|
| `API_URL` | `'https://micitamedica.me/api'` | leer de `process.env.API_URL` |
| `PORT` | `3008` | `3010` |
| `SOCIAL_WORKS` | INSSSEP, Swiss Medical, OSDE, Galeno, CONSULTA PARTICULAR | `{ '1': 'CONSULTA PARTICULAR' }` |
| `MESSAGES.WELCOME` | `'Bienvenido al Sistema de Citas Médicas'` | `'Bienvenido al Consultorio Od. Melina Villalba'` |
| `MESSAGES.INSTRUCTIONS` | llegar 30 min antes, carnet obra social | ajustar para odontología |

### 5.3 En `src/flows/sobreturnoFlow.ts` (si se usa)

| Campo | Valor actual | Cambiar a |
|-------|-------------|-----------|
| Lista obras sociales | INSSSEP, Swiss Medical, OSDE, Galeno, CONSULTA PARTICULAR, Otras | `'1': 'CONSULTA PARTICULAR'` |

---

## 6. Textos de mensajes a personalizar

### 6.1 Mensaje de bienvenida

```typescript
// ANTES (app.ts ~línea 1200, 1209):
`🤖🩺 *¡Bienvenido al Asistente Virtual del Dr.Kulinka!* 🩺`

// DESPUÉS:
`🦷 *¡Bienvenido al Asistente Virtual de la Od. Melina Villalba!* 🦷`
```

### 6.2 Mensaje cuando no hay atención (bloqueo full)

```typescript
// ANTES:
`⚠️ *El Dr. Kulinka no atiende el ${fecha}.*`

// DESPUÉS:
`⚠️ *La Od. Villalba no atiende el ${fecha}.*`
```

### 6.3 Mensaje de confirmación de turno normal

```typescript
// ANTES:
`✨ *CONFIRMACIÓN DE CITA MÉDICA* ✨`
`- Traiga su carnet de obra social`

// DESPUÉS:
`✨ *CONFIRMACIÓN DE CONSULTA ODONTOLÓGICA* ✨`
// Quitar "Traiga su carnet de obra social" (no trabaja con obras sociales)
```

### 6.4 Lista de obras sociales

La Od. Villalba trabaja **solo de manera particular** (sin obras sociales).

```typescript
// ANTES (aparece en múltiples lugares de app.ts):
'1️⃣ INSSSEP\n' +
'2️⃣ Swiss Medical\n' +
'3️⃣ OSDE\n' +
'4️⃣ Galeno\n' +
'5️⃣ CONSULTA PARTICULAR\n' +
'6️⃣ Otras Obras Sociales\n\n' +
'_Responde con el número correspondiente (1, 2, 3, 4, 5 o 6)_'

// DESPUÉS:
'1️⃣ CONSULTA PARTICULAR\n\n' +
'_Responde con el número correspondiente (solo opción 1)_'

// Y el objeto socialWorks:
const socialWorks = { '1': 'CONSULTA PARTICULAR' };
```

### 6.5 Teléfono de contacto

```typescript
// ANTES (múltiples ocurrencias en app.ts):
'📞 Llamá al: *3735604949*'
'📞 *3735604949*'

// DESPUÉS (confirmar con la odontóloga):
'📞 Llamá al: *XXXXXXXXXX*'
```

### 6.6 Mensaje de sobreturnos — referencia al tipo de profesional

```typescript
// ANTES:
'💡 *El chatbot también puede ayudarte* - Si no hay turnos normales disponibles, automáticamente te ofrecerá los sobreturnos.'

// DESPUÉS: (igual, no cambia la lógica)
```

### 6.7 URLs en mensajes de sobreturnos

```typescript
// ANTES:
bookingUrl = `https://micitamedica.me/reservar-turno?token=${token}`;

// DESPUÉS:
bookingUrl = `https://od-melinavillalba.micitamedica.me/reservar?token=${token}`;
// Nota: el path puede ser /reservar o /reservar-turno según el frontend
```

---

## 7. Paso a paso: clonar y configurar

### Paso 1: Duplicar el repositorio

```bash
# En el VPS:
cd /var/www
cp -r ANITACHATBOT ANITACHATBOT-odontologa
cd ANITACHATBOT-odontologa

# Eliminar sesión anterior (si existe)
rm -rf bot_sessions/
```

### Paso 2: Crear el archivo `.env`

```bash
# Crear .env con los valores correctos
cat > .env << 'EOF'
PORT=3010
MONGO_DB_URI=mongodb://localhost:27017/consultorio-odontologa
MONGO_DB_NAME=consultorio-odontologa
API_URL=https://od-melinavillalba.micitamedica.me/api
CHATBOT_API_KEY=GENERAR-API-KEY-ODONTOLOGA
ADMIN_NUMBER=<número-admin>
EOF
```

### Paso 3: Modificar `src/app.ts` — Línea 46 (API_URL hardcodeada)

```typescript
// CAMBIAR ESTO (línea ~46):
const API_URL = 'https://micitamedica.me/api';

// POR ESTO:
const API_URL = process.env.API_URL || 'https://od-melinavillalba.micitamedica.me/api';
```

### Paso 4: Modificar `src/app.ts` — Puerto Express (línea ~59)

```typescript
// CAMBIAR:
const expressPort = 3009;

// POR:
const expressPort = 3011;
```

### Paso 5: Modificar `src/app.ts` — Mensaje de bienvenida (línea ~1200, 1209, 1286)

Buscar y reemplazar todas las ocurrencias de `"Dr.Kulinka"` y `"Dr. Kulinka"`:

```bash
# Buscar ocurrencias:
grep -n "Kulinka\|kulinka\|Dr\." src/app.ts

# Reemplazar manualmente en el editor cada ocurrencia
```

### Paso 6: Modificar obras sociales en `src/app.ts`

El flujo `bookSobreturnoFlow` y el flujo principal tienen la lista de obras sociales hardcodeada. Buscar todas las ocurrencias con:

```bash
grep -n "INSSSEP\|Swiss Medical\|socialWorks" src/app.ts
```

Cada bloque de obras sociales se ve así y debe simplificarse a solo CONSULTA PARTICULAR:

```typescript
// ANTES (múltiples bloques iguales en app.ts):
const socialWorks = {
    '1': 'INSSSEP',
    '2': 'Swiss Medical',
    '3': 'OSDE',
    '4': 'Galeno',
    '5': 'CONSULTA PARTICULAR',
    '6': 'Otras Obras Sociales'
};

// DESPUÉS:
const socialWorks = {
    '1': 'CONSULTA PARTICULAR'
};
```

Y los mensajes de opción:
```typescript
// ANTES (múltiples en app.ts):
'1️⃣ INSSSEP\n2️⃣ Swiss Medical\n3️⃣ OSDE\n4️⃣ Galeno\n5️⃣ CONSULTA PARTICULAR\n6️⃣ Otras Obras Sociales\n\n_Responde con el número correspondiente (1, 2, 3, 4, 5 o 6)_'

// DESPUÉS:
'1️⃣ CONSULTA PARTICULAR\n\n_Responde con 1_'
```

### Paso 7: Modificar `src/config/app.ts`

```typescript
export const APP_CONFIG = {
    API_URL: process.env.API_URL || 'https://od-melinavillalba.micitamedica.me/api',
    PORT: process.env.PORT || 3010,

    MONGO_DB_URI: process.env.MONGO_DB_URI || 'mongodb://localhost:27017/consultorio-odontologa',
    MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'consultorio-odontologa',

    BUSINESS_HOURS: {
        start: 8,
        end: 18,
        breakStart: 13,
        breakEnd: 14,
    },

    // ✅ Od. Villalba trabaja SOLO de manera particular
    SOCIAL_WORKS: {
        '1': 'CONSULTA PARTICULAR'
    },

    MESSAGES: {
        WELCOME: '🦷 *Bienvenido al Consultorio de la Od. Melina Villalba* 🦷',
        UNAVAILABLE: '❌ Lo siento, no hay horarios disponibles para el día solicitado.',
        ERROR: '❌ Ha ocurrido un error. Por favor, intenta nuevamente más tarde.',
        SUCCESS: '✅ Tu consulta ha sido agendada exitosamente.',
        INSTRUCTIONS: [
            '📋 *Instrucciones importantes:*',
            '- Llegue 15 minutos antes de su consulta',
            '- Traiga su documento de identidad',
        ].join('\n')
    },

    TIMEZONE: 'America/Argentina/Buenos_Aires',
    ADMIN_NUMBER: process.env.ADMIN_NUMBER || ''
};
```

### Paso 8: Modificar URLs de booking en `src/app.ts`

Buscar y reemplazar todas las URLs hardcodeadas de `micitamedica.me`:

```bash
grep -n "micitamedica.me" src/app.ts
```

Cambiar:
- `https://micitamedica.me/seleccionar-sobreturno` → `https://od-melinavillalba.micitamedica.me/seleccionar-sobreturno`
- `https://micitamedica.me/agendar-turno` → `https://od-melinavillalba.micitamedica.me/agendar-turno`
- `https://micitamedica.me/reservar-turno?token=...` → `https://od-melinavillalba.micitamedica.me/reservar?token=...`

**Mejor práctica:** usar una variable de entorno para la URL base del frontend:
```typescript
const CLINIC_BASE_URL = process.env.CLINIC_BASE_URL || 'https://od-melinavillalba.micitamedica.me';
// Luego usar: `${CLINIC_BASE_URL}/reservar?token=${token}`
```

### Paso 9: Modificar teléfono de contacto en `src/app.ts`

```bash
grep -n "3735604949" src/app.ts
# Reemplazar todas las ocurrencias con el teléfono de Od. Villalba
```

### Paso 10: Instalar dependencias y compilar

```bash
cd /var/www/ANITACHATBOT-odontologa
npm install
npm run build
# Verificar que no hay errores TypeScript
npx tsc --noEmit
```

---

## 8. Configuración MongoDB (Clinic)

### 8A — Configurar datos del chatbot

```javascript
db.clinics.updateOne(
  { slug: 'od-melinavillalba' },
  {
    $set: {
      // Webhook donde el backend notifica al chatbot cuando se completa una reserva
      'chatbot.webhookUrl': 'http://localhost:3011/api/notify-appointment',
      // API Key del chatbot — misma que CHATBOT_API_KEY en .env
      'chatbot.apiKey': 'GENERAR-API-KEY-ODONTOLOGA',
      'chatbot.active': true
    }
  }
);
```

### 8B — Configurar obras sociales y duración de turnos

```javascript
// ✅ CONFIRMADO: trabaja solo de manera particular
db.clinics.updateOne(
  { slug: 'od-melinavillalba' },
  {
    $set: {
      'socialWorks': ['CONSULTA PARTICULAR'],
      'settings.appointmentDuration': 30,          // turnos de 30 minutos
      'settings.appointmentLabel': 'Consulta odontológica'
    }
  }
);
```

### 8C — Configurar Google Calendar

```javascript
db.clinics.updateOne(
  { slug: 'od-melinavillalba' },
  {
    $set: {
      'googleCalendar.calendarId': 'EMAIL-CALENDARIO@gmail.com',
      'googleCalendar.credentialsPath': '/var/www/od-melinavillalba/credentials.json',
      'googleCalendar.connected': true
    }
  }
);
```

---

## 9. Configuración PM2

```bash
# En el VPS, desde el directorio del clon:
cd /var/www/ANITACHATBOT-odontologa

# Iniciar con un nombre diferente al del Dr. Kulinka
pm2 start dist/app.js --name "chatbot-odontologa"
pm2 save

# Verificar que ambos corren:
pm2 list
# Esperado:
# anita-bot          → proceso Dr. Kulinka   → online
# chatbot-odontologa → proceso Od. Villalba   → online
```

### `pm2:restart` para la odontóloga

Agregar al `package.json` del clon:
```json
"pm2:start": "pm2 start dist/app.js --name chatbot-odontologa",
"pm2:stop": "pm2 stop chatbot-odontologa",
"pm2:restart": "pm2 restart chatbot-odontologa",
"pm2:logs": "pm2 logs chatbot-odontologa"
```

---

## 10. Verificación final

```bash
# 1. Verificar que el Express responde
curl http://localhost:3011/health

# 2. Verificar que el backend reconoce la clínica
curl https://od-melinavillalba.micitamedica.me/api/clinic/config
# Esperado: { "data": { "name": "Od. Melina Villalba", "socialWorks": ["CONSULTA PARTICULAR"] } }

# 3. Verificar que el chatbot puede generar un token público
curl -X POST https://od-melinavillalba.micitamedica.me/api/tokens/generate-public-token \
  -H "X-API-Key: GENERAR-API-KEY-ODONTOLOGA"
# Esperado: { "data": { "token": "eyJ..." } }

# 4. Crear turno de prueba
curl -X POST https://od-melinavillalba.micitamedica.me/api/appointments \
  -H "X-API-Key: GENERAR-API-KEY-ODONTOLOGA" \
  -H "Content-Type: application/json" \
  -d '{"clientName":"Test Paciente","phone":"3735000000","date":"2026-03-20","time":"09:00","socialWork":"CONSULTA PARTICULAR"}'

# 5. Verificar que el turno aparece en el dashboard de la odontóloga
# Ir a: https://od-melinavillalba.micitamedica.me

# 6. Verificar que el turno NO aparece en el dashboard del Dr. Kulinka
# Ir a: https://micitamedica.me

# 7. Probar webhook entrante (que el chatbot recibe notificaciones)
curl -X POST http://localhost:3011/api/notify-appointment \
  -H "Content-Type: application/json" \
  -d '{"appointment":{"clientName":"Test","phone":"3735000000","date":"2026-03-20","time":"09:00","socialWork":"CONSULTA PARTICULAR"}}'
```

### Checklist de verificación

#### Infraestructura
- [ ] DNS `od-melinavillalba.micitamedica.me` apunta al VPS
- [ ] SSL / Let's Encrypt instalado
- [ ] Nginx configurado para el subdominio

#### Base de datos
- [ ] Clinic `od-melinavillalba` creada en MongoDB
- [ ] `socialWorks: ['CONSULTA PARTICULAR']`
- [ ] `settings.appointmentDuration: 30`
- [ ] Admin user creado y contraseña entregada a la odontóloga

#### Google Calendar
- [ ] Service Account creada
- [ ] `credentials.json` subido al VPS
- [ ] Calendario compartido con la Service Account
- [ ] `calendarId` actualizado en DB

#### Chatbot
- [ ] Repositorio clonado en `/var/www/ANITACHATBOT-odontologa`
- [ ] `.env` configurado correctamente
- [ ] `API_URL` apunta a `od-melinavillalba.micitamedica.me/api`
- [ ] Textos de `"Dr. Kulinka"` reemplazados por `"Od. Melina Villalba"`
- [ ] Obras sociales simplificadas a solo `CONSULTA PARTICULAR`
- [ ] Teléfono de contacto actualizado
- [ ] URLs de booking apuntan al subdominio correcto
- [ ] `npm run build` pasa sin errores
- [ ] PM2 corriendo como `chatbot-odontologa` en puerto 3010
- [ ] `Clinic.chatbot.webhookUrl` = `http://localhost:3011/api/notify-appointment`
- [ ] `Clinic.chatbot.apiKey` coincide con `CHATBOT_API_KEY` del `.env`
- [ ] QR escaneado y WhatsApp conectado

#### Verificación end-to-end
- [ ] Enviar "hola" al número de la odontóloga → responde correctamente
- [ ] El mensaje de bienvenida dice "Od. Melina Villalba"
- [ ] Solo aparece la opción "CONSULTA PARTICULAR"
- [ ] Se puede reservar un turno completo y aparece en el dashboard
- [ ] El webhook recibe notificación cuando se reserva desde la web

---

## 11. Diferencias Od. Villalba vs Dr. Kulinka

| Aspecto | Dr. Kulinka | Od. Melina Villalba |
|---------|------------|---------------------|
| Tipo de profesional | Médico | Odontóloga |
| Obras sociales | INSSSEP, Swiss Medical, OSDE, Galeno, Consulta Particular, Otras | Solo CONSULTA PARTICULAR |
| Duración turnos | 15 minutos | 30 minutos |
| API URL | `https://micitamedica.me/api` | `https://od-melinavillalba.micitamedica.me/api` |
| Puerto bot | 3008 | 3010 |
| Puerto Express | 3009 | 3011 |
| PM2 name | `anita-bot` | `chatbot-odontologa` |
| Webhook URL | `http://localhost:3009/api/notify-appointment` | `http://localhost:3011/api/notify-appointment` |
| Mensaje bienvenida | `"Dr.Kulinka"` | `"Od. Melina Villalba"` |
| Tipo cita | `"Cita médica"` | `"Consulta odontológica"` |
| Horarios sobreturnos | Mañana: 11:00-12:00 / Tarde: 19:00-20:00 | **Confirmar con la odontóloga** |

---

## Notas adicionales

### Sobre el flujo de reserva completo (integración backend)

El chatbot para la odontóloga sigue el mismo flujo de integración con el backend:

```
1. Paciente escribe al chatbot por WhatsApp

2. Chatbot consulta horarios disponibles:
   GET https://od-melinavillalba.micitamedica.me/api/appointments/available/{fecha}
   Headers: { X-API-Key: CHATBOT_API_KEY }

3. Chatbot genera token temporal:
   POST https://od-melinavillalba.micitamedica.me/api/tokens/generate-public-token
   Headers: { X-API-Key: CHATBOT_API_KEY }
   → Devuelve: { token: "eyJ...", expiresIn: "7h" }

4. Chatbot envía link al paciente:
   https://od-melinavillalba.micitamedica.me/reservar?token={token}

5. Paciente llena el formulario en la web

6. Backend llama webhook del chatbot:
   POST http://localhost:3011/api/notify-appointment
   Body: { appointment: { clientName, phone, date, time, socialWork } }

7. Chatbot envía confirmación por WhatsApp
```

### Sobre la autenticación con el backend

**IMPORTANTE:** El chatbot debe enviar `X-API-Key` en **TODAS** las llamadas al backend.

En el `src/config/axios.ts` ya está configurado globalmente:
```typescript
headers: {
    'X-API-Key': process.env.CHATBOT_API_KEY || '',
}
```

Pero en `src/app.ts` hay llamadas con `fetch()` nativo donde el header se agrega manualmente. Verificar que todas incluyan el header.

### Sobre los sobreturnos

Los horarios de sobreturnos están hardcodeados en `src/app.ts`:
- **Mañana (1-5):** 11:00, 11:15, 11:30, 11:45, 12:00
- **Tarde (6-10):** 19:00, 19:15, 19:30, 19:45, 20:00

**Para la odontóloga:** confirmar si los horarios de sobreturnos son los mismos o necesitan ajustarse. Están en las líneas ~692-714 de `src/app.ts`.

### Sobre el número de WhatsApp

El número de WhatsApp se configura al escanear el QR. No está en el `.env`. El chatbot usa el número del teléfono/cuenta de WhatsApp que escanea el QR por primera vez.

✅ **Número confirmado:** `+543735583770`

---

## Estimación de tiempo de onboarding

| Tarea | Tiempo estimado |
|-------|----------------|
| DNS + SSL | 30 min (DNS puede tardar hasta 24h) |
| Nginx config subdominio | 15 min |
| Scripts DB (crear Clinic) | 20 min |
| Google Calendar setup | 30 min |
| Clonar chatbot + cambios de código | 60 min |
| Build y verificación | 20 min |
| QR scan y testing end-to-end | 30 min |
| **Total** | **~3.5 horas** |
