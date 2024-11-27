const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    couponCode: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
    },
    description: {
        type: String,
        required: true,
    },
    couponType: {
        type: String,
        enum: ['Percentage', 'Amount'],
        required: true,
        set: (value) => value.trim()
    },
    couponAmount: {
        type: String,
        required: true,
    },
    purchaseAmount: {
        type: Number,
        required: true,
    },
    expirationDate: {
        type: Date,
        required: true,
    },
    maxDiscount: {
        type: Number,
        required: true,
    },
    totalLimit: {
        type: Number,
        default: null,
    },
    perUserLimit: {
        type: Number,
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
