import { Schema, model } from 'mongoose';

const TempReservationSchema = new Schema({
    cabaniaId: {
        type: Schema.Types.ObjectId,
        ref: 'Cabania',
        required: true
    },
    usuarioId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
    },
    fechaInicio: {
        type: Date,
        required: true
    },
    fechaFinal: {
        type: Date,
        required: true
    },
    precioTotal: {
        type: Number,
        required: true
    },
    guestInfo: {
        nombre: String,
        email: String,
        telefono: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 60 * 1000) // 30 minutos, luego expira
    }
}, {
    timestamps: false
});

// limpieza automatica de reservas expiradas
TempReservationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model('TempReservation', TempReservationSchema, "temp_reservations");