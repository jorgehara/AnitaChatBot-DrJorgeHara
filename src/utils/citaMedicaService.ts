import { AvailableSlot, PatientEventData } from './calendarService';

const API_URL = process.env.API_URL!;
const CHATBOT_API_KEY = process.env.CHATBOT_API_KEY!;

console.log('[CITAMEDICA] API_URL:', API_URL);

export async function createCitaMedicaAppointment(
    slot: AvailableSlot,
    patient: PatientEventData
): Promise<void> {
    const body = {
        clientName: patient.patientName,
        phone: patient.phone,
        date: slot.date,
        time: slot.time,
        socialWork: 'CONSULTA PARTICULAR',
        description: [patient.appointmentType, patient.notes].filter(Boolean).join(' | '),
    };

    console.log('[CITAMEDICA] Registrando cita en CitaMedicaBeta...');
    console.log('[CITAMEDICA] URL:', `${API_URL}/appointments`);
    console.log('[CITAMEDICA] Body:', JSON.stringify(body));

    const response = await fetch(`${API_URL}/appointments`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': CHATBOT_API_KEY,
        },
        body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log(`[CITAMEDICA] Respuesta status: ${response.status}`);
    console.log(`[CITAMEDICA] Respuesta body: ${responseText}`);

    if (!response.ok) {
        throw new Error(`CitaMedicaBeta error ${response.status}: ${responseText}`);
    }

    console.log('[CITAMEDICA] ✅ Cita registrada exitosamente en CitaMedicaBeta');
}
