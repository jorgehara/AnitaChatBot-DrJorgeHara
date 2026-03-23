import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getTodayAndTomorrowSlots, AvailableSlot } from '../utils/calendarService.js';
import { createCitaMedicaAppointment } from '../utils/citaMedicaService.js';
import { customDateFlow } from './customDate.flow.js';

const MAX_SHOWN = 8;

export const newPatientFlow = addKeyword<Provider, IDBDatabase>(['__new_patient__'])
    .addAction(async (ctx, { state, flowDynamic }) => {
        // Verificar si ya tenemos el nombre del state (viene del mainMenu)
        const existingName = await state.get('clientName');
        
        if (existingName) {
            console.log(`[NEW_PATIENT] Nombre ya detectado: "${existingName}" — usando directamente`);
            await state.update({ appointmentType: 'Primera consulta ATM/Bruxismo' });
            await flowDynamic(`¡Genial ${existingName}! Para tu primera consulta necesito algunos datos 😊`);
        } else {
            console.log(`[NEW_PATIENT] Nombre NO detectado, preguntando...`);
            await flowDynamic(
                '¡Genial! Para tu primera consulta necesito algunos datos 😊\n\n' +
                '¿Me decís tu *nombre y apellido* completo?\n\n' +
                '_En cualquier momento podés escribir *cancelar* para salir_'
            );
        }
    })
    .addAnswer(
        '',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            // Si ya tiene nombre (de mainMenu), este paso se saltea capturando un mensaje vacío
            const existingName = await state.get('clientName');
            if (existingName) {
                console.log(`[NEW_PATIENT] Nombre ya existe, continuando flujo`);
                await state.update({ appointmentType: 'Primera consulta ATM/Bruxismo' });
                return; // No captura nada, continúa
            }

            console.log(`[NEW_PATIENT] Paso 1 — Nombre recibido: "${ctx.body}"`);
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            await state.update({
                clientName: ctx.body.trim(),
                appointmentType: 'Primera consulta ATM/Bruxismo',
            });
            console.log(`[NEW_PATIENT] Nombre guardado: "${ctx.body.trim()}"`);
        }
    )
    .addAnswer(
        '¿Contás con *radiografías o estudios previos* relacionados a la mandíbula o ATM?\n\n' +
        '1️⃣ Sí\n' +
        '2️⃣ No\n' +
        '3️⃣ No sé',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            console.log(`[NEW_PATIENT] Paso 2 — Estudios: "${ctx.body}"`);
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            const OPTIONS: Record<string, string> = { '1': 'Sí', '2': 'No', '3': 'No sabe' };
            const hasStudies = OPTIONS[ctx.body.trim()] ?? ctx.body.trim();
            await state.update({ hasStudies });
            console.log(`[NEW_PATIENT] Estudios guardado: "${hasStudies}"`);
        }
    )
    .addAnswer(
        '¿Actualmente usás alguna *placa dental, protector bucal* u otro dispositivo para dormir o durante el día?\n\n' +
        '1️⃣ Sí\n' +
        '2️⃣ No',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            console.log(`[NEW_PATIENT] Paso 3 — Dispositivo: "${ctx.body}"`);
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            const usesDevice = ctx.body.trim() === '1' ? 'Sí' : 'No';
            await state.update({ usesDevice });
            console.log(`[NEW_PATIENT] Dispositivo guardado: "${usesDevice}"`);
        }
    )
    .addAnswer(
        '⏳ *Buscando los próximos turnos disponibles...*',
        null,
        async (ctx, { state, flowDynamic }) => {
            console.log('[NEW_PATIENT] Paso 4 — Consultando Google Calendar (HOY + MAÑANA)...');
            try {
                const { today, tomorrow } = await getTodayAndTomorrowSlots(60);

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
                console.error('[NEW_PATIENT] Error obteniendo slots:', error);
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
            console.log(`[NEW_PATIENT] Paso 5 — Selección: "${input}" → número: ${selectedNumber}`);

            // Verificar si eligió "Otra fecha"
            if (input === otherDateOption) {
                console.log('[NEW_PATIENT] Usuario eligió "Otra fecha" → redirigiendo a customDateFlow');
                await state.update({ appointmentType: 'Primera consulta ATM/Bruxismo' });
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
            console.log(`[NEW_PATIENT] Slot seleccionado: ${selectedSlot.displayText}`);
            const clientName: string = await state.get('clientName') ?? '';
            const hasStudies: string = await state.get('hasStudies') ?? '';
            const usesDevice: string = await state.get('usesDevice') ?? '';

            const eventData = {
                patientName: clientName,
                appointmentType: 'Primera consulta ATM/Bruxismo (60 min)',
                phone: ctx.from,
                notes: `Estudios previos: ${hasStudies} | Usa dispositivo: ${usesDevice}`,
            };

            try {
                await createCitaMedicaAppointment(selectedSlot, eventData);

                await flowDynamic(
                    '✅ *¡Turno confirmado!* 🎉\n\n' +
                    `📅 *Fecha y hora:* ${selectedSlot.displayText}\n` +
                    `👤 *Paciente:* ${clientName}\n` +
                    '⏱️ *Duración:* 1 hora\n\n' +
                    '_Por favor, llegá 10 minutos antes con cualquier estudio previo que tengas._\n\n' +
                    '¡Nos vemos pronto! 😊'
                );
                await state.clear();
            } catch (error) {
                console.error('[NEW_PATIENT] Error al registrar turno:', error);
                await flowDynamic(
                    '❌ No se pudo confirmar el turno en este momento.\n' +
                    'Por favor, contactá directamente a la Dra. Villalba 📞'
                );
                await state.clear();
            }
        }
    );
