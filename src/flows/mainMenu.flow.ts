import { addKeyword, EVENTS } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { newPatientFlow } from './newPatient.flow.js';
import { controlFlow } from './control.flow.js';
import { extractUserIntent } from '../utils/intentExtractor.js';

const MENU_TEXT =
    '🦷 *¡Bienvenido al consultorio de la Od. Melina Villalba!* 🦷\n\n' +
    'Soy ANITA, tu asistente virtual 😊\n\n' +
    '¿En qué puedo ayudarte?\n\n' +
    '1️⃣ Primera consulta (ATM / Bruxismo)\n' +
    '2️⃣ Control o seguimiento\n' +
    '3️⃣ Tengo dolor / urgencia\n\n' +
    '_Respondé con el número de tu opción_';

// EVENTS.WELCOME se activa SOLO cuando BuilderBot no encuentra ningún capture activo
// ni ningún flow que matchee la keyword. Es el comportamiento correcto para un menú
// de bienvenida — nunca interrumpe flows en curso.
export const mainMenuFlow = addKeyword<Provider, IDBDatabase>(EVENTS.WELCOME)
    .addAction(async (ctx, { state, flowDynamic }) => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[MENU] 🚀 MENÚ PRINCIPAL ACTIVADO');
        console.log('[MENU] From:', ctx.from);
        console.log('[MENU] Mensaje:', ctx.body);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const clientName = await state.get('clientName');
        const slotsCache = await state.get('slotsCache');
        const customDateMode = await state.get('customDateMode');

        console.log('[MENU] State check:');
        console.log('  - clientName:', clientName || '(vacío)');
        console.log('  - slotsCache:', slotsCache ? `${slotsCache.length} slots` : '(vacío)');
        console.log('  - customDateMode:', customDateMode || false);

        if (clientName || (slotsCache && slotsCache.length > 0) || customDateMode) {
            console.log('[MENU] ⚠️  Flujo activo detectado — no interrumpir');
            // Marcamos en state que el menú fue bloqueado para que el addAnswer también lo sepa
            await state.update({ _menuBlocked: true });
            return;
        }

        // Sin flujo activo: mostrar el menú AQUÍ, no en el addAnswer
        await state.update({ _menuBlocked: false });
        console.log('[MENU] ✅ Sin flujo activo, mostrando menú principal');
        await flowDynamic(MENU_TEXT);
    })
    .addAnswer(
        // String vacío — el texto ya se mandó desde addAction
        '',
        { capture: true },
        async (ctx, { gotoFlow, flowDynamic, state }) => {
            // Guard: si el menú fue bloqueado en addAction, ignorar este mensaje
            const menuBlocked = await state.get('_menuBlocked');
            if (menuBlocked) {
                console.log('[MENU] ⚠️  addAnswer bloqueado — flujo activo, ignorando mensaje');
                await state.update({ _menuBlocked: false }); // limpiar flag
                return;
            }

            const userMessage = ctx.body.trim();
            console.log('[MENU] 📝 PROCESANDO RESPUESTA DEL USUARIO');
            console.log('[MENU] Mensaje:', userMessage);

            let intent;
            try {
                console.log('[MENU] 🤖 Llamando a extractUserIntent (Claude Haiku)...');
                intent = await extractUserIntent(userMessage);
                console.log('[MENU] ✅ Intención extraída:', JSON.stringify(intent, null, 2));
            } catch (error) {
                console.error('[MENU] ❌ ERROR en intent extraction:', error);
                const firstChar = userMessage.trim()[0];
                if (firstChar === '1' || firstChar === '2' || firstChar === '3') {
                    intent = { option: firstChar as '1' | '2' | '3' };
                } else {
                    intent = {};
                }
            }

            const option = intent?.option;
            console.log('[MENU] Opción final:', option || '(ninguna)');

            if (!option) {
                const lowerMessage = userMessage.toLowerCase();
                if (lowerMessage.includes('turno') || lowerMessage.includes('cita') || lowerMessage.includes('consulta')) {
                    await flowDynamic(
                        '¡Claro! Te ayudo a reservar un turno 😊\n\n' +
                        'Primero, decime qué tipo de consulta necesitás:\n\n' +
                        '1️⃣ Primera consulta (ATM / Bruxismo)\n' +
                        '2️⃣ Control o seguimiento\n\n' +
                        'Respondé con *1* o *2*'
                    );
                } else if (lowerMessage.includes('dolor') || lowerMessage.includes('urgencia') || lowerMessage.includes('emergencia')) {
                    const emergencyPhone = process.env.EMERGENCY_PHONE_NUMBER || 'XXXXXXXXXX';
                    await flowDynamic(
                        '😟 Entiendo que estás con dolor.\n\n' +
                        'Para casos de urgencia, comunicate directamente con la Dra. Villalba:\n\n' +
                        `📞 *${emergencyPhone}*\n\n` +
                        '¡Esperamos poderte atender pronto! 💙'
                    );
                } else {
                    await flowDynamic(
                        'Para ayudarte mejor, elegí una opción:\n\n' +
                        '1️⃣ Primera consulta (ATM / Bruxismo)\n' +
                        '2️⃣ Control o seguimiento\n' +
                        '3️⃣ Tengo dolor / urgencia\n\n' +
                        'Respondé con *1*, *2* o *3*'
                    );
                }
                return;
            }

            if (intent.name) {
                await state.update({ clientName: intent.name });
            }
            if (intent.timePreference) {
                await state.update({ timePreference: intent.timePreference });
            }

            await state.update({ appointmentType: option === '1' ? 'Primera consulta ATM/Bruxismo' : 'Control o seguimiento' });

            if (option === '3') {
                const emergencyPhone = process.env.EMERGENCY_PHONE_NUMBER || 'XXXXXXXXXX';
                await flowDynamic(
                    '😟 Entiendo que estás con dolor.\n\n' +
                    'Para casos de urgencia, comunicate directamente con la Dra. Villalba:\n\n' +
                    `📞 *${emergencyPhone}*\n\n` +
                    '¡Esperamos poderte atender pronto! 💙'
                );
                return;
            }
        }
    )
    .addAnswer(
        '¡Genial! Para tu consulta necesito algunos datos 😊\n\n' +
        '¿Me decís tu *nombre y apellido* completo?\n\n' +
        '_En cualquier momento podés escribir *cancelar* para salir_',
        { capture: true },
        async (ctx, { state, flowDynamic, gotoFlow }) => {
            console.log('[MENU] 📝 CAPTURANDO NOMBRE');
            console.log('[MENU] Nombre recibido:', ctx.body);

            if (ctx.body.trim().toLowerCase() === 'cancelar') {
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }

            const nombre = ctx.body.trim();
            await state.update({ clientName: nombre });
            console.log('[MENU] ✅ Nombre guardado:', nombre);

            const appointmentType = await state.get('appointmentType');

            if (appointmentType === 'Primera consulta ATM/Bruxismo') {
                console.log('[MENU] → Redirigiendo a newPatientFlow');
                return gotoFlow(newPatientFlow);
            } else {
                console.log('[MENU] → Redirigiendo a controlFlow');
                return gotoFlow(controlFlow);
            }
        }
    );
