const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        default: "Nil",
        required: false
    },
    image: {
        type: String,
        required: true
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
const Brand = mongoose.model("brand", brandSchema);
module.exports = Brand;