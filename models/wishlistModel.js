const mongoose = require('mongoose');
const wishlistSchema = new mongoose.Schema({

    products: [
        {
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                required: true,
            }
        }
    ],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });


const Cart = mongoose.model('Wishlist', wishlistSchema);
module.exports = Cart