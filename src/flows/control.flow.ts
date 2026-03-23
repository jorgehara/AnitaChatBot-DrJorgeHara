import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getTodayAndTomorrowSlots, AvailableSlot } from '../utils/calendarService.js';
import { createCitaMedicaAppointment } from '../utils/citaMedicaService.js';
import { customDateFlow } from './customDate.flow.js';

const MAX_SHOWN = 8;

const CONTROL_TYPES: Record<string, { label: string; duration: 30 | 60 }> = {
    '1': { label: 'Control de placa (ajuste/estabilización)', duration: 30 },
    '2': { label: 'Segunda visita / control', duration: 30 },
    '3': { label: 'Reparación de placa', duration: 60 },
};

export const controlFlow = addKeyword<Provider, IDBDatabase>(['__control__'])
    .addAction(async (ctx, { state, flowDynamic }) => {
        // Verificar si ya tenemos el nombre del state (viene del mainMenu)
        const existingName = await state.get('clientName');
        
        if (existingName) {
            console.log(`[CONTROL] Nombre ya detectado: "${existingName}" — usando directamente`);
            await flowDynamic(`¡Hola ${existingName}! Para tu control, necesito algunos datos 😊`);
        } else {
            console.log(`[CONTROL] Nombre NO detectado, preguntando...`);
            await flowDynamic(
                '¡Hola! Para tu control, necesito algunos datos 😊\n\n' +
                '¿Me decís tu *nombre y apellido* completo?\n\n' +
                '_En cualquier momento podés escribir *cancelar* para salir_'
            );
        }
    })
    .addAnswer(
        '',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            // Si ya tiene nombre (de mainMenu), este paso se saltea
            const existingName = await state.get('clientName');
            if (existingName) {
                console.log(`[CONTROL] Nombre ya existe, continuando flujo`);
                return; // No captura nada, continúa
            }

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
            console.log(`[CONTROL] Paso 3 — Consultando Google Calendar (HOY + MAÑANA, ${slotDuration} min)...`);
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

                // Construir mensaje con turnos de HOY y MAÑANA
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
                    otherDateOption: optionNumber.toString()
                });
                await flowDynamic(message);
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
        async (ctx, { state, flowDynamic, fallBack, gotoFlow }) => {
            const input = ctx.body.trim();

            if (input.toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }

            const slots: AvailableSlot[] = (await state.get('slotsCache')) ?? [];
            const otherDateOption: string = (await state.get('otherDateOption')) ?? '99';

            if (!slots.length) {
                await flowDynamic('❌ No hay turnos disponibles. Comunicate directamente con la Dra. Villalba 📞');
                await state.clear();
                return;
            }

            const selectedNumber = parseInt(input);
            console.log(`[CONTROL] Paso 4 — Selección: "${input}" → número: ${selectedNumber}`);

            // Verificar si eligió "Otra fecha"
            if (input === otherDateOption) {
                console.log('[CONTROL] Usuario eligió "Otra fecha" → redirigiendo a customDateFlow');
                return gotoFlow(customDateFlow);
            }

            if (isNaN(selectedNumber)) {
                await flowDynamic(
                    `❌ Por favor, elegí un número entre *1* y *${otherDateOption}*`
                );
                return fallBack();
            }

            const maxIndex = slots.length;
            if (selectedNumber < 1 || selectedNumber > maxIndex) {
                await flowDynamic(
                    `❌ Por favor, elegí un número entre *1* y *${maxIndex}*, o *${otherDateOption}* para otra fecha`
                );
                return fallBack();
            }

            const selectedSlot = slots[selectedNumber - 1];
            console.log(`[CONTROL] Slot seleccionado: ${selectedSlot.displayText}`);
            const clientName: string = (await state.get('clientName')) ?? '';
            const appointmentType: string = (await state.get('appointmentType')) ?? 'Control';
            const slotDuration: number = (await state.get('slotDuration')) ?? 30;

            const eventData = {
                patientName: clientName,
                appointmentType: `${appointmentType} (${slotDuration} min)`,
                phone: ctx.from,
            };

            try {
                await createCitaMedicaAppointment(selectedSlot, eventData);

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
                console.error('[CONTROL] Error al registrar turno:', error);
                await flowDynamic(
                    '❌ No se pudo confirmar el turno en este momento.\n' +
                    'Por favor, contactá directamente a la Dra. Villalba 📞'
                );
                await state.clear();
            }
        }
    );
