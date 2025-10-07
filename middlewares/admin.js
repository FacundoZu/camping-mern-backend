
export const adminRequire = (req, res, next) => {
    if (req.user.role !== "admin") {
        return res.status(401).json({ message: "Acceso denegado" });
    }
    next();
};

export const gerenteRequire = (req, res, next) => {
    if (req.user.role === "admin" || req.user.role === "gerente") {
        return res.status(401).json({ message: "Acceso denegado" });
    }
    next();
};
