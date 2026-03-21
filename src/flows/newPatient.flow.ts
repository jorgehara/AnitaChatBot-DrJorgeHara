import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { getAvailableSlots, createCalendarEvent, AvailableSlot } from '../utils/calendarService';
import { formatSlotsMessage, filterSlotsByPreference } from '../utils/haikuService';

const MAX_SHOWN = 8;

export const newPatientFlow = addKeyword<Provider, IDBDatabase>(['__new_patient__'])
    .addAnswer(
        '¡Genial! Para tu primera consulta necesito algunos datos 😊\n\n' +
        '¿Me decís tu *nombre y apellido* completo?\n\n' +
        '_En cualquier momento podés escribir *cancelar* para salir_',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            await state.update({
                clientName: ctx.body.trim(),
                appointmentType: 'Primera consulta ATM/Bruxismo',
            });
        }
    )
    .addAnswer(
        '¿Contás con *radiografías o estudios previos* relacionados a la mandíbula o ATM?\n\n' +
        '1️⃣ Sí\n' +
        '2️⃣ No\n' +
        '3️⃣ No sé',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            const OPTIONS: Record<string, string> = { '1': 'Sí', '2': 'No', '3': 'No sabe' };
            const hasStudies = OPTIONS[ctx.body.trim()] ?? ctx.body.trim();
            await state.update({ hasStudies });
        }
    )
    .addAnswer(
        '¿Actualmente usás alguna *placa dental, protector bucal* u otro dispositivo para dormir o durante el día?\n\n' +
        '1️⃣ Sí\n' +
        '2️⃣ No',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            const usesDevice = ctx.body.trim() === '1' ? 'Sí' : 'No';
            await state.update({ usesDevice });
        }
    )
    .addAnswer(
        '⏳ *Buscando los próximos turnos disponibles...*',
        null,
        async (ctx, { state, flowDynamic }) => {
            try {
                const slots = await getAvailableSlots(60);

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

            // Texto libre → filtrar con Haiku
            if (isNaN(selectedNumber)) {
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
                    console.error('[NEW_PATIENT] Error en Haiku:', error);
                    await flowDynamic(formatSlotsMessage(slots));
                }
                return fallBack();
            }

            const maxIndex = Math.min(MAX_SHOWN, slots.length);
            if (selectedNumber < 1 || selectedNumber > maxIndex) {
                await flowDynamic(
                    `❌ Por favor, elegí un número entre *1* y *${maxIndex}*,\n` +
                    `o escribí tu preferencia de horario (ej: "martes a la tarde")`
                );
                return fallBack();
            }

            const selectedSlot = slots[selectedNumber - 1];
            const clientName: string = await state.get('clientName') ?? '';
            const hasStudies: string = await state.get('hasStudies') ?? '';
            const usesDevice: string = await state.get('usesDevice') ?? '';

            try {
                await createCalendarEvent(selectedSlot, {
                    patientName: clientName,
                    appointmentType: 'Primera consulta ATM/Bruxismo (60 min)',
                    phone: ctx.from,
                    notes: `Estudios previos: ${hasStudies} | Usa dispositivo: ${usesDevice}`,
                });

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
                console.error('[NEW_PATIENT] Error creando evento:', error);
                await flowDynamic(
                    '❌ No se pudo confirmar el turno en este momento.\n' +
                    'Por favor, contactá directamente a la Dra. Villalba 📞'
                );
                await state.clear();
            }
        }
    );
