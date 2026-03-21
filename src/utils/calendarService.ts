import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const TIMEZONE = 'America/Argentina/Buenos_Aires';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID!;
// Od. Villalba atiende lunes a jueves, 15:00 a 20:00 (BsAs)
const WORK_START_HOUR = 15;
const WORK_END_HOUR = 20;
const WORK_DAYS = [1, 2, 3, 4]; // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
// Argentina is always UTC-3, no DST
const BSAS_OFFSET_HOURS = 3;

const credentials = JSON.parse(
    readFileSync(join(process.cwd(), 'google.json.txt'), 'utf8')
);

const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });

export interface AvailableSlot {
    startISO: string;       // UTC ISO string
    endISO: string;         // UTC ISO string
    date: string;           // 'yyyy-MM-dd' in BsAs
    time: string;           // 'HH:mm' in BsAs
    displayText: string;    // 'Martes 25/03 — 14:30 hs'
    durationMinutes: number;
}

export interface PatientEventData {
    patientName: string;
    appointmentType: string;
    phone: string;
    notes?: string;
}

// Converts a Buenos Aires local time to UTC Date
function bsAsToUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
    return new Date(Date.UTC(year, month - 1, day, hour + BSAS_OFFSET_HOURS, minute, 0));
}

// Gets BsAs date components from a UTC Date
function utcToBsAs(utcDate: Date): { year: number; month: number; day: number; hour: number; minute: number; dayOfWeek: number } {
    const bsAs = new Date(utcDate.getTime() - BSAS_OFFSET_HOURS * 60 * 60 * 1000);
    return {
        year: bsAs.getUTCFullYear(),
        month: bsAs.getUTCMonth() + 1,
        day: bsAs.getUTCDate(),
        hour: bsAs.getUTCHours(),
        minute: bsAs.getUTCMinutes(),
        dayOfWeek: bsAs.getUTCDay(), // 0=Sun, 1=Mon, ..., 6=Sat
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
    const minBookingUtc = new Date(nowUtc.getTime() + 60 * 60 * 1000); // +1 hour

    const { year, month } = utcToBsAs(nowUtc);
    const lastDayOfMonth = new Date(year, month, 0).getDate(); // last day in BsAs month

    // End of month at 18:00 BsAs
    const endOfMonthUtc = bsAsToUtc(year, month, lastDayOfMonth, WORK_END_HOUR, 0);

    // Query Google Calendar for busy times
    const freeBusy = await calendar.freebusy.query({
        requestBody: {
            timeMin: minBookingUtc.toISOString(),
            timeMax: endOfMonthUtc.toISOString(),
            timeZone: TIMEZONE,
            items: [{ id: CALENDAR_ID }],
        },
    });

    const busyPeriods = (freeBusy.data.calendars?.[CALENDAR_ID]?.busy ?? []).map(b => ({
        start: new Date(b.start!),
        end: new Date(b.end!),
    }));

    const slots: AvailableSlot[] = [];
    const { day: todayDay } = utcToBsAs(nowUtc);

    for (let day = todayDay; day <= lastDayOfMonth; day++) {
        // Check day of week using noon to avoid DST edge cases
        const noonUtc = bsAsToUtc(year, month, day, 12, 0);
        const { dayOfWeek } = utcToBsAs(noonUtc);

        // Solo lunes a jueves
        if (!WORK_DAYS.includes(dayOfWeek)) continue;

        // Generate slots for this day
        for (
            let minutes = WORK_START_HOUR * 60;
            minutes + durationMinutes <= WORK_END_HOUR * 60;
            minutes += durationMinutes
        ) {
            const hour = Math.floor(minutes / 60);
            const minute = minutes % 60;

            const slotStartUtc = bsAsToUtc(year, month, day, hour, minute);
            const slotEndUtc = new Date(slotStartUtc.getTime() + durationMinutes * 60 * 1000);

            // Skip slots in the past (+ 1h buffer)
            if (slotStartUtc < minBookingUtc) continue;

            // Check against busy periods
            const isBusy = busyPeriods.some(
                b => slotStartUtc < b.end && slotEndUtc > b.start
            );
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

    return slots;
}

export async function createCalendarEvent(slot: AvailableSlot, patient: PatientEventData): Promise<void> {
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
}
