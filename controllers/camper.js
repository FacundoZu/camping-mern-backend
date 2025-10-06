import Camper from '../models/camper.js';

export const createCamper = async (req, res) => {
    try {
        const camper = new Camper(req.body);
        await camper.save();
        res.status(201).json(camper);
    } catch (error) {
        res.status(500).json({ message: 'Error al registrar el acampante', error });
    }
};

export const getCampers = async (req, res) => {
    try {
        // Parámetros de paginación (con valores por defecto)
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        // Calcular el número de documentos a omitir
        const skip = (page - 1) * limit;

        // Obtener los acampantes con paginación
        const campers = await Camper.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Contar el total de documentos
        const totalCampers = await Camper.countDocuments();

        // Calcular el total de páginas
        const totalPages = Math.ceil(totalCampers / limit);

        res.status(200).json({
            status: "success",
            campers,
            currentPage: page,
            totalPages,
            totalCampers,
        });
    } catch (error) {
        res.status(500).json({
            message: "Error al obtener los acampantes",
            error: error.message,
        });
    }
};


export default {
    createCamper,
    getCampers
}