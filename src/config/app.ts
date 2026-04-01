import { config } from 'dotenv';
config();

export const APP_CONFIG = {
    // Configuración de la API
    API_URL: process.env.API_URL || 'https://od-melinavillalba.micitamedica.me/api',
    PORT: process.env.PORT || 3012,

    // URL base del frontend (para links de reserva)
    CLINIC_BASE_URL: process.env.CLINIC_BASE_URL || 'https://od-melinavillalba.micitamedica.me',

    // Configuración de MongoDB
    MONGO_DB_URI: process.env.MONGO_DB_URI || 'mongodb://localhost:27017/consultorio-odontologa',
    MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'consultorio-odontologa',

    // Od. Villalba — Lunes a Jueves, 15:00 a 20:00
    BUSINESS_HOURS: {
        start: 15,
        end: 20,
        workingDays: [1, 2, 3, 4], // Lunes=1, Martes=2, Miércoles=3, Jueves=4
    },

    // Od. Villalba trabaja SOLO de manera particular (sin obras sociales)
    SOCIAL_WORKS: {
        '1': 'CONSULTA PARTICULAR'
    },

    // Configuración de mensajes
    MESSAGES: {
        WELCOME: '🦷 *Bienvenido al Consultorio de la Od. Melina Villalba* 🦷',
        UNAVAILABLE: '❌ Lo siento, no hay horarios disponibles para el día solicitado.',
        ERROR: '❌ Ha ocurrido un error. Por favor, intenta nuevamente más tarde.',
        SUCCESS: '✅ Tu consulta ha sido agendada exitosamente.',
        INSTRUCTIONS: [
            '📋 *Instrucciones importantes:*',
            '- Llegue 15 minutos antes de su consulta',
            '- Traiga su documento de identidad',
        ].join('\n')
    },

    // Configuración de zona horaria
    TIMEZONE: 'America/Argentina/Buenos_Aires',

    // Admin settings
    ADMIN_NUMBER: process.env.ADMIN_NUMBER || ''
};

export default APP_CONFIG;
