# PRD — Flujo de Atención al Paciente
## Chatbot ANITA · Od. Melina Villalba

> **Versión**: 1.0
> **Fecha**: 2026-03-20
> **Estado**: BORRADOR — pendiente de validación con cliente
> **Autor**: Jorge Hara + Od. Melina Villalba

---

## 1. CONTEXTO Y ESPECIALIDAD

La Od. Melina Villalba se especializa **exclusivamente en ATM (Articulación Temporomandibular) y Bruxismo**. NO es una odontología general — es una especialidad específica. Esto define todo el flujo de atención.

Casos excepcionales: atiende obras sociales solo para **limpieza y restauración**, y únicamente a pacientes antiguos que ya la conocen.

---

## 2. REGLAS DE NEGOCIO (CRÍTICAS)

### 2.0 Horario de atención ⚠️ CRÍTICO

| | Detalle |
|---|---|
| **Días** | Lunes a Jueves |
| **Horario** | 15:00 a 20:00 hs (BsAs) |
| **No atiende** | Viernes, sábado y domingo |

El bot **solo muestra turnos** dentro de este rango. Cualquier slot fuera de este horario o en días no hábiles queda excluido automáticamente.

---

### 2.1 Duración de turnos según tipo de visita

| Tipo de cita | Duración | Descripción |
|---|---|---|
| **Primera consulta ATM/Bruxismo** | 60 min | Evaluación completa, anamnesis, revisión de estudios |
| **Confección de placa (plano oclusal)** | 60 min | Realización de la placa o plano de programador |
| **Toma de impresión** (2da visita) | 30 min | Solo la impresión para fabricar la placa |
| **Control de placa** | 30 min | Ajuste y estabilización |
| **Reparación de placa** | 60 min | Lleva tiempo, se reserva 1 hora |
| **Emergencia / dolor agudo** | Sobreturno | Prioridad máxima → derivar a flow sobreturno |

### 2.2 Clasificación de pacientes

```
NUEVO PACIENTE
└── ¿Es por ATM/Bruxismo?
    ├── SÍ → flujo nuevo paciente ATM (1 hora)
    └── NO → mensaje informativo (especialidad limitada)

PACIENTE DE CONTROL
└── Ya tiene placa → control 30 min

EMERGENCIA
└── Dolor agudo → sobreturno (flow existente)
```

### 2.3 Obras sociales
- La odontóloga **NO acepta obras sociales en general**
- Excepción: la excepciones se manejan con la Odontologa en persona.
- El chatbot NO debe ofrecer obras sociales como opción estándar

---

## 3. FLUJO DE CONVERSACIÓN — DETALLE

### PASO 0: Mensaje de bienvenida / primer contacto

El bot responde al mensaje inicial del paciente:

```
"Buenas 😁! Soy ANITA, la asistente virtual de la Od. Melina Villalba.

Para ayudarte mejor, contame: ¿cuál es el motivo de tu consulta?

1️⃣ Primera consulta (ATM / Bruxismo)
2️⃣ Control o seguimiento
3️⃣ Tengo dolor / emergencia"
```

---

### PASO 1A: PRIMER CONTACTO — Nueva consulta ATM/Bruxismo

**Trigger**: paciente selecciona opción 1 o escribe algo relacionado a primera vez, ATM, bruxismo, rechinar dientes, mandíbula, etc.

**Secuencia de preguntas** (en este orden):

**1. Nombre y apellido**
```
"Para empezar, ¿me decís tu nombre y apellido completo?"
```

**2. ¿Tenés estudios o radiografías previas?**
```
"¿Contás con radiografías o algún estudio previo relacionado a la mandíbula o ATM?"
→ Opciones: Sí / No / No sé
```

**3. ¿Usás algo para dormir o durante el día?**
```
"¿Actualmente usás alguna placa dental, protector bucal u otro dispositivo?"
→ Opciones: Sí / No
```

**4. Mostrar disponibilidad y pedir elección** ← CAMBIO CLAVE
> El bot NO pregunta "¿cuándo podés?". En cambio:
> 1. Consulta Google Calendar via `calendarService` → slots de 60 min disponibles en el mes
> 2. Claude Haiku organiza y propone los próximos turnos hábiles disponibles
> 3. El bot presenta las opciones y el paciente elige

```
"¡Perfecto! Estos son los próximos turnos disponibles para tu consulta:

📅 Próximos turnos disponibles:
  1️⃣ Martes 25/03 — 10:00 hs
  2️⃣ Martes 25/03 — 14:30 hs
  3️⃣ Jueves 27/03 — 09:00 hs
  4️⃣ Lunes 31/03 — 16:00 hs

¿Con cuál te quedás? Respondé el número 😊
(O si ninguno te viene bien, decime qué días y horarios preferís y busco más opciones)"
```

> ⚠️ **Regla**: mostrar siempre el próximo día hábil disponible primero.
> Si el paciente no queda conforme, recién ahí acepta preferencia libre ("martes a la tarde") y Haiku busca en el resto del mes.

**5. Confirmar el turno seleccionado**
```
"✅ Perfecto! Quedaste agendada/o para el [día] a las [hora].
La consulta dura aproximadamente 1 hora.
¡Te esperamos! 😊"
→ Crear evento en Google Calendar
```

---

### PASO 1B: CONTROL / SEGUIMIENTO

**Trigger**: paciente selecciona opción 2 o menciona "control", "seguimiento", "mi placa", "tengo turno"

**Secuencia:**

**1. Nombre y apellido**

**2. ¿Qué tipo de control?**
```
"¿Es un control de tu placa, o venís a retirar la placa nueva?"

1️⃣ Control de placa (ajuste/estabilización) → 30 min
2️⃣ Segunda visita / retiro de placa → 30 min
3️⃣ Reparación de placa → 60 min
```

**3. Mostrar disponibilidad según duración**
> Igual que paso 1A: Google Calendar → Haiku organiza → bot presenta opciones
> La duración varía según lo seleccionado (30 o 60 min)

```
"¡Listo! Estos son los próximos turnos disponibles:

📅 Próximos turnos:
  1️⃣ [día] — [hora]
  2️⃣ [día] — [hora]
  ...

¿Cuál te viene mejor?"
```

**4. Confirmar turno → crear evento en Google Calendar**

---

### PASO 1C: EMERGENCIA / DOLOR

**Trigger**: paciente selecciona opción 3, menciona "dolor", "me duele", "urgente", "no aguanto"

> ⚠️ **PENDIENTE — Fuera de scope fase 1**
> Los sobreturnos NO están implementados en este bot.
> Por ahora el bot envía un mensaje al número directo de la Dra. Villalba para que ella maneje el caso manualmente.

**Acción actual:**
```
"Entiendo que estás con dolor 😟. Para casos de urgencia, por favor comunicate directamente con la Dra. Villalba al [NÚMERO A DEFINIR] para que pueda atenderte lo antes posible."
```

**Número de contacto de emergencia**: ⚠️ *PENDIENTE — definir con cliente*

---

## 4. DATOS QUE EL BOT DEBE RECOPILAR

### Para PRIMERA CONSULTA (mínimo requerido):
- [ ] Nombre y apellido
- [ ] ¿Tiene estudios/radiografías previas? (Sí/No/No sé)
- [ ] ¿Usa dispositivo para dormir? (Sí/No)
- [ ] Días y horarios disponibles (texto libre)
- [ ] Turno seleccionado

### Para CONTROL:
- [ ] Nombre y apellido
- [ ] Tipo de control (placa ajuste / retiro placa)
- [ ] Turno seleccionado

### Para EMERGENCIA:
- [ ] Nombre y apellido
- [ ] Mensaje de derivación al número directo de la Dra.
*(sin sobreturno automático — manejo manual por ahora)*

---

## 5. MANEJO DE CASOS ESPECIALES

### 5.1 Paciente con dolor que pide turno común
Si en cualquier punto del flujo el paciente menciona que tiene dolor, el bot interrumpe y deriva al número de contacto:
```
"¿Estás sintiendo dolor actualmente? Para casos de urgencia, comunicate directamente con la Dra. Villalba al [NÚMERO] para que pueda atenderte cuanto antes."
```
*(No sobreturno automático — pendiente fase 2)*

### 5.2 Paciente que pregunta por precio
La odontóloga menciona el precio de consulta particular. El bot debe responder:
```
"El valor de la consulta particular te lo confirma directamente la Dra. Villalba al momento de confirmar el turno.
Si querés más información, podés escribirle al [número/contacto]."
```
*(NO hardcodear precio — puede variar)*

### 5.3 Paciente que pregunta por obras sociales
```
"La Od. Villalba se especializa en ATM y Bruxismo y trabaja principalmente por consulta particular.
Para más información sobre tu caso específico, podés consultarle directamente."
```

### 5.4 Paciente que no especifica bien sus días disponibles
Si el paciente escribe algo vago como "cuando pueda" o "cualquier día":
```
"¡Perfecto! Te muestro todos los turnos disponibles para que elijas el que mejor te quede 😊"
→ mostrar slots disponibles directamente
```

---

## 6. ARQUITECTURA DE IMPLEMENTACIÓN

### 6.1 DIFERENCIA CLAVE vs. Bot Dr. Kulinka

| Aspecto | Dr. Kulinka | Od. Villalba (este bot) |
|---|---|---|
| **Búsqueda de turnos** | Día a día (consulta el día siguiente) | Todo el mes disponible |
| **Motor de procesamiento** | Lógica hardcodeada | **Claude Haiku API** procesa el mensaje |
| **Fuente de disponibilidad** | CitaMedicaBeta API | **Google Calendar** directamente |
| **Interpretación del paciente** | Opciones numéricas rígidas | Haiku entiende texto libre ("martes a la tarde") |

### 6.2 Flujo de datos (arquitectura central)

```
Paciente completa datos (nombre, estudios, dispositivo)
        ↓
calendarService consulta Google Calendar — todo el mes
  - Filtra slots libres por duración (30 o 60 min según tipo de cita)
        ↓
Claude Haiku API organiza y propone
  - Ordena por proximidad (próximo día hábil primero)
  - Genera lista legible en español natural
  - "Próximos turnos disponibles: martes 25/03 a las 10:00..."
        ↓
Bot presenta opciones numeradas al paciente
        ↓
Paciente elige número (o pide ver más opciones con preferencia libre)
        ↓
  [Si elige número] → confirmar y agendar en Google Calendar
  [Si pide otra opción] → Haiku filtra el resto del mes por preferencia
                          ("martes a la tarde") → presenta nuevas opciones
        ↓
Evento creado en Google Calendar → confirmación al paciente
```

### 6.3 Servicio nuevo a crear

```
src/utils/calendarService.ts   ← Integración Google Calendar (NUEVO)
src/utils/haikuService.ts      ← Cliente Claude Haiku API (NUEVO)
```

**`haikuService.ts` — responsabilidades:**
- Recibir texto libre del paciente ("cualquier día por la tarde")
- Extraer preferencias estructuradas (días, franjas horarias)
- Determinar duración del turno según tipo de cita
- Generar respuesta en lenguaje natural con las opciones encontradas
- Modelo: `claude-haiku-4-5-20251001`

**`calendarService.ts` — responsabilidades:**
- Consultar Google Calendar de la Dra. Villalba
- Buscar slots libres en todo el mes actual (no solo mañana)
- Filtrar por duración (30 o 60 min)
- Crear/confirmar el evento una vez seleccionado

### 6.4 Nuevos flows a crear

```
src/flows/mainMenu.flow.ts     ← Menú principal (paso 0) — NUEVO
src/flows/newPatient.flow.ts   ← Flujo paciente nuevo ATM — NUEVO
src/flows/control.flow.ts      ← Flujo control/seguimiento — NUEVO
```

### 6.5 Archivos existentes a modificar

```
src/app.ts                     ← Registrar los nuevos flows
```

### 6.6 Archivos que NO se tocan

```
src/flows/availableSlots.flow.ts   ← No tocar (flujo legacy, distinto sistema)
src/flows/sobreturnoFlow.ts        ← No tocar (sin emergencias por ahora)
src/utils/appointmentService.ts    ← No tocar (es del sistema CitaMedicaBeta)
src/utils/sobreturnoService.ts     ← No tocar
src/config/axios.ts                ← No tocar
src/config/app.ts                  ← No tocar
```

### 6.7 Variables de entorno necesarias (NUEVAS)

```env
# Claude Haiku
ANTHROPIC_API_KEY=sk-ant-...

# Google Calendar
GOOGLE_CALENDAR_ID=...
GOOGLE_SERVICE_ACCOUNT_JSON=...   # o path al archivo google.json

# Emergencias
EMERGENCY_PHONE_NUMBER=+549...    # número de WhatsApp de la Dra.
```

### 6.8 Integración con gentle-ia (PENDIENTE — Fase 3)
- Para respuestas libres y conversacionales (precio, obras sociales, dudas generales)
- El modelo debe estar instruido con el perfil de la Dra. Villalba
- **Primero**: flujo estructurado + Haiku + Calendar funcionando

---

## 7. SCOPE — QUÉ TOCAMOS Y QUÉ NO

### ✅ DENTRO DEL SCOPE (fase 1)
- Menú principal de bienvenida
- Flujo de primer paciente ATM/Bruxismo (datos + turno 1h)
- Flujo de control (datos + turno 30min)
- Emergencia → mensaje a número directo de la Dra. (sin sobreturno automático)
- Manejo de casos especiales (dolor, obras sociales, precio)
- **Claude Haiku** para interpretar disponibilidad del paciente en texto libre
- **Google Calendar** como fuente de verdad de disponibilidad (todo el mes)

### 🚫 FUERA DEL SCOPE (fase 2)
- Sobreturnos automáticos (emergencias con reserva automatizada)
- Integración con gentle-ia para respuestas conversacionales

### 🚫 FUERA DEL SCOPE (fase 3 / futuro)
- Recordatorios automáticos de turno
- Cancelación/reprogramación de turnos
- Historial del paciente
- Cobro o gestión de pagos

---

## 8. PREGUNTAS ABIERTAS (validar con cliente)

1. ❓ ¿El bot debe preguntar si el paciente tiene dolor **siempre** al inicio, o solo si menciona urgencia?
2. ❓ ¿El precio de consulta se publica o siempre es "consultar directamente"?
3. ❓ ¿Qué pasa si no hay turnos de 1 hora disponibles? ¿Muestra igualmente o dice "sin disponibilidad"?
4. ❓ ¿Los turnos de tarde son preferidos? (las respuestas sugieren que sí, ¿se priorizan en la vista?)
5. ❓ ¿El bot debe preguntar el motivo específico (ATM o Bruxismo) o es suficiente con "primera consulta"?
6. ❓ ¿Cómo identificamos si es paciente conocido vs nuevo? ¿Solo por lo que dice, o hay base de datos?

---

## 9. PRÓXIMOS PASOS

1. **Validar este PRD con la Od. Villalba** — confirmar flujo y preguntas abiertas
2. **Implementar `mainMenu.flow.ts`** — menú de bienvenida
3. **Implementar `newPatient.flow.ts`** — primer paciente
4. **Implementar `control.flow.ts`** — control
5. **Integrar gentle-ia** — respuestas libres (fase 2)
