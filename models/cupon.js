import mongoose from "mongoose";

const cuponSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true
        },
        description: {
            type: String,
            default: ""
        },
        discountType: {
            type: String,
            enum: ["percentage", "fixed"],
            required: true
        },
        discountValue: {
            type: Number,
            required: true,
            min: 0
        },
        maxUses: {
            type: Number,
            default: null
        },
        usedCount: {
            type: Number,
            default: 0
        },
        expiresAt: {
            type: Date,
            default: null
        },
        active: {
            type: Boolean,
            default: true
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

cuponSchema.methods.isValid = function () {
    const notExpired = !this.expiresAt || this.expiresAt > new Date();
    const underUseLimit = !this.maxUses || this.usedCount < this.maxUses;
    return this.active && notExpired && underUseLimit;
};

export default mongoose.model("Cupon", cuponSchema);
