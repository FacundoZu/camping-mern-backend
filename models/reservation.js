import { Schema, model } from 'mongoose';

const ESTADO = ['pendiente', 'confirmada', 'rechazada', 'completada', 'cancelada'];
const METODO_PAGO = ['mercado_pago', 'transferencia', 'efectivo'];

const ReservationSchema = new Schema({
    usuarioId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    cabaniaId: {
        type: Schema.Types.ObjectId,
        ref: 'Cabania',
        required: true
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
    estadoReserva: {
        type: String,
        enum: ESTADO,
        default: 'pendiente'
    },
    guestInfo: {
        type: Object,
        required: false,
        default: null
    },
    metodoPago: {
        type: String,
        enum: METODO_PAGO,
        required: true
    },
    paymentId: {
        type: String,
        required: true
    },
    paymentDetails: {
        type: Object // Respuesta de MP aquí
    }
}, {
    timestamps: true
});

ReservationSchema.index({ cabaniaId: 1 });
ReservationSchema.index({ usuarioId: 1 });
ReservationSchema.index({ fechaInicio: 1, fechaFinal: 1 });

export default model('Reserva', ReservationSchema, "reservas");