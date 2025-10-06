import mongoose from 'mongoose';

const CamperSchema = new mongoose.Schema({
    nombreResponsable: { type: String, required: true },
    telefono: { type: String, required: true },
    email: { type: String, required: true },
    cantidadPersonas: { type: Number, required: true },
    cantidadNinos: { type: Number, default: 0 },
    diasEstancia: { type: Number, required: true },
    precioPorDia: { type: Number, required: true },
    vehiculo: { type: Boolean, default: false },
    motorhome: { type: Boolean, default: false },
    patente: { type: String },
    fechaIngreso: { type: Date, default: Date.now },
    total: { type: Number },
}, { timestamps: true });

// Calcular total automáticamente antes de guardar
CamperSchema.pre('save', function (next) {
    this.total = this.diasEstancia * this.precioPorDia;
    next();
});

export default mongoose.model('Camper', CamperSchema);
