import User from "../models/user.js"
import { uploadFile } from '../utils/uploadFile.js'
import Token from '../models/token.js'
import { generateToken } from '../utils/token.js'
import { enviarEmailOlvideMiContraseña } from '../mailer.js'


const register = async (req, res) => {
    let params = req.body;

    if (!params.email || !params.password) {
        return res.status(400).json({
            status: "error",
            message: "Faltan datos por enviar"
        });
    }

    try {
        const existingUsers = await User.checkDuplicateUser(params.email);
        if (existingUsers && existingUsers.length >= 1) {
            return res.status(409).json({
                status: "error",
                message: "El usuario ya existe"
            });
        }
        let user_to_save = new User({
            email: params.email.toLowerCase(),
            name: params.name,
            phone: params.phone,
            address: params.address,
            role: 'cliente'
        });

        user_to_save.password = await user_to_save.encryptPassword(params.password);

        const token = await user_to_save.generateJWT();

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000  // Expiración en 7 días
        });
        user_to_save.save()
        return res.status(201).json({
            status: "success",
            message: "Usuario registrado correctamente",
            user: user_to_save,
            token
        });

    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error en la operación de registro de usuario",
            error: error.message
        });
    }
};

const login = async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send({
            status: "error",
            message: "Faltan datos por enviar"
        });
    }

    try {
        const userSearched = await User.findOne({ email: email });
        if (!userSearched) {
            return res.status(404).send({
                status: "error",
                message: "No existe el usuario"
            });
        }

        const isMatch = await userSearched.comparePassword(password);

        if (!isMatch) {
            return res.status(401).send({
                status: "error",
                message: "El usuario no se ha autenticado correctamente",
            });
        }
        
        const token = await userSearched.generateJWT();

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).send({
            status: "success",
            message: "Usuario autenticado correctamente",
            user: {
                id: userSearched._id,
                email: userSearched.email,
                name: userSearched.name,
                role: userSearched.role,
                image: userSearched.imageUrl
            },
        });

    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error al buscar el usuario",
            error: error.message
        });
    }
};

const logout = (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    });
    return res.sendStatus(200);
};

const forgotpassword = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({
            status: "error",
            message: "Faltan datos por enviar"
        });
    }
    try {
        const userSearched = await User.findOne({ email: email });
        if (!userSearched) {
            return res.status(404).json({
                status: "error",
                message: "No existe el usuario"
            });
        }
        const token = new Token()
        token.token = generateToken()
        token.user = userSearched.id
        await token.save()

        enviarEmailOlvideMiContraseña({
            email: userSearched.email,
            name: userSearched.name,
            token: token.token
        });
        res.json({ success: true });
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al buscar el usuario",
            error: error.message
        });
    }
}

const validateToken = async (req, res) => {
    try {
        const { token } = req.body

        const tokenExist = await Token.findOne({ token })
        if (!tokenExist) {
            const error = new Error('Token no valido')
            res.status(404).json({ error: error.message })
            return
        }
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: 'Hubo un error al crear la cuenta' })
    }
}

const updatePasswordWithToken = async (req, res) => {
    try {
        const { token, password, password_confirmation } = req.body

        if (!token || !password || !password_confirmation) {
            const error = new Error('Faltan datos por enviar')
            res.status(404).json({ error: error.message })
            return
        }

        const tokenExist = await Token.findOne({ token })
        if (!tokenExist) {
            const error = new Error('Token no valido')
            res.status(404).json({ error: error.message })
            return
        }

        if (password !== password_confirmation) {
            const error = new Error('Las contraseñas no son iguales')
            res.status(404).json({ error: error.message })
            return
        }

        const user = await User.findById(tokenExist.user)
        user.password = await user.encryptPassword(password)
        await Promise.allSettled([user.save(), tokenExist.deleteOne()])

        res.status(200).json({ success: true })
    } catch (error) {
        res.status(500).json({ error: 'Hubo un error al crear la cuenta' })
    }
}

const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 9, name, email, sortRole } = req.query;

        const filtros = {};

        if (name) filtros.name = { $regex: name, $options: 'i' };
        if (email) filtros.email = { $regex: email, $options: 'i' };

        let sort = {};
        if (sortRole) {
            sort.role = sortRole === 'asc' ? 1 : -1;
        }

        const users = await User.find(filtros)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .exec();
        const totalUsuarios = await User.countDocuments(filtros);

        res.status(200).json({
            status: 'success',
            users,
            totalUsuarios,
            totalPages: Math.ceil(totalUsuarios / limit),
            currentPage: Number(page),
        });
    } catch (error) {
        console.error("Error al obtener los usuarios:", error);
        res.status(500).json({
            status: 'error',
            message: 'Error al obtener los usuarios.',
        });
    }
};

const profile = async (req, res) => {
    try {
        let userFound = await User.findById(req.user.id);
        if (!req.user.id) {
            userFound = await User.findById(req.user.sub);
        }

        if (!userFound) {
            return res.status(400).json({
                menssage: "Usuario no encontrado",
            })
        }

        return res.status(200).json({
            status: "success",
            user: {
                id: userFound.id,
                email: userFound.email,
                name: userFound.name,
                role: userFound.role,
                image: userFound.imageUrl,
            }
        })
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al buscar usuario"
        })
    }
}

const profileById = async (req, res) => {
    try {
        const { id } = req.params;
        let userFound = await User.findById(id);

        if (!userFound) {
            return res.status(400).json({
                menssage: "Usuario no encontrado",
            })
        }

        return res.status(200).json({
            status: "success",
            user: {
                id: userFound.id,
                email: userFound.email,
                name: userFound.name,
                image: userFound.imageUrl,
                role: userFound.role
            }
        })
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al buscar usuario"
        })
    }
}

const completeProfile = async (req, res) => {
    try {
        let userFound = await User.findById(req.user.id);
        if (!req.user.id) {
            userFound = await User.findById(req.user.sub);
        }
        if (!userFound) {
            return res.status(400).json({
                menssage: "Usuario no encontrado",
            })
        }
        return res.status(200).json({
            status: "success",
            user: {
                id: userFound.id,
                email: userFound.email,
                name: userFound.name,
                image: userFound.imageUrl,
                phone: userFound.phone,
                address: userFound.address
            }
        })
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: "Error al buscar usuario"
        })
    }
}

const changeRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    const rolesPermitidos = ["admin", "gerente", "cliente"];
    if (!rolesPermitidos.includes(role)) {
        return res.status(400).json({
            status: "error",
            message: "Rol no válido",
        });
    }

    try {
        const usuarioActualizado = await User.findByIdAndUpdate(
            id,
            { role: role },
            { new: true }
        );

        if (!usuarioActualizado) {
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado",
            });
        }

        return res.json({
            status: "success",
            message: "Rol actualizado correctamente",
            user: usuarioActualizado,
        });
    } catch (error) {
        console.error("Error al actualizar el rol:", error);
        return res.status(500).json({
            status: "error",
            message: "Error al actualizar el rol",
        });
    }
}

const googleCallback = async (req, res) => {
    const token = await req.user.generateJWT();

    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 días
    });

    res.redirect('http://localhost:5173/');
};

const editUser = async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { name, phone, address },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
        }

        return res.json({
            status: 'success',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                image: updatedUser.imageUrl,
                phone: updatedUser.phone,
                address: updatedUser.address
            }
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al actualizar el perfil' });
    }
};

const uploadImage = async (req, res) => {
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

        const { downloadURL } = await uploadFile(image[0], 600, 600);
        const userId = req.user.id;

        const usuarioActualizado = await User.findOneAndUpdate(
            { _id: userId },
            { imageUrl: downloadURL },
            { new: true }
        );

        if (!usuarioActualizado) {
            return res.status(404).json({
                status: "error",
                message: "Usuario no encontrado"
            });
        }

        return res.status(200).json({
            status: "success",
            imageUrl: downloadURL,
            message: "Imagen actualizada correctamente",
        });

    } catch (error) {
        console.error("Error al subir la imagen:", error);
        return res.status(500).json({
            status: "error",
            message: "Error interno en el servidor"
        });
    }
};

const registerVisit = async (req, res) => {
    const { userId, cabinId } = req.body;

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const alreadyVisited = user.visitedCabins.some(
            (visit) => visit.cabinId.toString() === cabinId
        );

        if (!alreadyVisited) {
            user.visitedCabins.push({ cabinId });

            if (user.visitedCabins.length > 3) {
                user.visitedCabins.shift();
            }

            await user.save();
        }

        res.status(200).json({ message: "Visita registrada exitosamente" });
    } catch (error) {
        res.status(500).json({ message: "Error al registrar la visita", error });
    }
};

const getUserVisit = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await User.findById(id).populate({
            path: "visitedCabins.cabinId",
            populate: {
                path: "comentarios",
                model: "Review",
                select: "rating",
                match: { estado: "Habilitado" },
            },
            select: "imagenPrincipal nombre cantidadPersonas cantidadHabitaciones cantidadBaños",
        });

        if (!user) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const sortedVisits = user.visitedCabins.sort(
            (a, b) => new Date(b.visitedAt) - new Date(a.visitedAt)
        );

        const lastThreeVisits = sortedVisits.slice(0, 3).map((visit) => visit.cabinId);

        res.status(200).json(lastThreeVisits);
    } catch (error) {
        res.status(500).json({ message: "Error al obtener las cabañas visitadas", error });
    }
};

export default {
    register,
    login,
    logout,
    forgotpassword,
    validateToken,
    updatePasswordWithToken,
    profile,
    googleCallback,
    editUser,
    completeProfile,
    uploadImage,
    profileById,
    getAllUsers,
    changeRole,
    registerVisit,
    getUserVisit
}
