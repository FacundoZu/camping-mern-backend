import { MercadoPagoConfig, Payment } from 'mercadopago';
import TempReservation from '../models/tempReservation.js';
import Reservation from '../models/reservation.js';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000 }
});

export const tempReservation = async (req, res) => {
  try {
    const { cabaniaId, fechaInicio, fechaFinal, precioTotal, guestInfo, usuarioId } = req.body;

    // Verificar disponibilidad
    const [reservasExistentes, tempReservas] = await Promise.all([
      Reservation.find({
        cabaniaId,
        $or: [
          { fechaInicio: { $lt: new Date(fechaFinal) }, fechaFinal: { $gt: new Date(fechaInicio) } },
          { fechaInicio: { $gte: new Date(fechaInicio), $lte: new Date(fechaFinal) } }
        ]
      }),
      TempReservation.find({
        cabaniaId,
        $or: [
          { fechaInicio: { $lt: new Date(fechaFinal) }, fechaFinal: { $gt: new Date(fechaInicio) } },
          { fechaInicio: { $gte: new Date(fechaInicio), $lte: new Date(fechaFinal) } }
        ],
        expiresAt: { $gt: new Date() }
      })
    ]);
    if (reservasExistentes.length > 0 || tempReservas.length > 0) {
      return res.status(400).json({
        status: "error",
        message: 'Fechas no disponibles'
      });
    }

    // Crear reserva temporal
    const tempReservation = await TempReservation.create({
      cabaniaId,
      fechaInicio,
      fechaFinal,
      precioTotal,
      guestInfo,
      usuarioId
    });

    res.status(200).json({
      status: "success",
      tempId: tempReservation._id
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: 'Error al crear reserva temporal',
      error: error.message
    });
  }
};

const confirmReservation = async (req, res) => {
  try {
    const { tempId, paymentId } = req.body;
    // Verificar si ya existe una reserva confirmada con este paymentId
    const reservaExistente = await Reservation.findOne({ paymentId });
    if (reservaExistente) {
      return res.status(200).json({
        status: "success",
        reserva: reservaExistente,
        message: 'Reserva ya confirmada anteriormente'
      });
    }

    // Verificar reserva temporal
    const tempReserva = await TempReservation.findOne({ _id: tempId });
    if (!tempReserva) {
      return res.status(400).json({
        status: "error",
        message: 'Reserva temporal no encontrada'
      });
    }
    // Verificar pago con Mercado Pago
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });
    if (payment.status !== 'approved') {
      return res.status(400).json({
        status: "error",
        message: 'Pago no aprobado',
        paymentStatus: payment.status
      });
    }
    // Crear reserva confirmada
    const nuevaReserva = await Reservation.create({
      usuarioId: tempReserva.usuarioId,
      cabaniaId: tempReserva.cabaniaId,
      fechaInicio: tempReserva.fechaInicio,
      fechaFinal: tempReserva.fechaFinal,
      precioTotal: tempReserva.precioTotal,
      estadoReserva: 'confirmada',
      guestInfo: tempReserva.guestInfo ? tempReserva.guestInfo : null,
      metodoPago: 'mercado_pago',
      paymentId,
      paymentDetails: payment
    });
    // Eliminar reserva temporal (opcional, puedes mantenerla con estado)
    await TempReservation.deleteOne({ _id: tempId });
    res.status(201).json({
      status: "success",
      reserva: nuevaReserva
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: 'Error al confirmar reserva',
      error: error.message
    });
  }
};

const getReservations = async (req, res) => {
  try {
    const cabinId = req.params.id;
    const fechaActual = new Date();

    const fechaDosMesesAtras = new Date();
    fechaDosMesesAtras.setMonth(fechaActual.getMonth() - 1);

    const reservas = await Reservation.find({
      cabaniaId: cabinId,
      $or: [
        { fechaInicio: { $gte: fechaDosMesesAtras } },
        { estado: 'activa' }
      ]
    });


    if (!reservas || reservas.length === 0) {
      return res.status(404).json({
        mensaje: 'No se encontraron reservas para esta cabaña.',
      });
    }

    return res.status(200).json({
      reservas,
    });

  } catch (error) {
    return res.status(500).json({
      mensaje: 'Hubo un error al obtener las reservas.',
    });
  }
};

const getAllReservationsCabin = async (req, res) => {

  try {
    const cabinId = req.params.id;
    const reservas = await Reservation.find({
      cabaniaId: cabinId,
    });

    if (!reservas || reservas.length === 0) {
      return res.status(404).json({
        mensaje: 'No se encontraron reservas para esta cabaña.',
      });
    }

    return res.status(200).json({
      reservas,
    });

  } catch (error) {
    return res.status(500).json({
      mensaje: 'Hubo un error al obtener las reservas.',
    });
  }
};

const getReservationsUser = async (req, res) => {
  try {
    const { usuarioId } = req.params;
    const reservas = await Reservation.find({ usuarioId })
      .populate('cabaniaId')
      .exec();
    res.status(200).json({ success: true, reservas });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al obtener reservas' });
  }
};

const getAllReservations = async (req, res) => {
  try {
    const reservations = await Reservation.find().populate('cabaniaId');
    res.status(200).json({ reservations });
  } catch (error) {
    res.status(500).json({ message: "Error al obtener las reservas" });
  }
};

const getUserReservations = async (req, res) => {
  const { userId, cabinId } = req.params;

  try {
    const reservas = await Reservation.find({
      usuarioId: userId,
      cabaniaId: cabinId,
    });

    res.status(200).json({ reservas });
  } catch (error) {
    res.status(500).json({ mensaje: "Error al obtener reservas del usuario", error });
  }
};

export default {
  tempReservation,
  confirmReservation,
  getReservations,
  getReservationsUser,
  getAllReservations,
  getUserReservations,
  getAllReservationsCabin
};
