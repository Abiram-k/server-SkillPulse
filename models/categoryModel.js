const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        default: "Not Added",
        required: false
    },
    image: {
        type: String,
        required: true
    },
    offer: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    maxDiscount: {
        type: Number,
        default: 0
    },
    isListed: {
        type: Boolean,
        require: true,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true })
const Category = mongoose.model("category", categorySchema);
module.exports = Category;