// Od. Villalba — Lunes a Jueves, 15:00 a 20:00 (turnos de 30 min)
export const defaultAvailableSlots = {
    morning: [] as string[],
    afternoon: [
        "15:00", "15:30", "16:00", "16:30",
        "17:00", "17:30", "18:00", "18:30",
        "19:00", "19:30"
    ]
};

// Retorna los datos en el mismo formato que la API real
// { success, data: { displayDate, available: { morning: [...], afternoon: [...] } } }
export const getFallbackSlots = (date: string) => {
    const toSlot = (time: string) => ({ displayTime: time, time, status: 'available' as const });

    return {
        success: true,
        data: {
            displayDate: date,
            available: {
                morning: defaultAvailableSlots.morning.map(toSlot),
                afternoon: defaultAvailableSlots.afternoon.map(toSlot),
            }
        },
        message: "Datos recuperados del sistema de respaldo"
    };
};
