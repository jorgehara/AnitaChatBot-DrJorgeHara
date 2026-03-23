import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

const TIMEZONE = 'America/Argentina/Buenos_Aires';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
// Od. Villalba atiende lunes a jueves, 15:00 a 20:00 (BsAs)
const WORK_START_HOUR = 15;
const WORK_END_HOUR = 20;
const WORK_DAYS = [1, 2, 3, 4]; // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
// Argentina is always UTC-3, no DST
const BSAS_OFFSET_HOURS = 3;

// Soporta JSON inline (env var) o path a archivo
const credentialsRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    ?? readFileSync(
        process.env.GOOGLE_SERVICE_ACCOUNT_PATH ?? join(process.cwd(), 'google.json.txt'),
        'utf8'
    );
const credentials = JSON.parse(credentialsRaw);

console.log('[CALENDAR] Service account:', credentials.client_email);
console.log('[CALENDAR] Calendar ID:', CALENDAR_ID);
console.log('[CALENDAR] Horario:', `Lun-Jue ${WORK_START_HOUR}:00 - ${WORK_END_HOUR}:00 BsAs`);

const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

export interface AvailableSlot {
    startISO: string;
    endISO: string;
    date: string;
    time: string;
    displayText: string;
    durationMinutes: number;
}

export interface PatientEventData {
    patientName: string;
    appointmentType: string;
    phone: string;
    notes?: string;
}

function bsAsToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
    return new Date(Date.UTC(year, month - 1, day, hour + BSAS_OFFSET_HOURS, minute, 0));
}

function utcToBsAs(utcDate: Date): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
    const bsAs = new Date(utcDate.getTime() - BSAS_OFFSET_HOURS * 60 * 60 * 1000);
    return {
        year: bsAs.getUTCFullYear(),
        month: bsAs.getUTCMonth() + 1,
        day: bsAs.getUTCDate(),
        hour: bsAs.getUTCHours(),
        minute: bsAs.getUTCMinutes(),
        dayOfWeek: bsAs.getUTCDay(),
    };
}

function formatSlotDisplay(utcDate: Date): string {
    const { day, month, hour, minute, dayOfWeek } = utcToBsAs(utcDate);
    const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayName = DAY_NAMES[dayOfWeek];
    const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    return `${dayName} ${dateStr} — ${timeStr} hs`;
}

export async function getAvailableSlots(durationMinutes: 30 | 60): Promise<AvailableSlot[]> {
    const nowUtc = new Date();
    const minBookingUtc = new Date(nowUtc.getTime() + 60 * 60 * 1000);

    const { year, month } = utcToBsAs(nowUtc);
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    const endOfMonthUtc = bsAsToUtc(year, month, lastDayOfMonth, WORK_END_HOUR, 0);

    console.log(`[CALENDAR] getAvailableSlots — duración: ${durationMinutes} min`);
    console.log(`[CALENDAR] Rango de búsqueda: ${minBookingUtc.toISOString()} → ${endOfMonthUtc.toISOString()}`);

    const freeBusy = await calendar.freebusy.query({
        requestBody: {
            timeMin: minBookingUtc.toISOString(),
            timeMax: endOfMonthUtc.toISOString(),
            timeZone: TIMEZONE,
            items: [{ id: CALENDAR_ID }],
        },
    });

    const errors = freeBusy.data.calendars?.[CALENDAR_ID]?.errors;
    if (errors?.length) {
        console.warn('[CALENDAR] ⚠️ Errores en freeBusy:', JSON.stringify(errors));
    }

    const busyPeriods = (freeBusy.data.calendars?.[CALENDAR_ID]?.busy ?? []).map(b => ({
        start: new Date(b.start!),
        end: new Date(b.end!),
    }));

    console.log(`[CALENDAR] Períodos ocupados encontrados: ${busyPeriods.length}`);
    busyPeriods.forEach(b => {
        console.log(`[CALENDAR]   Ocupado: ${b.start.toISOString()} → ${b.end.toISOString()}`);
    });

    const slots: AvailableSlot[] = [];
    const { day: todayDay } = utcToBsAs(nowUtc);

    for (let day = todayDay; day <= lastDayOfMonth; day++) {
        const noonUtc = bsAsToUtc(year, month, day, 12, 0);
        const { dayOfWeek } = utcToBsAs(noonUtc);

        if (!WORK_DAYS.includes(dayOfWeek)) continue;

        for (
            let minutes = WORK_START_HOUR * 60;
            minutes + durationMinutes <= WORK_END_HOUR * 60;
            minutes += durationMinutes
        ) {
            const hour = Math.floor(minutes / 60);
            const minute = minutes % 60;

            const slotStartUtc = bsAsToUtc(year, month, day, hour, minute);
            const slotEndUtc = new Date(slotStartUtc.getTime() + durationMinutes * 60 * 1000);

            if (slotStartUtc < minBookingUtc) continue;

            const isBusy = busyPeriods.some(b => slotStartUtc < b.end && slotEndUtc > b.start);
            if (isBusy) continue;

            const { day: d, month: m, hour: h, minute: mi } = utcToBsAs(slotStartUtc);

            slots.push({
                startISO: slotStartUtc.toISOString(),
                endISO: slotEndUtc.toISOString(),
                date: `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                time: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`,
                displayText: formatSlotDisplay(slotStartUtc),
                durationMinutes,
            });
        }
    }

    console.log(`[CALENDAR] Slots disponibles generados: ${slots.length}`);
    if (slots.length > 0) {
        console.log(`[CALENDAR]   Primero: ${slots[0].displayText}`);
        console.log(`[CALENDAR]   Último:  ${slots[slots.length - 1].displayText}`);
    }

    return slots;
}

/**
 * Obtiene turnos disponibles separados en HOY y MAÑANA
 * @param durationMinutes Duración del turno (30 o 60 minutos)
 * @returns Objeto con slots de hoy y mañana separados
 */
export async function getTodayAndTomorrowSlots(durationMinutes: 30 | 60): Promise<{
    today: AvailableSlot[];
    tomorrow: AvailableSlot[];
}> {
    const nowUtc = new Date();
    const { year, month, day: todayDay, dayOfWeek: todayDayOfWeek } = utcToBsAs(nowUtc);
    
    console.log(`[CALENDAR] getTodayAndTomorrowSlots — duración: ${durationMinutes} min`);
    
    // Calcular mañana (considerar días hábiles)
    let tomorrowDay = todayDay + 1;
    let tomorrowMonth = month;
    let tomorrowYear = year;
    
    // Si mañana es el siguiente mes
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    if (tomorrowDay > lastDayOfMonth) {
        tomorrowDay = 1;
        tomorrowMonth = month + 1;
        if (tomorrowMonth > 12) {
            tomorrowMonth = 1;
            tomorrowYear = year + 1;
        }
    }
    
    const tomorrowNoonUtc = bsAsToUtc(tomorrowYear, tomorrowMonth, tomorrowDay, 12, 0);
    const { dayOfWeek: tomorrowDayOfWeek } = utcToBsAs(tomorrowNoonUtc);
    
    // Verificar si mañana es día hábil, si no, buscar el siguiente
    while (!WORK_DAYS.includes(tomorrowDayOfWeek)) {
        tomorrowDay++;
        if (tomorrowDay > lastDayOfMonth) {
            tomorrowDay = 1;
            tomorrowMonth++;
            if (tomorrowMonth > 12) {
                tomorrowMonth = 1;
                tomorrowYear++;
            }
        }
    }
    
    // Obtener todos los slots del mes
    const allSlots = await getAvailableSlots(durationMinutes);
    
    // Filtrar por día
    const todaySlots = allSlots.filter(slot => {
        const slotDate = utcToBsAs(new Date(slot.startISO));
        return slotDate.day === todayDay && slotDate.month === month && slotDate.year === year;
    });
    
    const tomorrowSlots = allSlots.filter(slot => {
        const slotDate = utcToBsAs(new Date(slot.startISO));
        return slotDate.day === tomorrowDay && slotDate.month === tomorrowMonth && slotDate.year === tomorrowYear;
    });
    
    console.log(`[CALENDAR] Slots HOY (${todayDay}/${month}): ${todaySlots.length}`);
    console.log(`[CALENDAR] Slots MAÑANA (${tomorrowDay}/${tomorrowMonth}): ${tomorrowSlots.length}`);
    
    return {
        today: todaySlots,
        tomorrow: tomorrowSlots,
    };
}

/**
 * Busca slots en una fecha específica. Si no hay, busca en el siguiente día hábil.
 * @param targetDate Fecha objetivo en formato 'YYYY-MM-DD'
 * @param durationMinutes Duración del turno (30 o 60 minutos)
 * @returns Slots disponibles y la fecha en la que se encontraron
 */
export async function getSlotsByCustomDate(
    targetDate: string,
    durationMinutes: 30 | 60
): Promise<{
    slots: AvailableSlot[];
    actualDate: string;
    message: string;
}> {
    console.log(`[CALENDAR] getSlotsByCustomDate — fecha objetivo: ${targetDate}, duración: ${durationMinutes} min`);
    
    // Parsear fecha objetivo
    const [yearStr, monthStr, dayStr] = targetDate.split('-').map(Number);
    let currentYear = yearStr;
    let currentMonth = monthStr;
    let currentDay = dayStr;
    
    // Máximo 7 días de búsqueda hacia adelante
    let attemptsLeft = 7;
    let isFirstDate = true;
    
    while (attemptsLeft > 0) {
        const checkDateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
        console.log(`[CALENDAR] Intentando fecha: ${checkDateStr}`);
        
        // Verificar si es día hábil
        const noonUtc = bsAsToUtc(currentYear, currentMonth, currentDay, 12, 0);
        const { dayOfWeek } = utcToBsAs(noonUtc);
        
        // Si la fecha original no es día hábil, informar
        if (isFirstDate && !WORK_DAYS.includes(dayOfWeek)) {
            const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            console.log(`[CALENDAR] ⚠️  Fecha solicitada (${checkDateStr}) cae en ${DAY_NAMES[dayOfWeek]} (no laborable)`);
        }
        isFirstDate = false;
        
        if (WORK_DAYS.includes(dayOfWeek)) {
            // Obtener slots de ese día
            const allSlots = await getAvailableSlots(durationMinutes);
            const daySlots = allSlots.filter(slot => slot.date === checkDateStr);
            
            if (daySlots.length > 0) {
                const message = checkDateStr === targetDate
                    ? `📅 Turnos disponibles para el ${formatDateSpanish(checkDateStr)}:`
                    : `⚠️ La fecha que solicitaste (${formatDateSpanish(targetDate)}) no está disponible.\n\n📅 Te muestro los turnos del ${formatDateSpanish(checkDateStr)}:`;
                
                console.log(`[CALENDAR] ✅ Encontrados ${daySlots.length} slots en ${checkDateStr}`);
                return {
                    slots: daySlots,
                    actualDate: checkDateStr,
                    message,
                };
            }
        }
        
        // Avanzar al siguiente día
        currentDay++;
        const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();
        if (currentDay > lastDayOfMonth) {
            currentDay = 1;
            currentMonth++;
            if (currentMonth > 12) {
                currentMonth = 1;
                currentYear++;
            }
        }
        
        attemptsLeft--;
    }
    
    console.log('[CALENDAR] ❌ No se encontraron slots en los próximos 7 días');
    return {
        slots: [],
        actualDate: targetDate,
        message: 'No hay turnos disponibles en los próximos días. Por favor, comunicate directamente con la Dra. Villalba.',
    };
}

/**
 * Formatea una fecha YYYY-MM-DD a español (ej: "Martes 25 de Marzo")
 */
function formatDateSpanish(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    const noonUtc = bsAsToUtc(year, month, day, 12, 0);
    const { dayOfWeek } = utcToBsAs(noonUtc);
    
    const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const MONTH_NAMES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    return `${DAY_NAMES[dayOfWeek]} ${day} de ${MONTH_NAMES[month - 1]}`;
}

export async function createCalendarEvent(slot: AvailableSlot, patient: PatientEventData): Promise<void> {
    console.log('[CALENDAR] Creando evento:');
    console.log(`[CALENDAR]   Paciente: ${patient.patientName}`);
    console.log(`[CALENDAR]   Tipo: ${patient.appointmentType}`);
    console.log(`[CALENDAR]   Slot: ${slot.displayText}`);
    console.log(`[CALENDAR]   Start ISO: ${slot.startISO}`);
    console.log(`[CALENDAR]   End ISO:   ${slot.endISO}`);
    console.log(`[CALENDAR]   Calendar ID: ${CALENDAR_ID}`);

    await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
            summary: `🦷 ${patient.patientName} — ${patient.appointmentType}`,
            description: [
                `Paciente: ${patient.patientName}`,
                `Teléfono: ${patient.phone}`,
                patient.notes ? `Notas: ${patient.notes}` : '',
            ].filter(Boolean).join('\n'),
            start: { dateTime: slot.startISO, timeZone: TIMEZONE },
            end: { dateTime: slot.endISO, timeZone: TIMEZONE },
        },
    });

    console.log('[CALENDAR] ✅ Evento creado exitosamente');
}
