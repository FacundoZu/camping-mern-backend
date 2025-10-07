import { Router } from "express";
import { authRequire } from "../middlewares/validateToken.js";
import activityController from "../controllers/activity.js";
import { upload } from "../middlewares/upload.js";
import { gerenteRequire } from "../middlewares/admin.js";

export const activityRouter = Router();

activityRouter.post('/createActivity', authRequire, gerenteRequire, activityController.createActivity);
activityRouter.get('/getActivities', activityController.getActivities);
activityRouter.get('/getAllActivities', activityController.getAllActivities);
activityRouter.get('/getActivity/:id', activityController.getActivityById);
activityRouter.put('/updateActivity/:id', authRequire, gerenteRequire, activityController.updateActivity);
activityRouter.delete('/deleteActivity/:id', authRequire, gerenteRequire, activityController.deleteActivity);
activityRouter.put('/cambiarEstado/:id', authRequire, gerenteRequire, activityController.changeState);
activityRouter.post("/uploadActivityImage", [authRequire, upload.fields([{ name: 'image', maxCount: 1 }])], activityController.uploadActivityImage);

export default activityRouter;
