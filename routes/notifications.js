import express from 'express';
import Notifications from '../controllers/notifications.js';

const notificationRouter = express.Router();

notificationRouter.get('/', Notifications.getNotifications);
notificationRouter.put('/:id/read', Notifications.markAsRead);

export default notificationRouter;
