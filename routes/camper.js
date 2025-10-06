import express from 'express';
import camperController from '../controllers/camper.js';

export const camperRouter = express.Router();

camperRouter.post('/', camperController.createCamper);
camperRouter.get('/', camperController.getCampers);
camperRouter.get('/getCampersStats', camperController.getCampersStats);

