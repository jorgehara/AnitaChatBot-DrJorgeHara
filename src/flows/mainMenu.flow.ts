import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { newPatientFlow } from './newPatient.flow.js';
import { controlFlow } from './control.flow.js';
import { extractUserIntent } from '../utils/intentExtractor.js';

const WELCOME_KEYWORDS = [
    'hi', 'hello', 'hola', 'buenas', 'buenos días', 'buenas tardes',
    'buenas noches', 'ho', 'ola', 'ole', 'turnos', 'turno',
].map(k => k.toLowerCase()) as [string, ...string[]];

export const mainMenuFlow = addKeyword<Provider, IDBDatabase>(WELCOME_KEYWORDS)
    .addAction(async (ctx, { state }) => {
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
            return;
        }
        console.log('[MENU] ✅ Sin flujo activo, mostrando menú principal');
    })
    .addAnswer(
        '🦷 *¡Bienvenido al consultorio de la Od. Melina Villalba!* 🦷\n\n' +
        'Soy ANITA, tu asistente virtual 😊\n\n' +
        '¿En qué puedo ayudarte?\n\n' +
        '1️⃣ Primera consulta (ATM / Bruxismo)\n' +
        '2️⃣ Control o seguimiento\n' +
        '3️⃣ Tengo dolor / urgencia\n\n' +
        '_Respondé con el número de tu opción_',
        { capture: true },
        async (ctx, { gotoFlow, flowDynamic, state }) => {
            // ⚠️ Guard doble: el addAction bloquea el flow pero el addAnswer
            // igual captura el siguiente mensaje. Re-chequeamos el state acá.
            const activeClientName = await state.get('clientName');
            const activeSlots = await state.get('slotsCache');
            const activeCustomDate = await state.get('customDateMode');
            if (activeClientName || (activeSlots && activeSlots.length > 0) || activeCustomDate) {
                console.log('[MENU] ⚠️  Guard en addAnswer — flujo activo, ignorando mensaje');
                return;
            }

            const userMessage = ctx.body.trim();
            console.log('[MENU] 📝 PROCESANDO RESPUESTA DEL USUARIO');
            console.log('[MENU] Mensaje:', userMessage);

            let intent;
            try {
                console.log('[MENU] 🤖 Llamando a extractUserIntent (Claude Haiku)...');
                // Extraer intención con Claude Haiku (detecta opción + nombre + preferencia horaria)
                intent = await extractUserIntent(userMessage);
                console.log('[MENU] ✅ Intención extraída:', JSON.stringify(intent, null, 2));
            } catch (error) {
                console.error('[MENU] ❌ ERROR en intent extraction:', error);
                // Fallback: intentar detectar solo número
                const firstChar = userMessage.trim()[0];
                console.log('[MENU] 🔄 Fallback: detectando número manualmente. Primer carácter:', firstChar);
                if (firstChar === '1' || firstChar === '2' || firstChar === '3') {
                    intent = { option: firstChar as '1' | '2' | '3' };
                    console.log('[MENU] ✅ Opción detectada (fallback):', firstChar);
                } else {
                    intent = {};
                    console.log('[MENU] ❌ No se detectó opción válida');
                }
            }

            const option = intent?.option;
            console.log('[MENU] Opción final:', option || '(ninguna)');

            if (!option) {
                console.log('[MENU] ⚠️  Sin opción detectada, dando ayuda contextual...');
                // Si no detectamos opción, ayudar al usuario con un mensaje más inteligente
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

            // Si el usuario incluyó su nombre o preferencia, guardarlos en el state
            if (intent.name) {
                console.log(`[MENU] ✅ Nombre detectado por IA: "${intent.name}"`);
                console.log('[MENU] 💾 Guardando nombre en state...');
                await state.update({ clientName: intent.name });
                console.log('[MENU] ✅ Nombre guardado en state');
            }
            if (intent.timePreference) {
                console.log(`[MENU] ✅ Preferencia horaria detectada: "${intent.timePreference}"`);
                console.log('[MENU] 💾 Guardando preferencia en state...');
                await state.update({ timePreference: intent.timePreference });
                console.log('[MENU] ✅ Preferencia guardada en state');
            }

            // Guardar tipo de consulta en state
            await state.update({ appointmentType: option === '1' ? 'Primera consulta ATM/Bruxismo' : 'Control o seguimiento' });

            if (option === '3') {
                console.log('[MENU] → Opción 3: Urgencia/dolor');
                const emergencyPhone = process.env.EMERGENCY_PHONE_NUMBER || 'XXXXXXXXXX';
                await flowDynamic(
                    '😟 Entiendo que estás con dolor.\n\n' +
                    'Para casos de urgencia, comunicate directamente con la Dra. Villalba:\n\n' +
                    `📞 *${emergencyPhone}*\n\n` +
                    '¡Esperamos poderte atender pronto! 💙'
                );
                return;
            }

            // Para opción 1 o 2, no hacer gotoFlow, sino continuar en el MISMO flow
            // El siguiente addAnswer va a capturar el nombre
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
                console.log('[MENU] ❌ Usuario canceló');
                await state.clear();
                await flowDynamic('❌ Reserva cancelada. ¡Hasta pronto! 👋');
                return;
            }
            
            const nombre = ctx.body.trim();
            await state.update({ clientName: nombre });
            console.log('[MENU] ✅ Nombre guardado:', nombre);
            
            // Ahora sí, redirigir al flow correspondiente usando la keyword interna
            const appointmentType = await state.get('appointmentType');
            
            if (appointmentType === 'Primera consulta ATM/Bruxismo') {
                console.log('[MENU] → Redirigiendo a newPatientFlow (con keyword)');
                return gotoFlow(newPatientFlow);
            } else {
                console.log('[MENU] → Redirigiendo a controlFlow (con keyword)');
                return gotoFlow(controlFlow);
            }
        }
    );
