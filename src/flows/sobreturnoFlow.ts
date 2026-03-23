import { addKeyword } from '@builderbot/bot';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { APP_CONFIG } from '../config/app.js';
import { formatearFechaEspanol } from '../utils/dateFormatter.js';
import sobreturnoService, { SobreturnoResponse } from '../utils/sobreturnoService.js';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';

interface SobreturnoState {
    clientName?: string;
    socialWork?: string;
    appointmentDate?: string;
    availableSobreturnos?: SobreturnoResponse[];
    invalidName?: boolean;
}

export const bookSobreturnoFlow = addKeyword<Provider, IDBDatabase>(['sobreturnos'])
    .addAnswer(
        '🏥 *SOLICITUD DE SOBRETURNO*\n\n' +
        'Has solicitado un *sobreturno*. Para continuar, necesito algunos datos.\n\n' +
        'Por favor, indícame tu *NOMBRE* y *APELLIDO* (ej: Juan Pérez):',
        { capture: true },
        async (ctx, { flowDynamic, state }) => {
            console.log('[SOBRETURNO] Paso 1: Nombre recibido:', ctx.body);
            const name = ctx.body.trim();

            // Limpiar y normalizar el nombre
            const cleanName = name.replace(/[^A-Za-záéíóúñÁÉÍÓÚÑ\s]/g, '').trim();
            const words = cleanName.split(/\s+/).filter(word => word.length > 1);

            // Validaciones
            if (words.length < 2) {
                await flowDynamic('❌ Por favor, ingresa tanto tu nombre como tu apellido correctamente.');
                await state.update({ invalidName: true });
                return;
            }

            if (name !== cleanName) {
                await flowDynamic('❌ El nombre solo debe contener letras (sin números ni caracteres especiales).');
                await state.update({ invalidName: true });
                return;
            }

            // Capitalizar cada palabra
            const formattedName = words
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

            await state.update({ 
                clientName: formattedName,
                invalidName: false 
            });
            
            await flowDynamic(`✅ Gracias, ${words[0]}!`);
        }
    )
    .addAnswer(
        '*Perfecto!* Ahora selecciona tu *OBRA SOCIAL* de la siguiente lista:\n\n' +
        '1️⃣ INSSSEP\n' +
        '2️⃣ Swiss Medical\n' +
        '3️⃣ OSDE\n' +
        '4️⃣ Galeno\n' +
        '5️⃣ CONSULTA PARTICULAR\n' +
        '6️⃣ Otras Obras Sociales\n\n' +
        '_Responde con el número correspondiente (1-6):_',
        { capture: true },
        async (ctx, { state, flowDynamic }) => {
            const invalidName = await state.get('invalidName');
            if (invalidName) {
                await flowDynamic('❌ El nombre anterior no es válido. Por favor, ingresa tu nombre completo:');
                await state.update({ invalidName: false });
                return;
            }
            
            const socialWorkOption = ctx.body.trim();
            const socialWorks = {
                '1': 'INSSSEP',
                '2': 'Swiss Medical',
                '3': 'OSDE',
                '4': 'Galeno',
                '5': 'CONSULTA PARTICULAR',
                '6': 'Otras Obras Sociales'
            };
            
            const socialWork = socialWorks[socialWorkOption];
            
            if (!socialWork) {
                await flowDynamic('❌ Opción inválida. Por favor, selecciona un número del 1 al 6.');
                return;
            }
            
            await state.update({ socialWork });
            console.log('[SOBRETURNO] Paso 2: Obra social recibida:', socialWorkOption);
        }
    )
    .addAnswer(
        '🔍 *Perfecto!* Ahora voy a buscar los sobreturnos disponibles para hoy...',
        null,
        async (ctx, { flowDynamic, state }) => {
            try {
                const timeZone = APP_CONFIG.TIMEZONE;
                const now = new Date();
                const localChatDate = toZonedTime(now, timeZone);
                const formattedDate = format(localChatDate, 'yyyy-MM-dd');
                const fechaFormateada = formatearFechaEspanol(formattedDate);

                // Obtener sobreturnos disponibles
                const disponiblesResponse = await sobreturnoService.getAvailableSobreturnos(formattedDate);
                
                if (disponiblesResponse.error || !disponiblesResponse.data?.data) {
                    throw new Error(disponiblesResponse.message || 'Error al consultar sobreturnos');
                }

                const disponibles = disponiblesResponse.data.data.filter(s => s.isAvailable);
                const disponiblesManiana = disponibles.filter(s => s.sobreturnoNumber <= 5);
                const disponiblesTarde = disponibles.filter(s => s.sobreturnoNumber > 5);

                // Si no hay sobreturnos disponibles
                if (disponiblesManiana.length === 0 && disponiblesTarde.length === 0) {
                    const noDisponiblesMsg = '❌ Lo siento, no hay sobreturnos disponibles para hoy.\n\n' +
                        'Puedes:\n' +
                        '1️⃣ Intentar más tarde\n' +
                        '2️⃣ Solicitar un turno normal escribiendo "turnos"\n' +
                        '3️⃣ Cancelar escribiendo *cancelar*';
                    
                    await flowDynamic(noDisponiblesMsg);
                    return;
                }

                // Construir mensaje de disponibilidad
                let message = `📅 *SOBRETURNOS DISPONIBLES*\n`;
                message += `📆 *Fecha:* ${fechaFormateada}\n\n`;

                if (disponiblesManiana.length > 0) {
                    message += '🌅 *Sobreturnos de mañana:*\n';
                    disponiblesManiana.forEach(s => {
                        message += `${s.sobreturnoNumber}- Sobreturno ${s.time} hs\n`;
                    });
                    message += '\n';
                }

                if (disponiblesTarde.length > 0) {
                    message += '🌇 *Sobreturnos de tarde:*\n';
                    disponiblesTarde.forEach(s => {
                        message += `${s.sobreturnoNumber}- Sobreturno ${s.time} hs\n`;
                    });
                }

                message += `\n📝 Para seleccionar un sobreturno, responde con el número correspondiente`;
                message += '\n❌ Para cancelar, escribe *cancelar*';

                // Guardar estado
                await state.update({
                    appointmentDate: formattedDate,
                    availableSobreturnos: disponibles
                });

                await flowDynamic(message);
            } catch (error) {
                console.error('[SOBRETURNO] Error en paso 3:', error);
                
                let errorMessage = '❌ ';
                if (error.message?.includes('conexión')) {
                    errorMessage += 'No pude conectarme al sistema. Por favor, verifica tu conexión a internet e intenta nuevamente.';
                } else {
                    errorMessage += 'Ocurrió un error al consultar los sobreturnos disponibles. Por favor, intenta nuevamente más tarde.';
                }
                
                await flowDynamic(errorMessage);
                await state.clear();
            }
        }
    )
    .addAnswer(
        '✍️ *Selecciona el sobreturno que deseas:*\n\n_Responde con el número del sobreturno elegido (1-10)_',
        { capture: true },
        async (ctx, { flowDynamic, state }) => {
            try {
                const userInput = ctx.body.trim().toLowerCase();

                if (userInput === 'cancelar') {
                    await flowDynamic('👋 Has cancelado la solicitud de sobreturno. ¡Hasta luego!');
                    await state.clear();
                    return;
                }

                const selectedNumber = parseInt(userInput);
                if (isNaN(selectedNumber) || selectedNumber < 1 || selectedNumber > 10) {
                    await flowDynamic('❌ Por favor, ingresa un número válido entre 1 y 10.');
                    return;
                }

                const availableSobreturnos = state.get('availableSobreturnos') || [];
                const clientName = state.get('clientName');
                const socialWork = state.get('socialWork');
                const appointmentDate = state.get('appointmentDate');

                if (!clientName || !socialWork || !appointmentDate || !availableSobreturnos) {
                    throw new Error('Datos incompletos');
                }

                const selectedSobreturno = availableSobreturnos.find(s => s.sobreturnoNumber === selectedNumber);

                if (!selectedSobreturno) {
                    await flowDynamic('❌ El número de sobreturno seleccionado no está disponible.');
                    return;
                }

                // Crear sobreturno
                // Validar todos los datos antes de enviar
            if (!clientName || !socialWork || !ctx.from || !appointmentDate || !selectedSobreturno.time || !selectedNumber) {
                console.error('[SOBRETURNO] Datos incompletos:', {
                    clientName, socialWork, phone: ctx.from,
                    date: appointmentDate, time: selectedSobreturno.time,
                    number: selectedNumber
                });
                throw new Error('Datos incompletos');
            }

            const result = await sobreturnoService.createSobreturno({
                clientName,
                socialWork,
                phone: ctx.from,
                date: appointmentDate,
                time: selectedSobreturno.time,
                sobreturnoNumber: selectedNumber,
                isSobreturno: true,
                status: 'confirmed'
            });

                if (result.error) {
                    throw new Error(result.message);
                }

                // Confirmar reserva
                const confirmMessage = `✅ *¡Sobreturno confirmado!*\n\n` +
                    `📅 Fecha: ${formatearFechaEspanol(appointmentDate)}\n` +
                    `🕒 Hora: ${selectedSobreturno.time} hs\n` +
                    `👤 Paciente: ${clientName}\n` +
                    `🏥 Obra Social: ${socialWork}\n\n` +
                    `ℹ️ Te esperamos en el consultorio 30 minutos antes.`;

                await flowDynamic(confirmMessage);
                await state.clear();

            } catch (error) {
                console.error('[SOBRETURNO] Error en selección:', error);
                const errorMsg = error.message === 'Datos incompletos' ?
                    '❌ Hubo un problema con tus datos. Por favor, inicia el proceso nuevamente.' :
                    '❌ No se pudo reservar el sobreturno. Por favor, intenta nuevamente más tarde.';
                
                await flowDynamic(errorMsg);
                await state.clear();
            }
        }
    );

export default bookSobreturnoFlow;