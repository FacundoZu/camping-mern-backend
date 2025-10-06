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

export const getCampersStats = async (req, res) => {
    try {
        const totalCampers = await Camper.countDocuments();

        // Total de personas (adultos + niños)
        const campers = await Camper.find({}, 'cantidadPersonas cantidadNinos vehiculo motorhome diasEstancia precioPorDia fechaIngreso');

        const campersPorMes = new Array(12).fill(0);
        campers.forEach(c => {
            if (c.fechaIngreso) {
                const mes = new Date(c.fechaIngreso).getMonth();
                campersPorMes[mes] += (c.cantidadPersonas || 0) + (c.cantidadNinos || 0);
            }
        });

        let totalPersonas = 0;
        let totalNiños = 0;
        let totalVehiculos = 0;
        let totalMotorhomes = 0;
        let totalEstancia = 0;
        let totalIngresos = 0;

        campers.forEach(c => {
            totalPersonas += c.cantidadPersonas || 0;
            totalNiños += c.cantidadNinos || 0;
            if (c.vehiculo) totalVehiculos++;
            if (c.motorhome) totalMotorhomes++;
            totalEstancia += c.diasEstancia || 0;
            totalIngresos += (c.precioPorDia || 0) * (c.diasEstancia || 0);
        });

        const promedioEstancia = totalCampers > 0 ? (totalEstancia / totalCampers).toFixed(1) : 0;

        res.status(200).json({
            totalCampers,
            totalPersonas,
            totalNiños,
            totalVehiculos,
            totalMotorhomes,
            promedioEstancia,
            totalIngresos,
            campersPorMes,
        });
    } catch (error) {
        res.status(500).json({
            message: 'Error al obtener estadísticas de acampantes',
            error: error.message,
        });
    }
};


export default {
    createCamper,
    getCampers,
    getCampersStats
}