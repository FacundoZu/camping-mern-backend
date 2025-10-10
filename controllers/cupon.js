import Cupon from "../models/cupon.js";

export const createCupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, maxUses, expiresAt } = req.body;

        const existing = await Cupon.findOne({ code: code.toUpperCase() });
        if (existing) return res.status(400).json({ message: "El código ya existe." });

        const cupon = new Cupon({
            code: code.toUpperCase(),
            description,
            discountType,
            discountValue,
            maxUses: maxUses || null,
            expiresAt: expiresAt || null,
            createdBy: req.user.id
        });

        await cupon.save();
        res.status(201).json(cupon);
    } catch (error) {
        res.status(500).json({ message: "Error al crear el cupón", error: error.message });
    }
};

export const getCupons = async (req, res) => {
    try {
        const cupons = await Cupon.find().sort({ createdAt: -1 });
        res.json(cupons);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener cupones" });
    }
};

export const getCuponById = async (req, res) => {
    try {
        const cupon = await Cupon.findById(req.params.id);
        if (!cupon) return res.status(404).json({ message: "Cupón no encontrado" });
        res.json(cupon);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener el cupón" });
    }
};

export const updateCupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, maxUses, expiresAt, active } = req.body;
        const cupon = await Cupon.findByIdAndUpdate(
            req.params.id,
            {
                code: code?.toUpperCase(),
                description,
                discountType,
                discountValue,
                maxUses: maxUses || null,
                expiresAt: expiresAt || null,
                active
            },
            { new: true }
        );

        if (!cupon) return res.status(404).json({ message: "Cupón no encontrado" });

        res.json(cupon);
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar el cupón" });
    }
};

export const changeCuponStatus = async (req, res) => {
    try {
        const cupon = await Cupon.findById(req.params.id);
        cupon.active = !cupon.active
        await cupon.save()
        if (!cupon) return res.status(404).json({ message: "Cupón no encontrado" });
        res.json({ message: "Status actualizado correctamente" });
    } catch (error) {
        res.status(500).json({ message: "Error al actualizar el cupón" });
    }
};

export const deleteCupon = async (req, res) => {
    try {
        const cupon = await Cupon.findByIdAndDelete(req.params.id);
        if (!cupon) return res.status(404).json({ message: "Cupón no encontrado" });
        res.json({ message: "Cupón eliminado correctamente" });
    } catch (error) {
        res.status(500).json({ message: "Error al eliminar el cupón" });
    }
};

export const validateCupon = async (req, res) => {
    try {
        const { code } = req.body;
        const cupon = await Cupon.findOne({ code: code.toUpperCase() });

        if (!cupon) return res.status(404).json({ message: "Cupón no encontrado" });
        if (!cupon.active) return res.status(400).json({ message: "El cupón no es válido o está vencido." });
        if (cupon.expiresAt && new Date() > cupon.expiresAt) return res.status(400).json({ message: "El cupón no es válido o está vencido." });
        if (cupon.maxUses && cupon.usedCount >= cupon.maxUses) return res.status(400).json({ message: "El cupón no es válido o está vencido." });

        res.json({
            valid: true,
            discountType: cupon.discountType,
            discountValue: cupon.discountValue
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: "Error al validar el cupón" });
    }
};

export const incrementUseCount = async (cuponCode) => {
    const cupon = await Cupon.findOne({ code: cuponCode.toUpperCase() });
    if (cupon && (cupon.usedCount < cupon.maxUses || cupon.maxUses !== null)) {
        cupon.usedCount += 1;
        await cupon.save();
    }
};

export default {
    createCupon,
    getCupons,
    getCuponById,
    updateCupon,
    changeCuponStatus,
    deleteCupon,
    validateCupon,
    incrementUseCount
};
