import Notification from '../models/notifications.js';

export const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find().sort({ createdAt: -1 }).populate('userId', 'name');
        res.json(notifications.filter(n => n.isRead === false));
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener notificaciones', error });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        await Notification.findByIdAndUpdate(id, { isRead: true });
        res.json({ message: 'Notificación marcada como leída' });
    } catch (error) {
        res.status(500).json({ message: 'Error al marcar notificación como leída', error });
    }
};

export default {
    getNotifications,
    markAsRead
};