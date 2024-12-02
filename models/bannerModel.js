const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    description: {
        type: String,
        default: "Nill",
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
}, { timestamps: true })

const Banner = mongoose.model("banner", bannerSchema);
module.exports = Banner;