import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getTodayAndTomorrowSlots, getSlotsByCustomDate, AvailableSlot } from '../utils/calendarService.js';
import { createCitaMedicaAppointment } from '../utils/citaMedicaService.js';
import { extractDateIntent } from '../utils/intentExtractor.js';

const MAX_SHOWN = 8;

const CONTROL_TYPES: Record<string, { label: string; duration: 30 | 60 }> = {
    '1': { label: 'Control de placa (ajuste/estabilización)', duration: 30 },
    '2': { label: 'Segunda visita / control', duration: 30 },
    '3': { label: 'Reparación de placa', duration: 60 },
};

function buildSlotsMessage(
    headerLine: string,
    allSlots: AvailableSlot[],
    otherDateNumber: number
): string {
    const limited = allSlots.slice(0, MAX_SHOWN);

    const byDate = new Map<string, AvailableSlot[]>();
    for (const slot of limited) {
        if (!byDate.has(slot.date)) byDate.set(slot.date, []);
        byDate.get(slot.date)!.push(slot);
    }

    let msg = headerLine + '\n\n';
    let n = 1;

    for (const [, daySlots] of byDate) {
        const dayLabel = daySlots[0].displayText.split(' — ')[0];
        msg += `🔹 *${dayLabel.toUpperCase()}*\n`;
        for (const slot of daySlots) {
            msg += `${n}. ${slot.displayText}\n`;
            n++;
        }
        msg += '\n';
    }

    msg += `${otherDateNumber}. 📆 Buscar otra fecha\n\n`;
    msg += '📝 *Respondé con el número del turno que te sirve*\n';
    msg += '_O escribí *cancelar* para salir_';

    return msg;
}

export const controlFlow = addKeyword<Provider, IDBDatabase>(['__control__'])
    .addAction(async (ctx, { state, flowDynamic }) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[CONTROL] 🚀 INICIO DEL FLOW');
        console.log('[CONTROL] From:', ctx.from);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const existingName = await state.get('clientName');
        console.log('[CONTROL] clientName en state:', existingName || '(vacío)');

        if (!existingName) {
            // No debería pasar — mainMenu siempre guarda el nombre antes de gotoFlow
            console.log('[CONTROL] ❌ Sin nombre en state, abortando');
            await flowDynamic('❌ Hubo un error. Por favor, empezá de nuevo escribiendo "hola"');
            await state.clear();
            return;
        }

        await state.update({ appointmentType: 'Control o seguimiento' });
    })
    .addAnswer(
        '¿Qué tipo de control necesitás?\n\n' +
        '1️⃣ Control de placa (ajuste/estabilización) — *30 min*\n' +
        '2️⃣ Segunda visita / control — *30 min*\n' +
        '3️⃣ Reparación de placa — *60 min*\n\n' +
        '_Respondé con 1, 2 o 3. O escribí *cancelar* para salir_',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            console.log(`[CONTROL] 📝 Tipo de visita: "${ctx.body}"`);

            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }

            const selected = CONTROL_TYPES[ctx.body.trim()];
            if (!selected) {
                console.warn(`[CONTROL] Opción inválida: "${ctx.body.trim()}"`);
                await flowDynamic('❌ Opción no válida. Por favor, respondé con *1*, *2* o *3*.');
                return;
            }

            await state.update({
                appointmentType: selected.label,
                slotDuration: selected.duration,
            });
            console.log(`[CONTROL] ✅ Tipo guardado: "${selected.label}" — ${selected.duration} min`);
        }
    )
    .addAnswer(
        '⏳ *Buscando los próximos turnos disponibles...*',
        null,
        async (ctx, { state, flowDynamic }) => {
            const slotDuration: 30 | 60 = (await state.get('slotDuration')) ?? 30;
            const clientName: string = (await state.get('clientName')) ?? '';
            console.log(`[CONTROL] 🔍 Consultando Google Calendar (${slotDuration} min) para: ${clientName}`);

            try {
                const { today, tomorrow } = await getTodayAndTomorrowSlots(slotDuration);

                if (!today.length && !tomorrow.length) {
                    await flowDynamic(
                        '❌ No hay turnos disponibles hoy ni mañana.\n\n' +
                        'Comunicate directamente con la Dra. Villalba para coordinar 📞'
                    );
                    await state.clear();
                    return;
                }

                let message = '📅 *Turnos disponibles:*\n\n';
                const allSlots: AvailableSlot[] = [];
                let optionNumber = 1;

                if (today.length > 0) {
                    message += '🔹 *HOY*\n';
                    today.slice(0, 4).forEach(slot => {
                        message += `${optionNumber}. ${slot.displayText}\n`;
                        allSlots.push(slot);
                        optionNumber++;
                    });
                    message += '\n';
                }

                if (tomorrow.length > 0) {
                    message += '🔹 *MAÑANA*\n';
                    tomorrow.slice(0, 4).forEach(slot => {
                        message += `${optionNumber}. ${slot.displayText}\n`;
                        allSlots.push(slot);
                        optionNumber++;
                    });
                    message += '\n';
                }

                message += `${optionNumber}. 📆 Buscar otra fecha\n\n`;
                message += '📝 *Respondé con el número del turno que te sirve*\n';
                message += '_O escribí *cancelar* para salir_';

                await state.update({
                    slotsCache: allSlots,
                    otherDateOption: optionNumber.toString(),
                    customDateMode: false,
                });
                await flowDynamic(message);
                console.log(`[CONTROL] ✅ Mostrando ${allSlots.length} turnos`);
            } catch (error) {
                console.error('[CONTROL] ❌ Error obteniendo slots:', error);
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
            console.log(`[CONTROL] 📝 Selección recibida: "${input}"`);

            if (input.toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }

            const slots: AvailableSlot[] = (await state.get('slotsCache')) ?? [];
            const otherDateOption: string = (await state.get('otherDateOption')) ?? '99';
            const shownCount = Math.min(slots.length, MAX_SHOWN);
            // ⚠️ CRÍTICO: leer customDateMode ANTES del guard de slots vacíos
            // Cuando el user escribe la fecha, slotsCache está vacío intencionalmente
            const customDateMode: boolean = (await state.get('customDateMode')) ?? false;

            console.log('[CONTROL] Slots en cache:', slots.length);
            console.log('[CONTROL] customDateMode:', customDateMode);
            console.log('[CONTROL] otherDateOption:', otherDateOption);

            // ── 1. PRIMERO: modo búsqueda por fecha ─────────────────────────────
            if (customDateMode) {
                console.log('[CONTROL] → Procesando fecha personalizada:', input);
                await flowDynamic('🔍 *Buscando turnos disponibles...*');

                try {
                    const dateIntent = await extractDateIntent(input);
                    console.log('[CONTROL] Fecha extraída:', JSON.stringify(dateIntent));

                    if (!dateIntent.date) {
                        await flowDynamic(
                            'No pude entender la fecha que mencionaste 😅\n\n' +
                            'Por favor, intentá de nuevo:\n' +
                            '- "Martes 25"\n' +
                            '- "El jueves que viene"\n' +
                            '- "27 de marzo"'
                        );
                        return fallBack();
                    }

                    const slotDuration: 30 | 60 = (await state.get('slotDuration')) ?? 30;
                    const result = await getSlotsByCustomDate(dateIntent.date, slotDuration);
                    console.log('[CONTROL] Slots encontrados:', result.slots.length);

                    if (result.slots.length === 0) {
                        await flowDynamic(
                            '😞 No hay turnos disponibles en los próximos días para esa fecha.\n\n' +
                            '💡 *Opciones*:\n' +
                            '1️⃣ Escribí otra fecha (ej: "Lunes próximo", "31 de marzo")\n' +
                            '2️⃣ Escribí *cancelar* para salir\n' +
                            '3️⃣ Comunicate al *3735604949* para coordinar directamente'
                        );
                        return fallBack();
                    }

                    const newOtherDateNum = Math.min(result.slots.length, MAX_SHOWN) + 1;
                    await state.update({
                        slotsCache: result.slots,
                        otherDateOption: String(newOtherDateNum),
                        customDateMode: false,
                    });

                    await flowDynamic(buildSlotsMessage(result.message, result.slots, newOtherDateNum));
                    return fallBack();

                } catch (error) {
                    console.error('[CONTROL] ❌ ERROR en búsqueda por fecha:', error);
                    await flowDynamic('❌ Hubo un error al buscar turnos. Intentá de nuevo o comunicate al *3735604949*.');
                    return fallBack();
                }
            }

            // ── 2. Guard real: sin slots fuera de customDateMode ────────────────
            if (!slots.length) {
                console.log('[CONTROL] ❌ Sin slots en caché');
                await flowDynamic('❌ No hay turnos disponibles. Comunicate directamente con la Dra. Villalba 📞');
                await state.clear();
                return;
            }

            // ── 3. Eligió "Buscar otra fecha" ───────────────────────────────────
            if (input === otherDateOption) {
                console.log('[CONTROL] → Modo búsqueda por fecha personalizada');
                await flowDynamic(
                    '📅 *Búsqueda personalizada*\n\n' +
                    'Decime para qué día necesitás el turno.\n\n' +
                    'Por ejemplo:\n' +
                    '- "Martes 25"\n' +
                    '- "Jueves que viene"\n' +
                    '- "27 de marzo por la tarde"\n\n' +
                    '_Escribí *cancelar* para salir_'
                );
                await state.update({ customDateMode: true, slotsCache: [], otherDateOption: '99' });
                return fallBack();
            }

            // ── 4. Selección normal de slot ─────────────────────────────────────
            const selectedNumber = parseInt(input);

            if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > shownCount) {
                console.log(`[CONTROL] ❌ Número fuera de rango (1-${shownCount})`);
                await flowDynamic(
                    `❌ Por favor, elegí un número entre *1* y *${shownCount}*, o *${otherDateOption}* para otra fecha`
                );
                return fallBack();
            }

            const selectedSlot = slots[selectedNumber - 1];
            console.log(`[CONTROL] ✅ Slot seleccionado: ${selectedSlot.displayText}`);

            const clientName: string = (await state.get('clientName')) ?? '';
            const appointmentType: string = (await state.get('appointmentType')) ?? 'Control';
            const slotDuration: number = (await state.get('slotDuration')) ?? 30;

            const eventData = {
                patientName: clientName,
                appointmentType: `${appointmentType} (${slotDuration} min)`,
                phone: ctx.from,
            };

            console.log('[CONTROL] 🔄 Creando cita en CitaMedica...');
            try {
                await createCitaMedicaAppointment(selectedSlot, eventData);
                console.log('[CONTROL] ✅ CITA CREADA EXITOSAMENTE');

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
                console.error('[CONTROL] ❌ Error al registrar turno:', error);
                await flowDynamic(
                    '❌ No se pudo confirmar el turno en este momento.\n' +
                    'Por favor, contactá directamente a la Dra. Villalba 📞'
                );
                await state.clear();
            }
        }
    );
