import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getAvailableSlots, createCalendarEvent, AvailableSlot } from '../utils/calendarService';
import { formatSlotsMessage, filterSlotsByPreference } from '../utils/haikuService';

const MAX_SHOWN = 8;

const CONTROL_TYPES: Record<string, { label: string; duration: 30 | 60 }> = {
    '1': { label: 'Control de placa (ajuste/estabilización)', duration: 30 },
    '2': { label: 'Segunda visita / control', duration: 30 },
    '3': { label: 'Reparación de placa', duration: 60 },
};

export const controlFlow = addKeyword<Provider, IDBDatabase>(['__control__'])
    .addAnswer(
        '¡Hola! Para tu control, necesito algunos datos 😊\n\n' +
        '¿Me decís tu *nombre y apellido* completo?\n\n' +
        '_En cualquier momento podés escribir *cancelar* para salir_',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            console.log(`[CONTROL] Paso 1 — Nombre recibido: "${ctx.body}"`);
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            await state.update({ clientName: ctx.body.trim() });
            console.log(`[CONTROL] Nombre guardado: "${ctx.body.trim()}"`);
        }
    )
    .addAnswer(
        '¿Qué tipo de visita necesitás?\n\n' +
        '1️⃣ Control de placa (ajuste/estabilización) — *30 min*\n' +
        '2️⃣ Segunda visita / control — *30 min*\n' +
        '3️⃣ Reparación de placa — *60 min*\n\n' +
        '_Respondé con 1, 2 o 3_',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            console.log(`[CONTROL] Paso 2 — Tipo de visita: "${ctx.body}"`);
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            const selected = CONTROL_TYPES[ctx.body.trim()];
            if (!selected) {
                console.warn(`[CONTROL] Opción inválida: "${ctx.body.trim()}"`);
                await flowDynamic('❌ Opción no válida. Por favor, respondé con 1, 2 o 3.');
                return;
            }
            await state.update({
                appointmentType: selected.label,
                slotDuration: selected.duration,
            });
            console.log(`[CONTROL] Tipo guardado: "${selected.label}" — duración: ${selected.duration} min`);
        }
    )
    .addAnswer(
        '⏳ *Buscando los próximos turnos disponibles...*',
        null,
        async (ctx, { state, flowDynamic }) => {
            const slotDuration: 30 | 60 = (await state.get('slotDuration')) ?? 30;
            console.log(`[CONTROL] Paso 3 — Consultando Google Calendar (${slotDuration} min)...`);
            try {
                const slots = await getAvailableSlots(slotDuration);

                if (!slots.length) {
                    await flowDynamic(
                        '❌ No encontré turnos disponibles este mes.\n\n' +
                        'Comunicate directamente con la Dra. Villalba para coordinar 📞'
                    );
                    await state.clear();
                    return;
                }

                await state.update({ slotsCache: slots });
                await flowDynamic(formatSlotsMessage(slots));
            } catch (error) {
                console.error('[CONTROL] Error obteniendo slots:', error);
                await flowDynamic(
                    '❌ Ocurrió un error al consultar los turnos.\n' +
                    'Por favor, intentá nuevamente en unos minutos.'
                );
                await state.clear();
            }
        }
    )
    .addAnswer(
        '',
        { capture: true },
        async (ctx, { state, flowDynamic, fallBack }) => {
            const input = ctx.body.trim();

            if (input.toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }

            const slots: AvailableSlot[] = (await state.get('slotsCache')) ?? [];

            if (!slots.length) {
                await flowDynamic('❌ No hay turnos disponibles. Comunicate directamente con la Dra. Villalba 📞');
                await state.clear();
                return;
            }

            const selectedNumber = parseInt(input);
            console.log(`[CONTROL] Paso 4 — Selección: "${input}" → número: ${selectedNumber}`);

            // Texto libre → filtrar con Haiku
            if (isNaN(selectedNumber)) {
                console.log('[CONTROL] Entrada de texto libre → llamando a Haiku para filtrar');
                await flowDynamic('🔍 *Buscando turnos según tu preferencia...*');
                try {
                    const filtered = await filterSlotsByPreference(slots, input);
                    if (!filtered.length) {
                        await flowDynamic('❌ No encontré turnos que coincidan. Comunicate con la Dra. Villalba 📞');
                        await state.clear();
                        return;
                    }
                    await state.update({ slotsCache: filtered });
                    await flowDynamic(formatSlotsMessage(filtered));
                } catch (error) {
                    console.error('[CONTROL] Error en Haiku:', error);
                    await flowDynamic(formatSlotsMessage(slots));
                }
                return fallBack();
            }

            const maxIndex = Math.min(MAX_SHOWN, slots.length);
            if (selectedNumber < 1 || selectedNumber > maxIndex) {
                await flowDynamic(
                    `❌ Por favor, elegí un número entre *1* y *${maxIndex}*,\n` +
                    `o escribí tu preferencia de horario (ej: "jueves a la mañana")`
                );
                return fallBack();
            }

            const selectedSlot = slots[selectedNumber - 1];
            console.log(`[CONTROL] Slot seleccionado: ${selectedSlot.displayText}`);
            const clientName: string = (await state.get('clientName')) ?? '';
            const appointmentType: string = (await state.get('appointmentType')) ?? 'Control';
            const slotDuration: number = (await state.get('slotDuration')) ?? 30;

            try {
                await createCalendarEvent(selectedSlot, {
                    patientName: clientName,
                    appointmentType: `${appointmentType} (${slotDuration} min)`,
                    phone: ctx.from,
                });

                await flowDynamic(
                    '✅ *¡Control confirmado!* 🎉\n\n' +
                    `📅 *Fecha y hora:* ${selectedSlot.displayText}\n` +
                    `👤 *Paciente:* ${clientName}\n` +
                    `⏱️ *Duración:* ${slotDuration} minutos\n\n` +
                    '_Por favor, llegá 10 minutos antes._\n\n' +
                    '¡Nos vemos pronto! 😊'
                );
                await state.clear();
            } catch (error) {
                console.error('[CONTROL] Error creando evento:', error);
                await flowDynamic(
                    '❌ No se pudo confirmar el turno en este momento.\n' +
                    'Por favor, contactá directamente a la Dra. Villalba 📞'
                );
                await state.clear();
            }
        }
    );
