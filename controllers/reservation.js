import { MercadoPagoConfig, Payment } from 'mercadopago';
import TempReservation from '../models/tempReservation.js';
import Reservation from '../models/reservation.js';
import Cabin from '../models/cabin.js';
import { incrementUseCount } from './cupon.js';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000 }
});

export const tempReservation = async (req, res) => {
  try {
    const { cabaniaId, fechaInicio, fechaFinal, precioTotal, guestInfo, usuarioId, cupon } = req.body;

    // Verificar disponibilidad
    const [reservasExistentes, tempReservas] = await Promise.all([
      Reservation.find({
        cabaniaId,
        estadoReserva: { $in: ['confirmada', 'pendiente', 'completada'] },
        $or: [
          { fechaInicio: { $lt: new Date(fechaFinal) }, fechaFinal: { $gt: new Date(fechaInicio) } },
          { fechaInicio: { $gte: new Date(fechaInicio), $lte: new Date(fechaFinal) } },
        ]
      }),
      TempReservation.find({
        cabaniaId,
        $or: [
          { fechaInicio: { $lt: new Date(fechaFinal) }, fechaFinal: { $gt: new Date(fechaInicio) } },
          { fechaInicio: { $gte: new Date(fechaInicio), $lte: new Date(fechaFinal) } },
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

    // Incrementar uso del cupón
    if (cupon) {
      await incrementUseCount(cupon);
    }

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

export const confirmReservation = async (req, res) => {
  try {
    const { tempId, paymentId } = req.body;

    // Verificar si ya existe una reserva confirmada con este paymentId (cuando no es nulo)
    if (paymentId && paymentId !== 'null') {
      const reservaExistente = await Reservation.findOne({
        paymentId: { $eq: paymentId, $ne: null }
      });
      if (reservaExistente) {
        return res.status(200).json({
          status: "success",
          reserva: reservaExistente,
          message: 'Reserva ya confirmada anteriormente'
        });
      }
    }

    // Verificar reserva temporal
    const tempReserva = await TempReservation.findOne({ _id: tempId });
    if (!tempReserva) {
      return res.status(400).json({
        status: "error",
        message: 'Reserva temporal no encontrada'
      });
    }

    let estadoReserva = 'rechazada';
    let paymentDetails = null;
    let metodoPago = null;

    // Verificar pago con Mercado Pago
    if (paymentId && paymentId !== 'null') {
      try {
        const paymentClient = new Payment(client);
        const payment = await paymentClient.get({ id: paymentId });
        paymentDetails = payment;
        metodoPago = 'mercado_pago';
        estadoReserva = 'confirmada';
      } catch (err) {
        console.error("Error obteniendo pago de MercadoPago:", err.message);
        // Se guarda igualmente como rechazada
        estadoReserva = 'rechazada';
      }
    }

    // Crear reserva (confirmada o rechazada)
    const nuevaReserva = await Reservation.create({
      usuarioId: tempReserva.usuarioId,
      cabaniaId: tempReserva.cabaniaId,
      fechaInicio: tempReserva.fechaInicio,
      fechaFinal: tempReserva.fechaFinal,
      precioTotal: tempReserva.precioTotal,
      estadoReserva,
      guestInfo: tempReserva.guestInfo || null,
      metodoPago,
      paymentId: paymentId !== 'null' ? paymentId : null,
      paymentDetails
    });

    // Agregar al array de reservas de la cabaña
    await Cabin.updateOne(
      { _id: tempReserva.cabaniaId },
      { $push: { reservas: nuevaReserva._id } }
    );

    // Eliminar reserva temporal
    await TempReservation.deleteOne({ _id: tempId });

    res.status(201).json({
      status: "success",
      reserva: nuevaReserva
    });

  } catch (error) {
    console.error("Error confirmando reserva:", error);
    res.status(500).json({
      status: "error",
      message: 'Error al confirmar reserva',
      error: error.message
    });
  }
};

export const createCashReservation = async (req, res) => {
  try {
    const { cabaniaId, fechaInicio, fechaFinal, guestInfo, metodoPago } = req.body;

    if (!cabaniaId || !fechaInicio || !fechaFinal || !guestInfo) {
      return res.status(400).json({ message: 'Faltan datos obligatorios.' });
    }

    // Buscar la cabaña para obtener su precio por noche
    const cabania = await Cabin.findById(cabaniaId);
    if (!cabania) {
      return res.status(404).json({ message: 'Cabaña no encontrada.' });
    }

    // Calcular cantidad de noches
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFinal);
    const noches = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));

    if (noches <= 0) {
      return res.status(400).json({ message: 'Las fechas seleccionadas no son válidas.' });
    }

    // Calcular precio total
    const precioTotal = cabania.precio * noches;

    // Crear la reserva
    const nuevaReserva = new Reservation({
      cabaniaId,
      fechaInicio: inicio,
      fechaFinal: fin,
      precioTotal,
      estadoReserva: 'confirmada',
      guestInfo,
      metodoPago,
      paymentId: null,
      paymentDetails: null
    });

    await nuevaReserva.save();

    return res.status(201).json({
      status: "success",
      message: 'Reserva creada correctamente, se envio un correo de confirmacion.',
    });

  } catch (error) {
    console.error('Error al crear la reserva en efectivo:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const getReservations = async (req, res) => {
  try {
    const cabinId = req.params.id;
    const fechaActual = new Date();

    const fechaUnMesAtras = new Date();
    fechaUnMesAtras.setMonth(fechaActual.getMonth() - 1);

    const reservas = await Reservation.find({
      cabaniaId: cabinId,
      fechaInicio: { $gte: fechaUnMesAtras },
      estadoReserva: 'confirmada'
    }).select("fechaInicio fechaFinal");

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
      .sort({ fechaInicio: -1 })
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

const getReservationByPaymentId = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const reserva = await Reservation.findOne({ paymentId })
      .populate("cabaniaId")
      .populate("usuarioId");

    if (!reserva) {
      return res.status(404).json({
        status: "error",
        message: "No se encontró la reserva con ese paymentId"
      });
    }

    return res.json({
      status: "success",
      reserva
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error al buscar la reserva",
      error: error.message
    });
  }
};


export default {
  tempReservation,
  confirmReservation,
  createCashReservation,
  getReservations,
  getReservationsUser,
  getAllReservations,
  getUserReservations,
  getAllReservationsCabin,
  getReservationByPaymentId
};
