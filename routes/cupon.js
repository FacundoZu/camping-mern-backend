import express from "express";
import cuponController from "../controllers/cupon.js";
import { authRequire } from "../middlewares/validateToken.js";
import { adminRequire } from "../middlewares/admin.js";

const cuponRouter = express.Router();

cuponRouter.post("/", authRequire, adminRequire, cuponController.createCupon);
cuponRouter.get("/", authRequire, adminRequire, cuponController.getCupons);
cuponRouter.get("/:id", authRequire, adminRequire, cuponController.getCuponById);
cuponRouter.put("/:id", authRequire, adminRequire, cuponController.updateCupon);
cuponRouter.delete("/:id", authRequire, adminRequire, cuponController.deleteCupon);
cuponRouter.post("/:id", authRequire, adminRequire, cuponController.changeCuponStatus);

cuponRouter.post("/validate", cuponController.validateCupon);

export default cuponRouter;
