// models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    type: { type: String, required: true },
    message: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cabaniaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cabania' },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Notification', notificationSchema);
