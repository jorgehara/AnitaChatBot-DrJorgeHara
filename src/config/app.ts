import { config } from 'dotenv';
config();

export const APP_CONFIG = {
    // Configuración de la API
    API_URL: process.env.API_URL || 'https://micitamedica.me/api',
    PORT: process.env.PORT || 3008,

    // URL base del frontend (para links de reserva)
    CLINIC_BASE_URL: process.env.CLINIC_BASE_URL || 'https://micitamedica.me',

    // Configuración de MongoDB
    MONGO_DB_URI: process.env.MONGO_DB_URI || 'mongodb://localhost:27017/chatbot-drjorgehara',
    MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'chatbot-drjorgehara',

    // Dr. Jorge Hara — Lunes a Viernes, 8:00 a 18:00
    BUSINESS_HOURS: {
        start: 8,
        end: 18,
        workingDays: [1, 2, 3, 4, 5], // Lunes=1, Martes=2, Miércoles=3, Jueves=4, Viernes=5
    },

    // Dr. Jorge Hara trabaja con obras sociales
    SOCIAL_WORKS: {
        '1': 'INSSSEP',
        '2': 'Swiss Medical',
        '3': 'OSDE',
        '4': 'Galeno',
        '5': 'CONSULTA PARTICULAR',
        '6': 'Otras Obras Sociales'
    },

    // Configuración de mensajes
    MESSAGES: {
        WELCOME: '🩺 *Bienvenido al Consultorio del Dr. Jorge Hara* 🩺',
        UNAVAILABLE: '❌ Lo siento, no hay horarios disponibles para el día solicitado.',
        ERROR: '❌ Ha ocurrido un error. Por favor, intenta nuevamente más tarde.',
        SUCCESS: '✅ Tu consulta ha sido agendada exitosamente.',
        INSTRUCTIONS: [
            '📋 *Instrucciones importantes:*',
            '- Llegue 30 minutos antes de su consulta',
            '- Traiga su documento de identidad',
            '- Traiga su carnet de obra social',
        ].join('\n')
    },

    // Configuración de zona horaria
    TIMEZONE: 'America/Argentina/Buenos_Aires',

    // Admin settings
    ADMIN_NUMBER: process.env.ADMIN_NUMBER || ''
};

export default APP_CONFIG;
