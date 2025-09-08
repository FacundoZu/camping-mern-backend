import mongoose, { Schema, Types } from 'mongoose'
import User from './user.js'

const tokenSchema = new Schema({
    token: {
        type: String,
        required: true
    },
    user: {
        type: Types.ObjectId,
        ref: User
    },
    expiresAt: {
        type: Date,
        default: Date.now(),
        expires: '10m'
    }
})
const Token = mongoose.model('Token', tokenSchema)
export default Token