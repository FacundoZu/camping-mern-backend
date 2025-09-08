import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import Reservation from '../models/reservation.js';
import config from '../config/mercadopago.js';
import tempReservation from '../models/tempReservation.js';

const client = config

export const createPreference = async (req, res) => {
  try {
    const { items, payer, back_urls, external_reference } = req.body;

    if (!items || !payer || !back_urls) {
      return res.status(400).json({
        status: "error",
        message: 'Datos incompletos para crear preferencia'
      });
    }

    const preference = {
      items,
      payer: {
        ...payer,
        identification: { type: "DNI", number: "12345678" }
      },
      back_urls,
      auto_return: "approved",
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
      init_point: response.init_point || response.sandbox_init_point,
    });

  } catch (error) {
    console.error('Error al crear preferencia de pago:', error);
    res.status(500).json({
      status: "error",
      message: 'Error al procesar el pago',
      error: error.message
    });
  }
};

export const handleWebhook = async (req, res) => {
  console.log('Webhook recibido:', req.body);
  try {
    const paymentId = req.query.id || req.body.data.id;
    const topic = req.query.topic || req.body.type;

    if (!paymentId || topic !== 'payment') {
      return res.status(400).send('Invalid webhook call');
    }

    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: paymentId });

    // Verificar que el pago tenga los datos necesarios
    if (!payment || !payment.external_reference) {
      return res.status(400).send('Invalid payment data');
    }

    // Buscar la reserva temporal
    const tempReserva = await tempReservation.findOne({ id: payment.external_reference });
    console.log(tempReserva)
    if (!tempReserva) {
      return res.status(404).send('Temp reservation not found');
    }

    if (payment.status === 'approved') {
      // Crear reserva confirmada
      await Reservation.create({
        cabaniaId: tempReserva.cabaniaId,
        fechaInicio: tempReserva.fechaInicio,
        fechaFinal: tempReserva.fechaFinal,
        precioTotal: tempReserva.precioTotal,
        estadoReserva: 'confirmada',
        guestInfo: tempReserva.guestInfo,
        metodoPago: 'mercado_pago',
        paymentId: payment.id,
        paymentDetails: payment
      });

      // Eliminar reserva temporal
      await TempReservation.deleteOne({ tempId: payment.external_reference });
    } else if (payment.status === 'rejected') {
      // Opcional: puedes guardar también las reservas rechazadas
      await TempReservation.deleteOne({ tempId: payment.external_reference });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Error');
  }
};