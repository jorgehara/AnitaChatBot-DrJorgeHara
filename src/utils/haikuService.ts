import Anthropic from '@anthropic-ai/sdk';
import { AvailableSlot } from './calendarService';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MAX_SLOTS_TO_SHOW = 8;

export function formatSlotsMessage(slots: AvailableSlot[]): string {
    const display = slots.slice(0, MAX_SLOTS_TO_SHOW);

    if (!display.length) {
        return '❌ No hay turnos disponibles en este período.';
    }

    let msg = '📅 *Próximos turnos disponibles:*\n\n';
    const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

    display.forEach((slot, i) => {
        msg += `  ${NUMBERS[i]} ${slot.displayText}\n`;
    });

    msg += '\n¿Con cuál te quedás? Respondé el número 😊';

    if (slots.length > MAX_SLOTS_TO_SHOW) {
        msg += '\n_Si ninguno te viene bien, decime qué días y horarios preferís y busco más opciones_';
    }

    return msg;
}

export async function filterSlotsByPreference(
    slots: AvailableSlot[],
    preferenceText: string
): Promise<AvailableSlot[]> {
    if (!slots.length) return slots;

    const slotsData = slots.map((s, i) => ({
        index: i,
        date: s.date,
        time: s.time,
        display: s.displayText,
    }));

    const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
            role: 'user',
            content: `El paciente indicó su preferencia horaria: "${preferenceText}"

Turnos disponibles:
${JSON.stringify(slotsData, null, 2)}

Devolvé SOLO un array JSON con los índices (campo "index") de los turnos que mejor coinciden con la preferencia del paciente. Máximo 8 índices, ordenados por relevancia.

Ejemplos de respuesta válida: [2, 5, 7] o [0, 1, 2, 3]

Si no hay coincidencias claras, devolvé los primeros 8 índices.
Respondé ÚNICAMENTE el array JSON, sin texto adicional.`,
        }],
    });

    const content = response.content[0];
    if (content.type !== 'text') return slots.slice(0, MAX_SLOTS_TO_SHOW);

    try {
        const indices: number[] = JSON.parse(content.text.trim());
        const filtered = indices.map(i => slots[i]).filter(Boolean);
        return filtered.length > 0 ? filtered : slots.slice(0, MAX_SLOTS_TO_SHOW);
    } catch {
        return slots.slice(0, MAX_SLOTS_TO_SHOW);
    }
}
