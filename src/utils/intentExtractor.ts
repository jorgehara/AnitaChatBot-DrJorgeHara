import Anthropic from '@anthropic-ai/sdk';

// Lazy: instanciado en la primera llamada para que dotenv ya haya corrido
let _anthropic: Anthropic | null = null;
function getClient(): Anthropic {
    if (!_anthropic) {
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    }
    return _anthropic;
}

export interface ExtractedIntent {
    option?: '1' | '2' | '3' | '4';
    name?: string;
    timePreference?: string;
}

export interface ExtractedDateIntent {
    date?: string;           // Formato YYYY-MM-DD — siempre presente si Haiku resolvió correctamente
    timePreference?: 'mañana' | 'tarde' | 'any';
    rawMessage: string;
}

/**
 * Extrae la intención del usuario cuando envía múltiples datos en un solo mensaje.
 * Ejemplo: "1 Juan Pérez martes 18" → { option: "1", name: "Juan Pérez", timePreference: "martes 18" }
 */
export async function extractUserIntent(message: string): Promise<ExtractedIntent> {
    console.log(`[INTENT_EXTRACTOR] Procesando mensaje: "${message}"`);

    const prompt = `Analiza este mensaje de un paciente que está reservando un turno médico.

Mensaje: "${message}"

Extrae SOLO la información que esté PRESENTE en el mensaje:
- option: número de opción (1, 2 o 3) si existe al inicio del mensaje
- name: nombre completo del paciente si existe (2 o más palabras que parecen un nombre)
- timePreference: preferencia de día/horario si existe (ej: "martes 18", "mañana", "tarde", "lunes a las 15")

IMPORTANTE:
- Si solo dice un número (ej: "1"), NO inventes un nombre
- Si el mensaje es solo texto sin número, NO inventes un option
- timePreference debe ser específico de tiempo (día de semana, hora, "mañana", "tarde")

Responde SOLO con JSON válido (sin markdown, sin explicaciones):
{
  "option": "1" | "2" | "3" | null,
  "name": string | null,
  "timePreference": string | null
}`;

    try {
        const response = await getClient().messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 200,
            messages: [{
                role: 'user',
                content: prompt,
            }],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            console.warn('[INTENT_EXTRACTOR] Haiku no devolvió texto');
            return {};
        }

        // Limpiar respuesta (por si viene con markdown)
        const cleanedText = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const parsed = JSON.parse(cleanedText);
        console.log('[INTENT_EXTRACTOR] Parsed:', parsed);

        return {
            option: parsed.option || undefined,
            name: parsed.name || undefined,
            timePreference: parsed.timePreference || undefined,
        };
    } catch (error) {
        console.error('[INTENT_EXTRACTOR] Error:', error);
        // Fallback: solo extraer el primer carácter si es 1, 2, 3 o 4
        const firstChar = message.trim()[0];
        if (firstChar === '1' || firstChar === '2' || firstChar === '3' || firstChar === '4') {
            return { option: firstChar as '1' | '2' | '3' | '4' };
        }
        return {};
    }
}

const DAY_NAME_TO_INDEX: Record<string, number> = {
    domingo: 0, lunes: 1, martes: 2, miércoles: 3,
    miercoles: 3, jueves: 4, viernes: 5, sábado: 6, sabado: 6,
};
const MONTH_NAME_TO_INDEX: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

/**
 * Calcula la fecha real a partir de lo que extrajo Haiku.
 * 
 * Haiku extrae SIGNIFICADO semántico (dayNumber, dayOfWeek, monthName, relativeWeek).
 * El código hace la aritmética de fechas — los LLMs son poco confiables para eso.
 */
function resolveDate(parsed: {
    dayNumber?: number | null;
    monthName?: string | null;
    dayOfWeek?: string | null;
    relativeWeek?: 'this' | 'next' | null;
}, nowBsAs: Date): string | undefined {

    const todayYear  = nowBsAs.getUTCFullYear();
    const todayMonth = nowBsAs.getUTCMonth() + 1; // 1-based
    const todayDay   = nowBsAs.getUTCDate();

    // CASO 1: Tiene número de día explícito → prioridad absoluta
    if (parsed.dayNumber) {
        const targetMonth = parsed.monthName
            ? (MONTH_NAME_TO_INDEX[parsed.monthName.toLowerCase()] ?? todayMonth)
            : todayMonth;
        let targetYear = todayYear;

        // Si la fecha ya pasó este mes/año, ir al siguiente mes
        const candidate = new Date(Date.UTC(targetYear, targetMonth - 1, parsed.dayNumber));
        const today     = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
        if (candidate < today) {
            const nextMonth = targetMonth === 12 ? 1 : targetMonth + 1;
            const nextYear  = targetMonth === 12 ? targetYear + 1 : targetYear;
            return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(parsed.dayNumber).padStart(2, '0')}`;
        }

        return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(parsed.dayNumber).padStart(2, '0')}`;
    }

    // CASO 2: Solo día de semana (sin número)
    if (parsed.dayOfWeek) {
        const targetDow = DAY_NAME_TO_INDEX[parsed.dayOfWeek.toLowerCase()];
        if (targetDow === undefined) return undefined;

        const todayDow = nowBsAs.getUTCDay();
        let daysAhead = targetDow - todayDow;

        if (parsed.relativeWeek === 'next') {
            // "el lunes que viene" → siempre la PRÓXIMA semana, no esta
            daysAhead = daysAhead <= 0 ? daysAhead + 14 : daysAhead + 7;
        } else {
            // "el jueves" → el próximo jueves (si hoy ES jueves, el de la semana que viene)
            if (daysAhead <= 0) daysAhead += 7;
        }

        const result = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay + daysAhead));
        return result.toISOString().slice(0, 10);
    }

    return undefined;
}

/**
 * Extrae información de fecha del mensaje del usuario usando Claude Haiku.
 * Haiku extrae semántica (qué quiso decir el paciente).
 * El código hace la aritmética (cuál es la fecha exacta).
 *
 * Ejemplos:
 * - "viernes 28"             → 2026-03-28
 * - "el lunes que viene"     → 2026-03-30
 * - "la semana que viene"    → 2026-03-30  (próximo lunes)
 * - "27 de marzo por la tarde" → 2026-03-27, tarde
 * - "el jueves"              → 2026-03-26
 */
export async function extractDateIntent(message: string): Promise<ExtractedDateIntent> {
    console.log(`[DATE_EXTRACTOR] Procesando mensaje: "${message}"`);

    // Fecha actual en BsAs (UTC-3)
    const nowBsAs = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const todayDayName = DAY_NAMES[nowBsAs.getUTCDay()];
    const todayStr = nowBsAs.toISOString().slice(0, 10);

    const prompt = `Hoy es ${todayDayName} ${todayStr} (Argentina, UTC-3).

El paciente escribió: "${message}"

Extraé SOLO el significado semántico de la fecha. NO calcules la fecha exacta.

Respondé SOLO con JSON (sin markdown):
{
  "dayNumber": number | null,
  "monthName": string | null,
  "dayOfWeek": "lunes"|"martes"|"miércoles"|"jueves"|"viernes"|"sábado"|"domingo" | null,
  "relativeWeek": "next" | null,
  "timePreference": "mañana" | "tarde" | "any"
}

REGLAS:
- dayNumber: número de día del mes SI lo menciona explícitamente (ej: "28", "27")
- monthName: nombre del mes en español SI lo menciona (ej: "marzo", "abril")
- dayOfWeek: día de semana mencionado (ej: "viernes", "lunes")
- relativeWeek: "next" si dice "que viene", "próximo", "siguiente", o "la semana que viene"
- Si dice "la semana que viene" sin día → dayOfWeek: "lunes", relativeWeek: "next"
- timePreference: según si menciona mañana/tarde/am/pm`;

    try {
        const response = await getClient().messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 120,
            messages: [{ role: 'user', content: prompt }],
        });

        const content = response.content[0];
        if (content.type !== 'text') {
            console.warn('[DATE_EXTRACTOR] Haiku no devolvió texto');
            return { rawMessage: message };
        }

        const cleanedText = content.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanedText);
        console.log('[DATE_EXTRACTOR] Haiku extrajo:', parsed);

        const date = resolveDate(parsed, nowBsAs);
        console.log('[DATE_EXTRACTOR] Fecha resuelta:', date);

        if (!date) {
            console.warn('[DATE_EXTRACTOR] No se pudo resolver la fecha');
            return { rawMessage: message };
        }

        return {
            date,
            timePreference: parsed.timePreference || 'any',
            rawMessage: message,
        };
    } catch (error) {
        console.error('[DATE_EXTRACTOR] Error:', error);
        return { rawMessage: message };
    }
}
