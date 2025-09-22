import { Router } from "express";
import { createPreference } from '../controllers/mercadoPago.js';
import { tempReservation } from '../controllers/reservation.js';
import { webhook } from '../controllers/mercadoPago.js';
import config from '../config/mercadopago.js';

const client = config;

export const mercadoPagoRouter = Router();

mercadoPagoRouter.post('/create-temp-reservation', tempReservation);
mercadoPagoRouter.post('/create-preference', createPreference);
mercadoPagoRouter.post('/webhook', webhook);


// Rutas de redirección después del pago
mercadoPagoRouter.get('/success', (req, res) => {
  const { payment_id, external_reference } = req.query;
  res.redirect(`http://localhost:3000/reserva-exitosa?payment_id=${payment_id}&tempId=${external_reference}`);
});

mercadoPagoRouter.get('/failure', (req, res) => {
  const { payment_id, external_reference } = req.query;
  res.redirect(`http://localhost:3000/reserva-fallida`);
});

mercadoPagoRouter.get('/pending', (req, res) => {
  const { payment_id, external_reference } = req.query;
  res.redirect(`http://localhost:3000/reserva-pendiente`);
});