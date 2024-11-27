const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },
    transaction: [
        {
            amount: {
                type: String,
                required: true,
            },
            description: {
                type: String,
                default: "Not added"
            },
            transactionId: {
                type: String,
                required: true,
                // unique: true
            },
            date: {
                type: Date,
                default: Date.now
            }
        }
    ],
    totalAmount: {
        type: Number,
        required: true
    }
}, { timestamps: true });

const Wallet = mongoose.model("Wallet", walletSchema);

module.exports = Wallet;
