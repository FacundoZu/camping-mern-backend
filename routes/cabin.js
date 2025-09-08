import { Router } from "express"
import CabinController from "../controllers/cabin.js"
import { upload } from '../middlewares/upload.js'
import { authRequire } from "../middlewares/validateToken.js"

export const cabinRouter = Router()

cabinRouter.get('/getCabins', CabinController.getCabins);
cabinRouter.get('/getServices', CabinController.getServices);
cabinRouter.post('/create', CabinController.createCabin);
cabinRouter.post('/uploadImage/:id', [authRequire, upload.fields([{ name: 'image', maxCount: 1 }])], CabinController.uploadImageCabin);
cabinRouter.get('/getCabin/:id', CabinController.getCabin);
cabinRouter.get('/opciones', authRequire, CabinController.getOpcionesCabania);
cabinRouter.put('/update/:id', authRequire, CabinController.updateCabin);
cabinRouter.put('/cambiarEstado/:id', authRequire, CabinController.changeState);
cabinRouter.delete('/deleteImage/:id', authRequire, CabinController.deleteImageCabin);