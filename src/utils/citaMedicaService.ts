import { AvailableSlot, PatientEventData } from './calendarService.js';

const API_URL = process.env.API_URL!;
const CHATBOT_API_KEY = process.env.CHATBOT_API_KEY!;
const TENANT_SUBDOMAIN = process.env.TENANT_SUBDOMAIN || 'dr-jorgehara'; // Default para Dr. Jorge Hara

console.log('[CITAMEDICA] 🔧 Configuración del servicio:');
console.log('[CITAMEDICA]   API_URL:', API_URL || '(NO DEFINIDA)');
console.log('[CITAMEDICA]   CHATBOT_API_KEY:', CHATBOT_API_KEY ? '***DEFINIDA***' : '(NO DEFINIDA)');
console.log('[CITAMEDICA]   TENANT_SUBDOMAIN:', TENANT_SUBDOMAIN);

export async function createCitaMedicaAppointment(
    slot: AvailableSlot,
    patient: PatientEventData
): Promise<void> {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[CITAMEDICA] 🚀 INICIO createCitaMedicaAppointment');
    console.log('[CITAMEDICA] Slot recibido:', slot);
    console.log('[CITAMEDICA] Patient recibido:', patient);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Validación de variables de entorno
    if (!API_URL) {
        console.error('[CITAMEDICA] ❌ ERROR CRÍTICO: API_URL no está definida');
        throw new Error('API_URL environment variable is missing');
    }
    
    if (!CHATBOT_API_KEY) {
        console.error('[CITAMEDICA] ❌ ERROR CRÍTICO: CHATBOT_API_KEY no está definida');
        throw new Error('CHATBOT_API_KEY environment variable is missing');
    }
    
    const rawType = patient.appointmentType ?? '';
    const consultationType = rawType.toLowerCase().includes('primera')
        ? 'Primera consulta'
        : rawType.toLowerCase().includes('control') || rawType.toLowerCase().includes('seguimiento')
            ? 'Control'
            : '';

    const body = {
        clientName: patient.patientName,
        phone: patient.phone,
        date: slot.date,
        time: slot.time,
        socialWork: 'CONSULTA PARTICULAR',
        consultationType,
        description: [patient.appointmentType, patient.notes].filter(Boolean).join(' | '),
    };

    console.log('[CITAMEDICA] 📦 Body de la petición:', JSON.stringify(body, null, 2));
    console.log('[CITAMEDICA] 🌐 URL completa:', `${API_URL}/appointments`);
        console.log('[CITAMEDICA] 🔑 Headers: Content-Type: application/json');
        console.log('[CITAMEDICA] 🔑 Headers: X-API-Key:', CHATBOT_API_KEY ? '***DEFINIDA***' : '(VACÍA)');
        console.log('[CITAMEDICA] 🔑 Headers: X-Tenant-Subdomain:', TENANT_SUBDOMAIN);

        try {
            console.log('[CITAMEDICA] ⏳ Enviando petición POST...');
            const response = await fetch(`${API_URL}/appointments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': CHATBOT_API_KEY,
                    'X-Tenant-Subdomain': TENANT_SUBDOMAIN, // CRÍTICO: identificar clínica
                },
                body: JSON.stringify(body),
            });

        console.log(`[CITAMEDICA] ✅ Petición enviada. Status: ${response.status} ${response.statusText}`);
        console.log(`[CITAMEDICA] ⏳ Leyendo respuesta...`);
        
        const responseText = await response.text();
        console.log(`[CITAMEDICA] 📄 Response status: ${response.status}`);
        console.log(`[CITAMEDICA] 📄 Response body: ${responseText}`);

        if (!response.ok) {
            console.error(`[CITAMEDICA] ❌ ERROR HTTP ${response.status}: ${responseText}`);
            throw new Error(`CitaMedicaBeta error ${response.status}: ${responseText}`);
        }

        console.log('[CITAMEDICA] ✅ Cita registrada exitosamente en CitaMedicaBeta');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
    } catch (fetchError) {
        console.error('[CITAMEDICA] ❌ ERROR DE RED O FETCH:', fetchError);
        console.error('[CITAMEDICA] Tipo de error:', fetchError.name);
        console.error('[CITAMEDICA] Mensaje:', fetchError.message);
        if (fetchError.cause) {
            console.error('[CITAMEDICA] Causa:', fetchError.cause);
        }
        throw fetchError; // Re-throw para que el flujo lo capture
    }
}
