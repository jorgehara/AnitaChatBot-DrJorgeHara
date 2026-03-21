# 📋 TAREAS PENDIENTES — AnitaChatBot Odontología

> **INSTRUCCIÓN PARA CLAUDE**: Este archivo SIEMPRE debe ser leído al inicio de cada sesión antes de responder al usuario.

---

## 🔴 EN PROGRESO

- [ ] **Validar PRD con cliente** — ver `PRD-FLUJO-ATENCION.md`, hay 6 preguntas abiertas para confirmar con Od. Villalba

---

## 🟡 PENDIENTE (Fase 1 — flujo estructurado + Haiku + Calendar)

- [ ] **Validar número de emergencia** con Od. Villalba (para derivar casos de dolor)
- [ ] **Crear `src/utils/haikuService.ts`** — cliente Claude Haiku API para interpretar disponibilidad en texto libre
- [ ] **Crear `src/utils/calendarService.ts`** — integración Google Calendar (disponibilidad todo el mes)
- [ ] **Implementar `mainMenu.flow.ts`** — menú de bienvenida (primer contacto)
- [ ] **Implementar `newPatient.flow.ts`** — flujo paciente nuevo ATM/Bruxismo (1 hora)
- [ ] **Implementar `control.flow.ts`** — flujo control/seguimiento (30 min)
- [ ] **Registrar nuevos flows en `src/app.ts`**
- [ ] **Agregar vars de entorno**: `ANTHROPIC_API_KEY`, `GOOGLE_CALENDAR_ID`, `EMERGENCY_PHONE_NUMBER`

## 🟡 PENDIENTE (Fase 2 — emergencias automáticas)

- [ ] **Sobreturnos automáticos**: flujo de emergencias con reserva sin intervención manual

## 🟡 PENDIENTE (Fase 3 — IA conversacional)

- [ ] **Instalar gentle-ia**: Integrar `gentle-ia` (https://github.com/Gentleman-Programming/gentle-ai)
- [ ] **Flujo de IA**: respuestas libres del consultorio (precio, obras sociales, dudas generales)

---

## ✅ COMPLETADO

- [x] Setup inicial del proyecto BuilderBot
- [x] `sobreturnoFlow.ts` — flujo de sobreturnos completo
- [x] `availableSlotsFlow` — consulta de horarios (sin reserva aún)
- [x] Integración con CitaMedicaBeta API
- [x] Scripts de deploy con PM2

---

## 📝 NOTAS DE CONTEXTO

- **Cliente**: Odontóloga Melina Villalba
- **Bot**: ANITA — chatbot de WhatsApp para gestión de citas
- **Proyecto en producción** — cambios quirúrgicos y cuidadosos
- **Última sesión**: 2026-03-20 — retomando desde PRD del flujo de atención
