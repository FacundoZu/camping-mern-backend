import { MercadoPagoConfig } from 'mercadopago';

const config = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
  options: { timeout: 5000 }
});

export default config;