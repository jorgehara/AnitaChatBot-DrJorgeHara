import { addKeyword } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { newPatientFlow } from './newPatient.flow';
import { controlFlow } from './control.flow';

const WELCOME_KEYWORDS = [
    'hi', 'hello', 'hola', 'buenas', 'buenos días', 'buenas tardes',
    'buenas noches', 'ho', 'ola', 'ole', 'turnos', 'turno',
].map(k => k.toLowerCase()) as [string, ...string[]];

export const mainMenuFlow = addKeyword<Provider, IDBDatabase>(WELCOME_KEYWORDS)
    .addAction(async (ctx, { state }) => {
        // No interrumpir si hay un flujo activo
        const clientName = await state.get('clientName');
        const slotsCache = await state.get('slotsCache');
        if (clientName || slotsCache) return;
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
        async (ctx, { gotoFlow, flowDynamic }) => {
            const option = ctx.body.trim();

            if (option === '1') return gotoFlow(newPatientFlow);
            if (option === '2') return gotoFlow(controlFlow);

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

            await flowDynamic('❌ Opción no válida. Por favor, respondé con *1*, *2* o *3*.');
        }
    );
