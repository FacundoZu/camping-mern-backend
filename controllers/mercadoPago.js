import { Preference, Payment } from 'mercadopago';
import Reservation from '../models/reservation.js';
import config from '../config/mercadopago.js';
import tempReservation from '../models/tempReservation.js';

const client = config;

export const createPreference = async (req, res) => {
  try {
    const { items, payer, back_urls, external_reference } = req.body;

    if (!items || !payer || !back_urls) {
      return res.status(400).json({ status: "error", message: 'Datos incompletos' });
    }

    const preference = {
      items,
      payer,
      back_urls,
      notification_url: `${process.env.BASE_URL}/MP/webhook`,
      binary_mode: true,
      external_reference,
      payment_methods: {
        excluded_payment_types: [{ id: "atm" }],
        installments: 12
      }
    };

    const preferenceClient = new Preference(client);
    const response = await preferenceClient.create({ body: preference });

    res.json({
      status: "success",
      init_point: process.env.NODE_ENV === "production"
        ? response.init_point
        : response.sandbox_init_point,
    });

  } catch (error) {
    console.error('Error al crear preferencia de pago:', error);
    res.status(500).json({ status: "error", message: 'Error al procesar el pago' });
  }
};

export const handleWebhook = async (req, res) => {
  try {
    const paymentId = req.query.id || req.body.data.id;
    const topic = req.query.topic || req.body.type;

    if (!paymentId || topic !== 'payment') {
      return res.status(400).send('Invalid webhook call');
    }

    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    if (!payment || !payment.external_reference) {
      return res.status(400).send('Invalid payment data');
    }

    const tempReserva = await tempReservation.findOne({ tempId: payment.external_reference });
    if (!tempReserva) return res.status(404).send('Temp reservation not found');

    if (payment.status === 'approved') {
      await Reservation.create({
        cabaniaId: tempReserva.cabaniaId,
        fechaInicio: tempReserva.fechaInicio,
        fechaFinal: tempReserva.fechaFinal,
        precioTotal: tempReserva.precioTotal,
        estadoReserva: 'confirmada',
        guestInfo: tempReserva.guestInfo,
        metodoPago: 'mercado_pago',
        paymentId: payment.id,
        external_reference: payment.external_reference,
        paymentDetails: payment
      });
    }

    // Eliminar siempre la temporal, tanto si aprueba como si rechaza
    await tempReservation.deleteOne({ tempId: payment.external_reference });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Error');
  }
};

export const getPaymentStatus = async (req, res) => {
  try {
    const { tempId } = req.params;

    const reserva = await Reservation.findOne({ external_reference: tempId });
    if (reserva) {
      return res.json({ status: "success", estado: "approved" });
    }

    const temp = await tempReservation.findOne({ tempId });
    if (temp) {
      return res.json({ status: "success", estado: "pending" });
    }

    res.json({ status: "success", estado: "rejected" });

  } catch (error) {
    console.error("Error obteniendo estado del pago:", error);
    res.status(500).json({ status: "error", message: "Error en el servidor" });
  }
};
