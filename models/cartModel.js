const mongoose = require('mongoose');
const cartSchema = new mongoose.Schema({
    products: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true,
            },
            quantity: {
                type: Number,
                required: true,
                min: 1,
            },
            totalPrice: {
                type: Number,
                required: true,
                min: 0
            },
            offeredPrice: {
                type: Number,
                min: 0,
                required: true
            }
        }
    ],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    appliedCoupon: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
        default: null
    },
    grandTotal: {
        type: Number,
        default: 0,
        min: 0,
        // require: true
    },
    totalDiscount: {
        type: Number,
        default: 0,
        min: 0
    }
});


const Cart = mongoose.model('Cart', cartSchema);
module.exports = Cart