# Guía de Agentes — AnitaChatBot-DrJorgeHara

## Visión General del Proyecto

**AnitaChatBot-DrJorgeHara** es el chatbot de WhatsApp del Dr. Jorge Hara (médico clínico).
Gestiona reservas de turnos y sobreturnos conectándose al backend de **CitaMedicaBeta en producción**.

- **Framework**: BuilderBot 1.3.14 + Baileys (WhatsApp Web API)
- **Runtime**: Node.js + TypeScript (ESM)
- **DB**: MongoDB (BuilderBot MongoAdapter — sesiones)
- **AI**: Claude Haiku (extracción de intención — `@anthropic-ai/sdk`)
- **Calendar**: Google Calendar (lectura de slots — `googleapis`) — OPCIONAL
- **Backend**: `https://micitamedica.me/api` (CitaMedicaBeta en producción)
- **PM2**: `chatbot-drjorgehara`
- **Puerto bot**: 3008 | **Puerto Express (health)**: 3009

## Diagrama del Sistema

```
Usuario WhatsApp
      │
      ▼
AnitaChatBot-DrJorgeHara (puerto 3008)
  ├─ appointmentFlow     → turno normal
  ├─ sobreturnoFlow      → sobreturno urgente
  ├─ publicBookingLinkFlow → link web con token
  ├─ mainMenuFlow        → catch-all (EVENTS.WELCOME)
  ├─ goodbyeFlow         → despedida
  └─ adminFlow           → comandos admin
      │
      ▼ HTTP (X-API-Key + X-Tenant-Subdomain)
CitaMedicaBeta API (https://micitamedica.me/api)
  ├─ POST /appointments
  ├─ POST /sobreturnos
  ├─ GET  /appointments/available/:date
  ├─ GET  /sobreturnos/date/:date
  ├─ GET  /sobreturnos/validate
  ├─ GET  /sobreturnos/status/:date
  └─ POST /tokens/generate-public-token
```

## Estructura del Proyecto

```
AnitaChatBot-DrJorgeHara/
├── src/
│   ├── app.ts                          # Entry point + registro de todos los flows
│   ├── config/
│   │   ├── app.ts                      # APP_CONFIG (PORT, API_URL, TIMEZONE, etc.)
│   │   └── axios.ts                    # axiosInstance con retry (30s/3 reintentos)
│   ├── flows/
│   │   ├── mainMenu.flow.ts            # EVENTS.WELCOME — catch-all + menú
│   │   ├── appointment.flow.ts         # Reserva turno normal (dual mode: Calendar o API)
│   │   ├── sobreturno.flow.ts          # Reserva sobreturno completo (self-contained)
│   │   ├── publicBookingLink.flow.ts   # Genera token y link de reserva web
│   │   ├── goodbye.flow.ts             # Despedida
│   │   └── admin.flow.ts               # Comandos admin (!status, !disconnect)
│   ├── utils/
│   │   ├── appointmentService.ts       # Singleton — citas normales (CitaMedica API)
│   │   ├── sobreturnoService.ts        # Singleton — sobreturnos (CitaMedica API)
│   │   ├── calendarService.ts          # Google Calendar (getTodayAndTomorrowSlots, etc.)
│   │   ├── citaMedicaService.ts        # createCitaMedicaAppointment() — POST /appointments
│   │   ├── intentExtractor.ts          # Claude Haiku (extractUserIntent, extractDateIntent)
│   │   ├── dateFormatter.ts            # formatearFechaEspanol(), getNextWorkingDay()
│   │   ├── cache.ts                    # Cache en memoria con TTL (5 min)
│   │   └── fallbackData.ts             # Slots de respaldo cuando API no responde
│   └── types/
│       ├── api.ts                      # APIResponse, AppointmentData, ConversationState
│       └── calendarTypes.ts            # AvailableSlot, PatientEventData
├── .env.example                        # TODAS las variables documentadas
├── AGENTS.md                           # Este archivo
├── Dockerfile
├── nodemon.json
├── package.json
└── tsconfig.json
```

## Flows Activos (registrados en app.ts en este orden)

| Flow | Keywords/Trigger | Descripción |
|------|-----------------|-------------|
| `adminFlow` | `!admin`, `!help`, `!status` | Solo para ADMIN_NUMBER |
| `sobreturnoFlow` | `sobreturno`, `sobreturnos`, `urgencia` | Reserva sobreturno con confirmación |
| `publicBookingLinkFlow` | `bazinga`, `link`, `enlace`, `reservar` | Genera token + link web |
| `goodbyeFlow` | `bye`, `adiós`, `chau` | Despedida |
| `appointmentFlow` | `hola`, `turno`, `cita`, `doctor` | Reserva turno normal (dual mode) |
| `mainMenuFlow` | `EVENTS.WELCOME` (catch-all) | Menú principal |

## Modos de Operación de `appointmentFlow`

### Modo A: Google Calendar (si `GOOGLE_CALENDAR_ID` está configurado)
- Lee slots disponibles del calendario del Dr. Hara vía Google Calendar API
- Muestra slots agrupados por día con número de opción
- Permite buscar por fecha personalizada (Claude Haiku extrae fecha)
- Crea la cita en CitaMedica vía `createCitaMedicaAppointment()`

### Modo B: CitaMedica API Directa (si no hay Google Calendar)
- Consulta `GET /appointments/available/:date`
- Si no hay turnos normales → ofrece sobreturnos automáticamente
- Crea cita vía `appointmentService.createAppointment()`

## Variables de Estado (state en BuilderBot)

```typescript
{
    clientName: string,           // Nombre del paciente
    socialWork: string,           // Obra social seleccionada
    appointmentDate: string,      // 'yyyy-MM-dd'
    availableSlots: TimeSlot[],   // Turnos normales (modo API directa)
    availableSobreturnos: any[],  // Sobreturnos disponibles
    isSobreturnoMode: boolean,    // Flag modo sobreturno
    selectedSlot: TimeSlot,       // Turno normal seleccionado
    selectedSobreturno: any,      // Sobreturno seleccionado
    disponiblesManiana: any[],    // Sobreturnos mañana
    disponiblesTarde: any[],      // Sobreturnos tarde
    slotsCache: AvailableSlot[],  // Slots Calendar en caché
    otherDateOption: string,      // Número de la opción "Buscar otra fecha"
    customDateMode: boolean,       // Modo búsqueda por fecha personalizada
    useCalendarMode: boolean,      // Flag modo Google Calendar
    sobreturnoConfirmado: boolean, // Confirmó advertencia de uso
    _menuBlocked: boolean,         // Guard: no interrumpir flujo activo
}
```

## Endpoints Utilizados

| Endpoint | Uso |
|----------|-----|
| `GET /appointments/available/:date` | Slots disponibles (modo API directa) |
| `POST /appointments` | Crear turno normal |
| `GET /sobreturnos/date/:date` | Sobreturnos disponibles |
| `GET /sobreturnos/status/:date` | Estado completo (todosLosSlots) |
| `GET /sobreturnos/validate?date&sobreturnoNumber` | Validar disponibilidad en tiempo real |
| `POST /sobreturnos` | Crear sobreturno |
| `POST /sobreturnos/cache/clear` | Limpiar caché del backend |
| `POST /tokens/generate-public-token` | Token público 7h para web |
| `GET /health` | Check de conectividad |

## Autenticación

- Header: `X-API-Key: <CHATBOT_API_KEY>` — configurado globalmente en `axiosInstance`
- Header: `X-Tenant-Subdomain: <TENANT_SUBDOMAIN>` — identifica la clínica en multi-tenant
- Ambos headers en TODOS los requests al backend

## Obras Sociales (enum compartido con el backend)

```
'1': 'INSSSEP' | '2': 'Swiss Medical' | '3': 'OSDE'
'4': 'Galeno'  | '5': 'CONSULTA PARTICULAR' | '6': 'Otras Obras Sociales'
```

## ⚠️ BuilderBot Gotchas CRÍTICOS

### 1. Flow Terminal Bug — El más peligroso
El último `addAnswer` con `capture: true` DEBE ser **self-contained**: crear, confirmar y
limpiar state INLINE. Si solo actualiza state y termina → **bot queda MUDO sin errores en logs**.
→ Ver `sobreturno.flow.ts` y `appointment.flow.ts` — el último capture hace todo inline.

### 2. gotoFlow() + capture
`addAnswer` con `capture: true` NO recibe mensajes si viene inmediatamente después de `gotoFlow()`.
Solución: capturar todos los datos ANTES de hacer gotoFlow().

### 3. Guard de flujo activo
Si dos flows tienen keywords similares, ambos se disparan. Siempre poner guard al inicio:
```typescript
const clientName = await state.get('clientName');
if (clientName) return; // flujo activo, no interrumpir
```

### 4. State como único canal entre flows
Si state se limpia en el medio de una cadena → datos vacíos en la cita.
Variables críticas: `clientName`, `socialWork`, `appointmentDate`, `slotsCache`.

### 5. EVENTS.WELCOME (mainMenuFlow)
`EVENTS.WELCOME` se activa SOLO cuando BuilderBot no encuentra capture activo ni keyword match.
Es el catch-all correcto. NUNCA interrumpe flows en curso si el guard está bien configurado.

## Convenciones de Código

- **camelCase**: variables y funciones
- **PascalCase**: interfaces y tipos
- **ALL_CAPS**: constantes globales
- **Logs**: `[FLOW_NAME]`, `[SERVICE_NAME]`, `[ERROR]`
- **Dates para API**: `'yyyy-MM-dd'`
- **Timezone**: siempre `'America/Argentina/Buenos_Aires'`
- **Async**: `try/catch` en TODAS las operaciones asíncronas

## Comandos de Desarrollo

```bash
# Instalar dependencias
npm install

# Desarrollo con hot reload
npm run dev

# Type check (sin compilar)
npx tsc --noEmit

# Compilar
npm run build

# Iniciar en producción
npm run start

# PM2
npm run pm2:start
npm run pm2:restart
npm run pm2:logs
npm run pm2:status
```

## Variables de Entorno Requeridas

```env
API_URL=https://micitamedica.me/api     # OBLIGATORIO
CHATBOT_API_KEY=                         # OBLIGATORIO — debe coincidir con backend
TENANT_SUBDOMAIN=dr-jorgehara            # OBLIGATORIO — identificador de clínica
MONGODB_URI=mongodb://localhost:27017/...# OBLIGATORIO
ANTHROPIC_API_KEY=                       # OBLIGATORIO — Claude Haiku
GOOGLE_CALENDAR_ID=                      # OPCIONAL — si no se configura, usa API directa
ADMIN_NUMBER=                            # OPCIONAL
EMERGENCY_PHONE_NUMBER=3794051686        # OPCIONAL
```

## Archivos de Referencia Clave

1. `src/app.ts` — Entry point, registro de flows, orden importa
2. `src/flows/sobreturno.flow.ts` — Flow con self-contained terminal (gotcha aplicado)
3. `src/flows/appointment.flow.ts` — Dual mode (Calendar vs API directa)
4. `src/flows/mainMenu.flow.ts` — EVENTS.WELCOME + guard de flujo activo
5. `src/config/axios.ts` — Retry config con X-API-Key y X-Tenant-Subdomain
6. `src/utils/intentExtractor.ts` — Claude Haiku para NLP
7. `src/utils/calendarService.ts` — Google Calendar (opcional)

**Última actualización**: 2026-04-12
