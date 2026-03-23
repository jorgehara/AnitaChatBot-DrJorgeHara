import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getTodayAndTomorrowSlots, getSlotsByCustomDate, AvailableSlot } from '../utils/calendarService.js';
import { createCitaMedicaAppointment } from '../utils/citaMedicaService.js';
import { extractDateIntent } from '../utils/intentExtractor.js';

const MAX_SHOWN = 8;

/**
 * Construye el mensaje de lista de slots con el formato estándar del bot:
 * agrupado por día, numerado consecutivamente, con opción "Buscar otra fecha" al final.
 * Un solo string → un solo flowDynamic → un solo mensaje de WhatsApp.
 */
function buildSlotsMessage(
    headerLine: string,
    allSlots: AvailableSlot[],
    otherDateNumber: number
): string {
    const limited = allSlots.slice(0, MAX_SHOWN);

    // Agrupar por fecha (slot.date es 'yyyy-MM-dd')
    const byDate = new Map<string, AvailableSlot[]>();
    for (const slot of limited) {
        if (!byDate.has(slot.date)) byDate.set(slot.date, []);
        byDate.get(slot.date)!.push(slot);
    }

    let msg = headerLine + '\n\n';
    let n = 1;

    for (const [, daySlots] of byDate) {
        // "Martes 24/03 — 16:00 hs" → label = "MAÑANA" o "Martes 24/03"
        const parts = daySlots[0].displayText.split(' — ');
        const dayLabel = parts[0]; // "Martes 24/03"
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

export const newPatientFlow = addKeyword<Provider, IDBDatabase>(['__new_patient__'])
    .addAction(async (ctx, { state, flowDynamic }) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[NEW_PATIENT] 🚀 INICIO DEL FLOW');
        console.log('[NEW_PATIENT] From:', ctx.from);
        console.log('[NEW_PATIENT] Mensaje:', ctx.body);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const existingName = await state.get('clientName');

        console.log('[NEW_PATIENT] State actual:');
        console.log('  - clientName:', existingName || '(vacío)');
        console.log('  - appointmentType:', await state.get('appointmentType') || '(vacío)');

        if (!existingName) {
            console.log('[NEW_PATIENT] ❌ ERROR: No hay nombre en el state');
            await flowDynamic('❌ Hubo un error. Por favor, empezá de nuevo escribiendo "hola"');
            await state.clear();
            return;
        }

        console.log(`[NEW_PATIENT] ✅ Nombre detectado: "${existingName}"`);
        await state.update({ appointmentType: 'Primera consulta ATM/Bruxismo' });
    })
    .addAnswer(
        '¿Contás con *radiografías o estudios previos* relacionados a la mandíbula o ATM?\n\n' +
        '1️⃣ Sí\n' +
        '2️⃣ No\n' +
        '3️⃣ No sé',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            console.log('[NEW_PATIENT] 📝 PASO 2: Estudios previos');
            console.log('[NEW_PATIENT] Respuesta:', ctx.body);

            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                console.log('[NEW_PATIENT] ❌ Usuario canceló');
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            const OPTIONS: Record<string, string> = { '1': 'Sí', '2': 'No', '3': 'No sabe' };
            const hasStudies = OPTIONS[ctx.body.trim()] ?? ctx.body.trim();
            await state.update({ hasStudies });
            console.log(`[NEW_PATIENT] ✅ Estudios guardado: "${hasStudies}"`);
        }
    )
    .addAnswer(
        '¿Actualmente usás alguna *placa dental, protector bucal* u otro dispositivo para dormir o durante el día?\n\n' +
        '1️⃣ Sí\n' +
        '2️⃣ No',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            console.log('[NEW_PATIENT] 📝 PASO 3: Dispositivo dental');
            console.log('[NEW_PATIENT] Respuesta:', ctx.body);

            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                console.log('[NEW_PATIENT] ❌ Usuario canceló');
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            const usesDevice = ctx.body.trim() === '1' ? 'Sí' : 'No';
            await state.update({ usesDevice });
            console.log(`[NEW_PATIENT] ✅ Dispositivo guardado: "${usesDevice}"`);
        }
    )
    .addAnswer(
        '⏳ *Buscando los próximos turnos disponibles...*',
        null,
        async (ctx, { state, flowDynamic }) => {
            console.log('[NEW_PATIENT] 🔍 PASO 4: Consultando Google Calendar');
            try {
                const { today, tomorrow } = await getTodayAndTomorrowSlots(60);

                console.log('[NEW_PATIENT] Turnos HOY:', today.length);
                console.log('[NEW_PATIENT] Turnos MAÑANA:', tomorrow.length);

                if (!today.length && !tomorrow.length) {
                    console.log('[NEW_PATIENT] ❌ Sin turnos disponibles');
                    await flowDynamic(
                        '❌ No hay turnos disponibles hoy ni mañana.\n\n' +
                        'Comunicate directamente con la Dra. Villalba para coordinar 📞'
                    );
                    await state.clear();
                    return;
                }

                const allSlots: AvailableSlot[] = [];
                let optionNumber = 1;

                // Construir header y slots manualmente para el formato estándar
                let msg = '📅 *Turnos disponibles:*\n\n';

                if (today.length > 0) {
                    msg += '🔹 *HOY*\n';
                    today.slice(0, 4).forEach(slot => {
                        msg += `${optionNumber}. ${slot.displayText}\n`;
                        allSlots.push(slot);
                        optionNumber++;
                    });
                    msg += '\n';
                }

                if (tomorrow.length > 0) {
                    msg += '🔹 *MAÑANA*\n';
                    tomorrow.slice(0, 4).forEach(slot => {
                        msg += `${optionNumber}. ${slot.displayText}\n`;
                        allSlots.push(slot);
                        optionNumber++;
                    });
                    msg += '\n';
                }

                msg += `${optionNumber}. 📆 Buscar otra fecha\n\n`;
                msg += '📝 *Respondé con el número del turno que te sirve*\n';
                msg += '_O escribí *cancelar* para salir_';

                console.log('[NEW_PATIENT] ✅ Mostrando', allSlots.length, 'turnos');

                await state.update({
                    slotsCache: allSlots,
                    otherDateOption: optionNumber.toString(),
                    customDateMode: false,
                });
                await flowDynamic(msg);
            } catch (error) {
                console.error('[NEW_PATIENT] ❌ ERROR obteniendo slots:', error);
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
            console.log('[NEW_PATIENT] 📝 PASO 5: Selección de turno');
            console.log('[NEW_PATIENT] Input usuario:', input);

            if (input.toLowerCase() === 'cancelar') {
                console.log('[NEW_PATIENT] ❌ Usuario canceló');
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }

            const slots: AvailableSlot[] = (await state.get('slotsCache')) ?? [];
            const otherDateOption: string = (await state.get('otherDateOption')) ?? '99';
            const shownCount = Math.min(slots.length, MAX_SHOWN);
            // ⚠️ customDateMode se lee ANTES del guard de slots vacíos:
            // cuando el user escribe la fecha, slotsCache está intencionalmente vacío
            const customDateMode: boolean = (await state.get('customDateMode')) ?? false;

            console.log('[NEW_PATIENT] Slots en cache:', slots.length);
            console.log('[NEW_PATIENT] Opción "otra fecha":', otherDateOption);
            console.log('[NEW_PATIENT] customDateMode:', customDateMode);

            // ── Está en modo búsqueda por fecha (customDateMode) ────────────────
            if (customDateMode) {
                console.log('[NEW_PATIENT] → Procesando fecha personalizada:', input);
                await flowDynamic('🔍 *Buscando turnos disponibles...*');

                try {
                    const dateIntent = await extractDateIntent(input);
                    console.log('[NEW_PATIENT] Fecha extraída:', JSON.stringify(dateIntent));

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

                    const appointmentType: string = (await state.get('appointmentType')) ?? 'Primera consulta ATM/Bruxismo';
                    const slotDuration: 30 | 60 = appointmentType.includes('Primera consulta') ? 60 : 30;

                    const result = await getSlotsByCustomDate(dateIntent.date, slotDuration);
                    console.log('[NEW_PATIENT] Slots encontrados para fecha custom:', result.slots.length);

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
                        customDateMode: false, // volvemos al modo selección normal
                    });

                    await flowDynamic(buildSlotsMessage(result.message, result.slots, newOtherDateNum));
                    return fallBack(); // ← vuelve a este capture esperando la selección del slot

                } catch (error) {
                    console.error('[NEW_PATIENT] ❌ ERROR en búsqueda por fecha:', error);
                    await flowDynamic('❌ Hubo un error al buscar turnos. Intentá de nuevo o comunicate al *3735604949*.');
                    return fallBack();
                }
            }

            // ── Guard: sin slots y no en customDateMode → error real ───────────────
            if (!slots.length) {
                console.log('[NEW_PATIENT] ❌ Sin slots en caché (fuera de customDateMode)');
                await flowDynamic('❌ No hay turnos disponibles. Comunicate directamente con la Dra. Villalba 📞');
                await state.clear();
                return;
            }

            // ── Eligió "Buscar otra fecha" ──────────────────────────────────────
            if (input === otherDateOption) {
                console.log('[NEW_PATIENT] → Modo búsqueda por fecha personalizada');
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

            // ── Selección de slot normal ─────────────────────────────────────────
            const selectedNumber = parseInt(input);

            if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > shownCount) {
                console.log(`[NEW_PATIENT] ❌ Número fuera de rango (1-${shownCount})`);
                await flowDynamic(
                    `❌ Por favor, elegí un número entre *1* y *${shownCount}*, o *${otherDateOption}* para otra fecha`
                );
                return fallBack();
            }

            const selectedSlot = slots[selectedNumber - 1];
            console.log('[NEW_PATIENT] ✅ Slot seleccionado:', selectedSlot.displayText);

            const clientName: string = (await state.get('clientName')) ?? '';
            const hasStudies: string = (await state.get('hasStudies')) ?? '';
            const usesDevice: string = (await state.get('usesDevice')) ?? '';
            const appointmentType: string = (await state.get('appointmentType')) ?? 'Primera consulta ATM/Bruxismo';

            console.log('[NEW_PATIENT] Datos del paciente:');
            console.log('  - Nombre:', clientName);
            console.log('  - Estudios:', hasStudies);
            console.log('  - Dispositivo:', usesDevice);

            const eventData = {
                patientName: clientName,
                appointmentType: appointmentType.includes('Primera consulta')
                    ? 'Primera consulta ATM/Bruxismo (60 min)'
                    : 'Control o seguimiento (30 min)',
                phone: ctx.from,
                notes: `Estudios previos: ${hasStudies} | Usa dispositivo: ${usesDevice}`,
            };

            console.log('[NEW_PATIENT] 🔄 Creando cita en CitaMedica...');
            try {
                await createCitaMedicaAppointment(selectedSlot, eventData);
                console.log('[NEW_PATIENT] ✅ CITA CREADA EXITOSAMENTE');

                await flowDynamic(
                    '✅ *¡Turno confirmado!* 🎉\n\n' +
                    `📅 *Fecha y hora:* ${selectedSlot.displayText}\n` +
                    `👤 *Paciente:* ${clientName}\n` +
                    `⏱️ *Duración:* ${appointmentType.includes('Primera consulta') ? '1 hora' : '30 minutos'}\n\n` +
                    '_Por favor, llegá 10 minutos antes con cualquier estudio previo que tengas._\n\n' +
                    '¡Nos vemos pronto! 😊'
                );
                await state.clear();
            } catch (error) {
                console.error('[NEW_PATIENT] ❌ ERROR al crear cita:', error);
                await flowDynamic(
                    '❌ No se pudo confirmar el turno en este momento.\n' +
                    'Por favor, contactá directamente a la Dra. Villalba 📞'
                );
                await state.clear();
            }
        }
    );
