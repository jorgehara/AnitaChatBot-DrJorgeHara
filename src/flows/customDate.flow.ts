import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getSlotsByCustomDate, AvailableSlot } from '../utils/calendarService.js';
import { extractDateIntent } from '../utils/intentExtractor.js';
import { createCitaMedicaAppointment } from '../utils/citaMedicaService.js';

const MAX_SHOWN = 8;

/**
 * Formatea slots en el mismo formato que newPatientFlow:
 * agrupados por día, numerados consecutivamente, sin línea en blanco entre cada opción.
 * Todo en un solo string para mandar en un único flowDynamic.
 */
function buildSlotsMessage(headerMessage: string, slots: AvailableSlot[]): string {
    const limited = slots.slice(0, MAX_SHOWN);

    // Agrupar por fecha (slot.date es 'yyyy-MM-dd')
    const byDate = new Map<string, AvailableSlot[]>();
    for (const slot of limited) {
        if (!byDate.has(slot.date)) byDate.set(slot.date, []);
        byDate.get(slot.date)!.push(slot);
    }

    let message = headerMessage + '\n\n';
    let optionNumber = 1;

    for (const [, daySlots] of byDate) {
        // Extraer el nombre del día del displayText (ej: "Martes 24/03 — 16:00 hs" → "Martes 24/03")
        const dayLabel = daySlots[0].displayText.split(' — ')[0]; // "Martes 24/03"
        message += `🔹 *${dayLabel.toUpperCase()}*\n`;
        for (const slot of daySlots) {
            const timeOnly = slot.displayText.split(' — ')[1]; // "16:00 hs"
            message += `${optionNumber}. ${daySlots[0].displayText.split(' — ')[0]} — ${timeOnly}\n`;
            optionNumber++;
        }
        message += '\n';
    }

    if (slots.length > MAX_SHOWN) {
        message += `_... y ${slots.length - MAX_SHOWN} turnos más disponibles_\n\n`;
    }

    message += `${optionNumber}. 📆 Buscar otra fecha\n\n`;
    message += '📝 *Respondé con el número del turno que te sirve*\n';
    message += '_O escribí *cancelar* para salir_';

    return message;
}

/**
 * Flow para búsqueda de turnos por fecha personalizada
 * Triggered cuando el usuario elige "Otra fecha" (opción 4)
 * 
 * IMPORTANTE: No usar addAction + addAnswer con capture después de gotoFlow()
 * Bug de BuilderBot: el capture no funciona. Solución: todo en un solo addAnswer.
 */
export const customDateFlow = addKeyword<Provider, IDBDatabase>(['__custom_date__'])
    .addAnswer(
        '📅 *Búsqueda personalizada*\n\n' +
        'Decime para qué día necesitás el turno.\n\n' +
        'Por ejemplo:\n' +
        '- "Martes 25"\n' +
        '- "Jueves que viene"\n' +
        '- "27 de marzo por la tarde"\n\n' +
        '_Escribí *cancelar* para volver al menú_',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('[CUSTOM_DATE] 🚀 INICIO DEL FLOW - CAPTURANDO FECHA');
            console.log('[CUSTOM_DATE] From:', ctx.from);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`[CUSTOM_DATE] 📝 Mensaje recibido: "${ctx.body}"`);
            
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                console.log('[CUSTOM_DATE] ❌ Usuario canceló');
                await state.clear();
                await flowDynamic('❌ Búsqueda cancelada. Escribí *hola* para empezar de nuevo.');
                return;
            }

            await flowDynamic('🔍 *Buscando turnos disponibles...*');

            try {
                // Extraer intención de fecha con Claude Haiku
                console.log('[CUSTOM_DATE] 🤖 Llamando a extractDateIntent...');
                const dateIntent = await extractDateIntent(ctx.body);
                console.log('[CUSTOM_DATE] ✅ Intención de fecha:', JSON.stringify(dateIntent));

                if (!dateIntent.date) {
                    console.log('[CUSTOM_DATE] ❌ Haiku no pudo determinar la fecha');
                    await flowDynamic(
                        'No pude entender la fecha que mencionaste 😅\n\n' +
                        'Por favor, intentá de nuevo con un formato como:\n' +
                        '- "Martes 25"\n' +
                        '- "El jueves que viene"\n' +
                        '- "27 de marzo"'
                    );
                    return;
                }

                // Obtener duración del turno según tipo de consulta
                const appointmentType: string = (await state.get('appointmentType')) ?? 'Primera consulta ATM/Bruxismo';
                const slotDuration: 30 | 60 = appointmentType.includes('Primera consulta') ? 60 : 30;
                console.log('[CUSTOM_DATE] Duración de turno:', slotDuration, 'min');

                console.log('[CUSTOM_DATE] 🔍 Buscando slots para fecha:', dateIntent.date);
                const result = await getSlotsByCustomDate(dateIntent.date, slotDuration);
                console.log('[CUSTOM_DATE] ✅ Slots encontrados:', result.slots.length);

                if (result.slots.length === 0) {
                    console.log('[CUSTOM_DATE] ❌ Sin turnos disponibles en próximos 7 días');
                    await flowDynamic(
                        '😞 No hay turnos disponibles en los próximos días para la fecha que solicitaste.\n\n' +
                        '💡 *Opciones*:\n' +
                        '1️⃣ Escribí otra fecha (ej: "Lunes próximo", "31 de marzo")\n' +
                        '2️⃣ Escribí *cancelar* para volver al menú\n' +
                        '3️⃣ Comunicate al *3735604949* para coordinar directamente'
                    );
                    return;
                }

                await state.update({ 
                    slotsCache: result.slots,
                    customDateSearch: true,
                    // guardamos cuántos slots mostramos para validar la selección
                    otherDateOption: String(Math.min(result.slots.length, MAX_SHOWN) + 1),
                });
                await flowDynamic(buildSlotsMessage(result.message, result.slots));

            } catch (error) {
                console.error('[CUSTOM_DATE] Error en búsqueda:', error);
                await flowDynamic(
                    '❌ Hubo un error al buscar turnos.\n\n' +
                    'Por favor, intentá de nuevo o comunicate al *3735604949*.'
                );
                await state.clear();
            }
        }
    )
    .addAnswer(
        '',
        { capture: true },
        async (ctx, { state, flowDynamic, gotoFlow }) => {
            const slotsCache: AvailableSlot[] = (await state.get('slotsCache')) ?? [];
            
            if (!slotsCache.length) {
                console.log('[CUSTOM_DATE] No hay slots en cache, ignorando captura');
                return;
            }

            const input = ctx.body.trim();
            console.log(`[CUSTOM_DATE] Selección recibida: "${input}"`);

            if (input.toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. Escribí *hola* para empezar de nuevo.');
                return;
            }

            const otherDateOption: string = (await state.get('otherDateOption')) ?? '99';
            const shownCount = Math.min(slotsCache.length, MAX_SHOWN);

            // Si eligió "Buscar otra fecha"
            if (input === otherDateOption) {
                console.log('[CUSTOM_DATE] → Usuario eligió "Buscar otra fecha"');
                // Limpiar slotsCache para que el primer addAnswer pueda volver a capturar
                await state.update({ slotsCache: [], customDateSearch: false });
                await flowDynamic(
                    '📅 *Búsqueda personalizada*\n\n' +
                    'Decime para qué otro día necesitás el turno.\n\n' +
                    '_Escribí *cancelar* para salir_'
                );
                return;
            }

            const selectedIndex = parseInt(input) - 1;

            if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= shownCount) {
                await flowDynamic(
                    `❌ Opción inválida.\n\nPor favor, elegí un número entre *1* y *${shownCount}*, o *${otherDateOption}* para buscar otra fecha.`
                );
                return;
            }

            const selectedSlot = slotsCache[selectedIndex];
            console.log('[CUSTOM_DATE] Slot seleccionado:', selectedSlot.displayText);

            // Recuperar datos del paciente del state (vienen de newPatientFlow/controlFlow via mainMenu)
            const clientName: string = (await state.get('clientName')) ?? '';
            const hasStudies: string = (await state.get('hasStudies')) ?? '';
            const usesDevice: string = (await state.get('usesDevice')) ?? '';
            const appointmentType: string = (await state.get('appointmentType')) ?? 'Primera consulta ATM/Bruxismo';

            console.log('[CUSTOM_DATE] Datos del paciente:');
            console.log('  - Nombre:', clientName);
            console.log('  - Tipo:', appointmentType);

            const eventData = {
                patientName: clientName,
                appointmentType: appointmentType.includes('Primera consulta')
                    ? 'Primera consulta ATM/Bruxismo (60 min)'
                    : 'Control o seguimiento (30 min)',
                phone: ctx.from,
                notes: `Estudios previos: ${hasStudies} | Usa dispositivo: ${usesDevice}`,
            };

            console.log('[CUSTOM_DATE] 🔄 Creando cita en CitaMedica...');
            try {
                await createCitaMedicaAppointment(selectedSlot, eventData);
                console.log('[CUSTOM_DATE] ✅ CITA CREADA EXITOSAMENTE');

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
                console.error('[CUSTOM_DATE] ❌ ERROR al crear cita:', error);
                await flowDynamic(
                    '❌ No se pudo confirmar el turno en este momento.\n' +
                    'Por favor, contactá directamente a la Dra. Villalba 📞'
                );
                await state.clear();
            }
        }
    );
