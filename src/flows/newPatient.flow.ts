import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getTodayAndTomorrowSlots, AvailableSlot } from '../utils/calendarService.js';
import { createCitaMedicaAppointment } from '../utils/citaMedicaService.js';
import { customDateFlow } from './customDate.flow.js';

const MAX_SHOWN = 8;

export const newPatientFlow = addKeyword<Provider, IDBDatabase>(['__new_patient__'])
    .addAction(async (ctx, { state, flowDynamic }) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[NEW_PATIENT] 🚀 INICIO DEL FLOW');
        console.log('[NEW_PATIENT] From:', ctx.from);
        console.log('[NEW_PATIENT] Mensaje:', ctx.body);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Verificar si ya tenemos el nombre del state (viene del mainMenu)
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

                console.log('[NEW_PATIENT] ✅ Mostrando', allSlots.length, 'turnos');
                
                await state.update({ 
                    slotsCache: allSlots,
                    otherDateOption: optionNumber.toString()
                });
                await flowDynamic(message);
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
        async (ctx, { state, flowDynamic, fallBack, gotoFlow }) => {
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

            console.log('[NEW_PATIENT] Slots disponibles:', slots.length);
            console.log('[NEW_PATIENT] Opción "otra fecha":', otherDateOption);

            if (!slots.length) {
                console.log('[NEW_PATIENT] ❌ Sin slots en caché');
                await flowDynamic('❌ No hay turnos disponibles. Comunicate directamente con la Dra. Villalba 📞');
                await state.clear();
                return;
            }

            const selectedNumber = parseInt(input);
            console.log('[NEW_PATIENT] Número parseado:', selectedNumber);

            // Verificar si eligió "Otra fecha"
            if (input === otherDateOption) {
                console.log('[NEW_PATIENT] → Usuario eligió "Otra fecha"');
                await state.update({ appointmentType: 'Primera consulta ATM/Bruxismo' });
                return gotoFlow(customDateFlow);
            }

            if (isNaN(selectedNumber)) {
                console.log('[NEW_PATIENT] ❌ Input inválido (no es número)');
                await flowDynamic(
                    `❌ Por favor, elegí un número entre *1* y *${otherDateOption}*`
                );
                return fallBack();
            }

            const maxIndex = slots.length;
            if (selectedNumber < 1 || selectedNumber > maxIndex) {
                console.log(`[NEW_PATIENT] ❌ Número fuera de rango (1-${maxIndex})`);
                await flowDynamic(
                    `❌ Por favor, elegí un número entre *1* y *${maxIndex}*, o *${otherDateOption}* para otra fecha`
                );
                return fallBack();
            }

            const selectedSlot = slots[selectedNumber - 1];
            console.log('[NEW_PATIENT] ✅ Slot seleccionado:', selectedSlot.displayText);
            
            const clientName: string = await state.get('clientName') ?? '';
            const hasStudies: string = await state.get('hasStudies') ?? '';
            const usesDevice: string = await state.get('usesDevice') ?? '';

            console.log('[NEW_PATIENT] Datos del paciente:');
            console.log('  - Nombre:', clientName);
            console.log('  - Estudios:', hasStudies);
            console.log('  - Dispositivo:', usesDevice);

            const eventData = {
                patientName: clientName,
                appointmentType: 'Primera consulta ATM/Bruxismo (60 min)',
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
                    '⏱️ *Duración:* 1 hora\n\n' +
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
