import { MercadoPagoConfig, Payment } from 'mercadopago';
import TempReservation from '../models/tempReservation.js';
import Reservation from '../models/reservation.js';
import Cabin from '../models/cabin.js';
import { incrementUseCount } from './cupon.js';
import { enviarEmailTicket } from '../mailer.js';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000 }
});

export const tempReservation = async (req, res) => {
  try {
    const { cabaniaId, fechaInicio, fechaFinal, precioTotal, guestInfo, usuarioId, cupon } = req.body;

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

    const tempReservation = await TempReservation.create({
      cabaniaId,
      fechaInicio,
      fechaFinal,
      precioTotal,
      guestInfo,
      usuarioId
    });

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

export const deleteTempReservation = async (req, res) => {
  try {
    const { tempId } = req.body;
    await TempReservation.deleteOne({ _id: tempId });
    res.status(200).json({
      status: "success",
      message: 'Reserva temporal eliminada correctamente'
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: 'Error al eliminar reserva temporal',
    });
  }
};

export const confirmReservation = async (req, res) => {
  try {
    const { tempId, paymentId } = req.body;

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

    if (paymentId && paymentId !== 'null') {
      try {
        const paymentClient = new Payment(client);
        const payment = await paymentClient.get({ id: paymentId });
        paymentDetails = payment;
        metodoPago = 'mercado_pago';
        estadoReserva = 'confirmada';
      } catch (err) {
        console.error("Error obteniendo pago de MercadoPago:", err.message);
        estadoReserva = 'rechazada';
      }
    }

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

    let usuario;
    if (!tempReserva.guestInfo && !tempReserva.guestInfo.email) {
      usuario = await User.findById(tempReserva.usuarioId);
    } else {
      usuario = { email: tempReserva.guestInfo.email };
    }

    const cabaña = await Cabin.findById(tempReserva.cabaniaId);

    const detalleReserva = { fechaInicio: tempReserva.fechaInicio, fechaFinal: tempReserva.fechaFinal, precioTotal: tempReserva.precioTotal, metodoPago, cabaña }

    await enviarEmailTicket(usuario.email, detalleReserva);

    await Cabin.updateOne(
      { _id: tempReserva.cabaniaId },
      { $push: { reservas: nuevaReserva._id } }
    );
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

    if (!cabaniaId || !fechaInicio || !fechaFinal || !guestInfo || !guestInfo.email || !guestInfo.nombre || !guestInfo.apellido || !guestInfo.telefono || !guestInfo.documento) {
      return res.status(400).json({ message: 'Faltan datos obligatorios.' });
    }

    const cabania = await Cabin.findById(cabaniaId);
    if (!cabania) {
      return res.status(404).json({ message: 'Cabaña no encontrada.' });
    }
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFinal);
    const noches = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24));

    if (noches <= 0) {
      return res.status(400).json({ message: 'Las fechas seleccionadas no son válidas.' });
    }

    const precioTotal = cabania.precio * noches;

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

    await Cabin.updateOne(
      { _id: cabaniaId },
      { $push: { reservas: nuevaReserva._id } }
    );

    const detalleReserva = { fechaInicio, fechaFinal, precioTotal, metodoPago, cabaña: cabania }

    await enviarEmailTicket(guestInfo.email, detalleReserva);

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
    const { page = 1, limit = 9, estado, usuario } = req.query;

    const filtros = {};

    if (estado) filtros.estadoReserva = estado;

    // Obtener todas las reservas que coincidan con los filtros
    let allReservations = await Reservation.find(filtros)
      .populate('cabaniaId')
      .populate('usuarioId')
      .exec();

    // Filtrar por nombre de usuario después del populate si se proporciona
    if (usuario) {
      allReservations = allReservations.filter(reserva => {
        if (reserva.usuarioId) {
          return reserva.usuarioId.name?.toLowerCase().includes(usuario.toLowerCase());
        } else if (reserva.guestInfo) {
          const nombreCompleto = `${reserva.guestInfo.nombre || ''} ${reserva.guestInfo.apellido || ''}`.toLowerCase();
          return nombreCompleto.includes(usuario.toLowerCase());
        }
        return false;
      });
    }

    // Ordenar por proximidad a la fecha actual
    const now = new Date();
    allReservations.sort((a, b) => {
      const dateA = new Date(a.fechaInicio);
      const dateB = new Date(b.fechaInicio);

      // Separar futuras y pasadas
      const isFutureA = dateA >= now;
      const isFutureB = dateB >= now;

      // Futuras primero
      if (isFutureA && !isFutureB) return -1;
      if (!isFutureA && isFutureB) return 1;

      // Dentro de futuras o pasadas, ordenar por fecha ascendente
      return dateA - dateB;
    });

    // Aplicar paginación
    const totalReservations = allReservations.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + Number(limit);
    const paginatedReservations = allReservations.slice(startIndex, endIndex);

    res.status(200).json({
      status: 'success',
      reservations: paginatedReservations,
      totalReservations,
      totalPages: Math.ceil(totalReservations / limit),
      currentPage: Number(page)
    });
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

const getReservationById = async (req, res) => {
  try {
    const { id } = req.params;

    const reserva = await Reservation.findById(id)
      .populate("cabaniaId")
      .populate("usuarioId");

    if (!reserva) {
      return res.status(404).json({
        status: "error",
        message: "No se encontró la reserva"
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
  deleteTempReservation,
  confirmReservation,
  createCashReservation,
  getReservations,
  getReservationsUser,
  getAllReservations,
  getUserReservations,
  getAllReservationsCabin,
  getReservationByPaymentId,
  getReservationById
};
