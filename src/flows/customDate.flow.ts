import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getSlotsByCustomDate, AvailableSlot } from '../utils/calendarService.js';
import { extractDateIntent } from '../utils/intentExtractor.js';

const MAX_SHOWN = 8;

/**
 * Formatea slots para mostrar al usuario con números
 */
function formatSlotsMessage(slots: AvailableSlot[]): string {
    const limited = slots.slice(0, MAX_SHOWN);
    const lines = limited.map((slot, i) => `${i + 1}. ${slot.displayText}`);
    
    let message = lines.join('\n\n');
    
    if (slots.length > MAX_SHOWN) {
        message += `\n\n_... y ${slots.length - MAX_SHOWN} turnos más disponibles_`;
    }
    
    message += '\n\n📝 *Respondé con el número del turno que te sirve*';
    message += '\n\n_O escribí *cancelar* para salir_';
    
    return message;
}

/**
 * Flow para búsqueda de turnos por fecha personalizada
 * Triggered cuando el usuario elige "Otra fecha" (opción 4)
 */
export const customDateFlow = addKeyword<Provider, IDBDatabase>(['__custom_date__'])
    .addAction(async (ctx, { flowDynamic }) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[CUSTOM_DATE] 🚀 INICIO DEL FLOW');
        console.log('[CUSTOM_DATE] From:', ctx.from);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        await flowDynamic(
            '📅 *Búsqueda personalizada*\n\n' +
            'Decime para qué día necesitás el turno.\n\n' +
            'Por ejemplo:\n' +
            '- "Martes 25"\n' +
            '- "Jueves que viene"\n' +
            '- "27 de marzo por la tarde"\n\n' +
            '_Escribí *cancelar* para volver al menú_'
        );
    })
    .addAnswer(
        '',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
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

                if (!dateIntent.date && !dateIntent.dayOfWeek) {
                    console.log('[CUSTOM_DATE] ❌ No se pudo entender la fecha');
                    await flowDynamic(
                        'No pude entender la fecha que mencionaste 😅\n\n' +
                        'Por favor, intentá de nuevo con un formato como:\n' +
                        '- "Martes 25"\n' +
                        '- "Jueves próximo"\n' +
                        '- "27 de marzo"'
                    );
                    return;
                }

                // Obtener duración del turno según tipo de consulta
                const appointmentType: string = (await state.get('appointmentType')) ?? 'Primera consulta ATM/Bruxismo';
                const slotDuration: 30 | 60 = appointmentType.includes('Primera consulta') ? 60 : 30;
                console.log('[CUSTOM_DATE] Duración de turno:', slotDuration, 'min');

                // Si tenemos fecha completa, buscar directamente
                if (dateIntent.date) {
                    console.log('[CUSTOM_DATE] 🔍 Buscando slots para fecha:', dateIntent.date);
                    const result = await getSlotsByCustomDate(dateIntent.date, slotDuration);
                    console.log('[CUSTOM_DATE] ✅ Slots encontrados:', result.slots.length);

                    if (result.slots.length === 0) {
                        console.log('[CUSTOM_DATE] ❌ Sin turnos disponibles');
                        await flowDynamic(
                            '😞 ' + result.message + '\n\n' +
                            '📞 Comunicate al *3735604949* para coordinar un turno.'
                        );
                        await state.clear();
                        return;
                    }

                    await state.update({ 
                        slotsCache: result.slots,
                        customDateSearch: true 
                    });
                    await flowDynamic(result.message);
                    await flowDynamic(formatSlotsMessage(result.slots));
                    return;
                }

                // Si solo tenemos día de semana, necesitamos calcular la fecha
                if (dateIntent.dayOfWeek) {
                    console.log('[CUSTOM_DATE] ⚠️  Solo día de semana detectado, pidiendo número');
                    // TODO: Implementar lógica para calcular próximo día de semana
                    await flowDynamic(
                        'Por ahora, necesito que me des el número de día también.\n' +
                        'Por ejemplo: "Martes 25" o "Jueves 27"'
                    );
                    return;
                }

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

            const input = ctx.body.trim().toLowerCase();
            console.log(`[CUSTOM_DATE] Selección recibida: "${input}"`);

            if (input === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. Escribí *hola* para empezar de nuevo.');
                return;
            }

            const selectedIndex = parseInt(input) - 1;

            if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= slotsCache.length) {
                await flowDynamic(
                    '❌ Opción inválida.\n\n' +
                    `Por favor, elegí un número entre 1 y ${Math.min(slotsCache.length, MAX_SHOWN)}`
                );
                return;
            }

            const selectedSlot = slotsCache[selectedIndex];
            console.log('[CUSTOM_DATE] Slot seleccionado:', selectedSlot.displayText);

            await state.update({ selectedSlot });
            await flowDynamic(`✅ Turno seleccionado: *${selectedSlot.displayText}*`);

            // Continuar con el flow de recolección de datos del paciente
            // (nombre, obra social, etc.) - esto se maneja en el flow padre
        }
    );
