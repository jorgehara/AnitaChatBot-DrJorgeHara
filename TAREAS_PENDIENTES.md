# 📋 TAREAS PENDIENTES — AnitaChatBot Odontología

> **INSTRUCCIÓN PARA CLAUDE**: Este archivo SIEMPRE debe ser leído al inicio de cada sesión antes de responder al usuario.

---

## 🔴 EN PROGRESO

_Nada en progreso actualmente._

---

## 🟡 PENDIENTE (próximas actualizaciones)

- [ ] **CitaMedicaBeta frontend — badge tipo de consulta**: En la tarjeta de consultas del dashboard, agregar un subtítulo/badge que muestre "Primera visita", "Control" o "Emergencia" según el tipo de turno. El campo `description` del appointment ya contiene el tipo enviado por ANITA. Proyecto: `C:\Users\JorgeHaraDevs\Desktop\CitaMedicaBeta`
- [ ] **Flujo de cancelación de turno**: paciente escribe "cancelar mi turno" → ANITA busca el evento en Google Calendar por número de teléfono y lo elimina → slot queda libre para nuevas reservas. CitaMedicaBeta se actualiza manualmente desde el dashboard. (Por ahora la cancelación se gestiona manualmente desde Google Calendar o CitaMedicaBeta.)
- [ ] **Instalar gentle-ia**: Integrar `gentle-ia` (https://github.com/Gentleman-Programming/gentle-ai)
- [ ] **Flujo de IA conversacional**: respuestas libres del consultorio (precio, obras sociales, dudas generales)
- [ ] **Sobreturnos automáticos**: flujo de emergencias con reserva sin intervención manual
- [ ] **Sacar console.logs de debug** en versión final (producción limpia)

---

## ✅ COMPLETADO

- [x] Setup inicial del proyecto BuilderBot
- [x] PRD del flujo de atención al paciente (`PRD-FLUJO-ATENCION.md`)
- [x] `src/utils/calendarService.ts` — Google Calendar (freeBusy + createEvent), Lun–Jue 15–20hs BsAs
- [x] `src/utils/haikuService.ts` — Claude Haiku para filtrar slots por preferencia de texto libre
- [x] `src/utils/citaMedicaService.ts` — sincronización de citas con CitaMedicaBeta vía `POST /api/appointments`
- [x] `mainMenu.flow.ts` — menú de bienvenida (3 opciones: nuevo paciente / control / urgencia)
- [x] `newPatient.flow.ts` — flujo paciente nuevo ATM/Bruxismo (60 min)
- [x] `control.flow.ts` — flujo control/seguimiento (30 o 60 min según tipo)
- [x] Flows registrados en `src/app.ts`
- [x] Variables de entorno: `ANTHROPIC_API_KEY`, `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_PATH`, `EMERGENCY_PHONE_NUMBER`
- [x] Console.logs de debug en todos los servicios y flows
- [x] Fix credenciales Google: configurable via `GOOGLE_SERVICE_ACCOUNT_JSON` o `GOOGLE_SERVICE_ACCOUNT_PATH`

---

## 📝 ARQUITECTURA — RESUMEN CRÍTICO

### Chatbot ANITA (este repo)
- **Framework**: BuilderBot + Baileys (WhatsApp Web API)
- **Disponibilidad**: Lee Google Calendar vía `freeBusy` — todo el mes, Lun–Jue 15:00–20:00 BsAs
- **Reserva**: Crea evento en Google Calendar + registra en CitaMedicaBeta MongoDB vía API
- **NLP**: Claude Haiku `claude-haiku-4-5-20251001` filtra slots según preferencia de texto libre
- **Credenciales Google**: archivo `google.json.txt` (en server, no en git por `.gitignore *.txt`)

### CitaMedicaBeta (C:\Users\JorgeHaraDevs\Desktop\CitaMedicaBeta)
- **Multi-tenant**: Dr. Kulinka (`micitamedica.me`) + Od. Villalba (`od-melinavillalba.micitamedica.me`)
- **Tenant isolation**: subdomain → `req.clinicId` en todos los queries
- **API para chatbot**: `POST /api/appointments` con header `X-API-Key: CHATBOT_API_KEY`
- **Dashboard**: lee MongoDB, NO Google Calendar → por eso hay que escribir en ambos
- **Sincronización**: CitaMedicaBeta → Google Calendar (unidireccional). Reverse sync no existe.
- **Regla de negocio**: modificaciones/cancelaciones SIEMPRE desde dashboard CitaMedicaBeta, nunca directo en Google Calendar

### Flujo de sincronización
```
ANITA reserva turno
  ├── 1. createCalendarEvent() → Google Calendar (fuente de verdad para disponibilidad)
  └── 2. createCitaMedicaAppointment() → POST CitaMedicaBeta API → MongoDB (fuente de verdad para dashboard)

Doctora cancela/modifica turno
  └── Desde CitaMedicaBeta dashboard (sincroniza a Google Calendar automáticamente)
```

### Variables de entorno clave (AnitaChatBot .env)
```
API_URL=https://od-melinavillalba.micitamedica.me/api
CHATBOT_API_KEY=04a5d1ae7c4b9b843084daf954ab1db5456f358b5da502d70cb5f05d44913f64
ANTHROPIC_API_KEY=sk-ant-api03-...
GOOGLE_CALENDAR_ID=27c0d11107877...@group.calendar.google.com
GOOGLE_SERVICE_ACCOUNT_PATH=./google.json.txt
EMERGENCY_PHONE_NUMBER=+5493794051686
```

---

## 📝 NOTAS DE CONTEXTO

- **Cliente**: Odontóloga Melina Villalba
- **Bot**: ANITA — chatbot de WhatsApp para gestión de citas
- **Proyecto en producción** — cambios quirúrgicos y cuidadosos
- **Última sesión**: 2026-03-21
