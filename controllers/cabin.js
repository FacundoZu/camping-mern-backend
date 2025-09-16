import Cabin from "../models/cabin.js";
import { deleteFileFromStorage } from "../utils/deleteFile.js";
import { uploadFile } from '../utils/uploadFile.js'
import mongoose from "mongoose";
import { parse } from "date-fns";
import Service from "../models/service.js";

const getCabins = async (req, res) => {
    try {
        const { checkIn, checkOut, cantidadPersonas, cantidadHabitaciones, cantidadBaños, servicios } = req.query;
        const filtros = {};

        // Conversión a números
        if (cantidadPersonas && cantidadPersonas !== "0") {
            filtros.cantidadPersonas = Number(cantidadPersonas);
        }
        if (cantidadHabitaciones && cantidadHabitaciones !== "0") {
            filtros.cantidadHabitaciones = Number(cantidadHabitaciones);
        }
        if (cantidadBaños && cantidadBaños !== "0") {
            filtros.cantidadBaños = Number(cantidadBaños);
        }

        // Filtro de servicios
        if (servicios) {
            const serviciosArray = servicios.split(",");
            filtros.servicios = {
                $all: serviciosArray.map(id => new mongoose.Types.ObjectId(id.trim()))
            };
        }

        // Manejo de fechas
        const parseDate = (dateString) => parse(dateString, "dd-MM-yyyy", new Date());

        if (checkIn && checkOut) {
            const fechaInicioDate = parseDate(checkIn);
            const fechaFinalDate = parseDate(checkOut);

            filtros.reservas = {
                $not: {
                    $elemMatch: {
                        fechaInicio: { $lte: fechaFinalDate },
                        fechaFinal: { $gte: fechaInicioDate }
                    }
                }
            };
        }
        const cabins = await Cabin.find(filtros)
            .populate("servicios")
            .populate("reservas");
        return res.status(200).json({
            success: true,
            cabins
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al obtener las cabañas",
            error: error.message
        });
    }
};

const getActiveCabins = async (req, res) => {
    try {
        const { checkIn, checkOut, cantidadPersonas, cantidadHabitaciones, cantidadBaños, servicios } = req.query;
        const filtros = {};

        // Conversión a números
        if (cantidadPersonas && cantidadPersonas !== "0") {
            filtros.cantidadPersonas = { $gte: Number(cantidadPersonas) };
        }
        if (cantidadHabitaciones && cantidadHabitaciones !== "0") {
            filtros.cantidadHabitaciones = { $gte: Number(cantidadHabitaciones) };
        }
        if (cantidadBaños && cantidadBaños !== "0") {
            filtros.cantidadBaños = { $gte: Number(cantidadBaños) };
        }

        filtros.estado = "Disponible";

        // Filtro de servicios
        if (servicios) {
            const serviciosArray = servicios.split(",");
            filtros.servicios = {
                $all: serviciosArray.map(id => new mongoose.Types.ObjectId(id.trim()))
            };
        }

        // Manejo de fechas
        const parseDate = (dateString) => parse(dateString, "dd-MM-yyyy", new Date());

        if (checkIn && checkOut) {
            const fechaInicioDate = parseDate(checkIn);
            const fechaFinalDate = parseDate(checkOut);

            filtros.reservas = {
                $not: {
                    $elemMatch: {
                        fechaInicio: { $lte: fechaFinalDate },
                        fechaFinal: { $gte: fechaInicioDate }
                    }
                }
            };
        }
        let cabins;

        if (cantidadPersonas && cantidadPersonas !== "0") {
            cabins = await Cabin.aggregate([
                { $match: filtros },
                {
                    $addFields: {
                        prioridad: {
                            $cond: [
                                { $eq: ["$cantidadPersonas", Number(cantidadPersonas)] },
                                0,
                                1
                            ]
                        }
                    }
                },
                { $sort: { prioridad: 1, cantidadPersonas: 1 } }
            ]);

            // populate después de aggregate
            cabins = await Cabin.populate(cabins, ["servicios", "reservas"]);
        } else {
            cabins = await Cabin.find(filtros)
                .populate("servicios")
                .populate("reservas");
        }

        return res.status(200).json({
            success: true,
            cabins
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al obtener las cabañas",
            error: error.message
        });
    }
};


const getServices = async (req, res) => {
    try {
        // 1. Traer todos los servicios disponibles
        const services = await Service.find().sort({ nombre: 1 });

        return res.status(200).json({
            success: true,
            services
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Error al obtener los servicios",
            error: error.message
        });
    }
};

const createCabin = async (req, res) => {
    try {
        const { nombre, modelo, precio, descripcion, cantidadPersonas, cantidadBaños, cantidadHabitaciones, estado, servicios, minimoDias } = req.body;
        const newCabin = new Cabin({ nombre, modelo, precio, descripcion, cantidadPersonas, cantidadBaños, cantidadHabitaciones, estado, servicios, minimoDias });

        const savedCabin = await newCabin.save();
        return res.status(201).json({
            status: 'success',
            cabin: savedCabin
        });
    } catch (error) {
        return res.status(500).json({
            message: "Error al crear la cabaña",
            error,
        });
    }
};

const uploadImageCabin = async (req, res) => {
    try {
        if (!req.file && !req.files) {
            return res.status(400).json({
                status: "error",
                message: "No se ha subido ningún archivo"
            });
        }

        const image = req.files.image;
        if (!image || image.length === 0) {
            return res.status(400).json({
                status: "error",
                message: "No se ha encontrado una imagen válida"
            });
        }

        const { downloadURL } = await uploadFile(image[0], 1280, 720);

        const cabinId = req.params.id;
        const isMain = req.body.isMain;

        const updateData = isMain === "true"
            ? { imagenPrincipal: downloadURL }
            : { $push: { imagenes: downloadURL } };

        const cabañaActualizada = await Cabin.findOneAndUpdate(
            { _id: cabinId },
            updateData,
            { new: true }
        );

        if (!cabañaActualizada) {
            return res.status(404).json({
                status: "error",
                message: "Cabaña no encontrada"
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Imagen actualizada correctamente",
            cabaña: cabañaActualizada,
        });

    } catch (error) {
        console.error("Error al subir la imagen:", error);
        return res.status(500).json({
            status: "error",
            message: "Error interno en el servidor"
        });
    }
};

const deleteImageCabin = async (req, res) => {
    try {
        const { imageUrl } = req.body;
        const cabinId = req.params.id;

        if (!imageUrl) {
            return res.status(400).json({
                status: "error",
                message: "La URL de la imagen es requerida",
            });
        }

        await deleteFileFromStorage(imageUrl);

        const cabañaActualizada = await Cabin.findOneAndUpdate(
            { _id: cabinId },
            { $pull: { imagenes: imageUrl } },
            { new: true }
        );

        if (!cabañaActualizada) {
            return res.status(404).json({
                status: "error",
                message: "Cabaña no encontrada",
            });
        }

        return res.status(200).json({
            status: "success",
            message: "Imagen eliminada correctamente",
            cabaña: cabañaActualizada,
        });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error interno en el servidor",
        });
    }
};

const getCabin = async (req, res) => {
    const { id } = req.params;

    try {
        const cabin = await Cabin.findById(id)
            .populate('servicios')
            .select('nombre modelo precio descripcion cantidadPersonas cantidadBaños cantidadHabitaciones estado servicios imagenPrincipal imagenes comentarios minimoDias');
        if (!cabin) {
            return res.status(404).json({ message: 'Cabaña no encontrada' });
        }

        return res.status(200).json({ cabin });
    } catch (error) {

        return res.status(500).json({ message: 'Error al obtener la cabaña' });
    }
}

const updateCabin = async (req, res) => {
    try {
        const updatedCabin = await Cabin.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedCabin) return res.status(404).json({
            mensaje: 'Cabaña no encontrada'
        });
        return res.status(200).json({
            status: 'success',
            updatedCabin
        })
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al actualizar la cabaña' });
    }
};

const getOpcionesCabania = async (req, res) => {
    try {
        const modelos = Cabin.getModelos();
        const disponibilidades = Cabin.getDisponibilidades();
        return res.status(200).json({
            modelos, disponibilidades
        });
    } catch (error) {
        return res.status(500).json({ message: "Error al obtener opciones", error });
    }
};

const changeState = async (req, res) => {
    try {
        const { id } = req.params;
        const cabin = await Cabin.findById(id);

        if (!cabin) {
            return res.status(404).json({ message: 'Cabaña no encontrada' });
        }

        cabin.estado = cabin.estado === 'Disponible' ? 'No Disponible' : 'Disponible';

        await cabin.save();
        res.json({ message: `Estado cambiado a ${cabin.estado}`, cabin });
    } catch (error) {
        res.status(500).json({ message: 'Error al cambiar el estado de la cabaña' });
    }
};

export default {
    getCabins,
    getServices,
    getActiveCabins,
    createCabin,
    uploadImageCabin,
    getCabin,
    getOpcionesCabania,
    updateCabin,
    changeState,
    deleteImageCabin
}
