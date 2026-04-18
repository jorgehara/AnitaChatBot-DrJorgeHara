// Dr. Jorge Hara — Lunes a Viernes, 8:00 a 18:00 (turnos de 30 min)
export const defaultAvailableSlots = {
    morning: [
        "08:00", "08:30", "09:00", "09:30",
        "10:00", "10:30", "11:00", "11:30"
    ] as string[],
    afternoon: [
        "14:00", "14:30", "15:00", "15:30",
        "16:00", "16:30", "17:00", "17:30"
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
