import { Preference } from 'mercadopago';
import config from '../config/mercadopago.js';
import { confirmReservation } from './reservation.js';


const client = config;

export const createPreference = async (req, res) => {
  try {
    const { items, payer, external_reference } = req.body;
    if (!items || !payer) {
      return res.status(400).json({ status: "error", message: 'Datos incompletos' });
    }

    const preference = {
      items,
      payer,
      back_urls: {
        success: `${process.env.FRONT_URL_MP}/reserva-exitosa`,
        failure: `${process.env.FRONT_URL_MP}/reserva-fallida`,
        pending: `${process.env.FRONT_URL_MP}/reserva-pendiente`
      },
      // notification_url: `${process.env.BASE_URL}/MP/webhook`,
      auto_return: "approved",
      redirectMode: "modal",
      external_reference,
    };

    const preferenceClient = new Preference(client);
    const response = await preferenceClient.create({ body: preference });

    res.json({
      status: "success",
      init_point: response.init_point
    });

  } catch (error) {
    res.status(500).json({ status: "error", message: 'Error al procesar el pago' });
  }
};

export const webhook = async (req, res) => {
  try {
    const { type, data } = req.body;
    // Mercado Pago manda el "type" = "payment" y "data.id" = id del pago
    if (type === 'payment') {
      const paymentId = data.id;

      // Consultar el pago en Mercado Pago
      const payment = await client.payment.get({ id: paymentId });

      if (payment.status === 'approved') {
        const tempId = payment.external_reference;

        // Confirmar reserva en tu sistema
        await confirmReservation(tempId, paymentId); // tu lógica del controller
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('Error en webhook:', err);
    res.sendStatus(500);
  }
}
