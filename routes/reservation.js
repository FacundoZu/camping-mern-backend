import { Router } from "express"
import { authRequire } from "../middlewares/validateToken.js"
import ReservationController from "../controllers/reservation.js"

export const reservationRouter = Router()

reservationRouter.post('/tempReservation', ReservationController.tempReservation);
reservationRouter.post('/confirmReservation', ReservationController.confirmReservation);
reservationRouter.get('/getReservations/:id', ReservationController.getReservations);
reservationRouter.get('/getReservationsUser/:usuarioId', ReservationController.getReservationsUser);
reservationRouter.get('/getAllReservations', authRequire, ReservationController.getAllReservations);
reservationRouter.get('/getAllReservationsCabin/:id', authRequire, ReservationController.getAllReservationsCabin);
reservationRouter.get('/getUserReservations/:userId/:cabinId', ReservationController.getUserReservations);