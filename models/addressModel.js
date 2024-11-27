const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
    district: {
        type: String,
        require: true
    },
    state: {
        type: String,
        require: true
    },
    pincode: {
        type: String,
        require: true
    },
    mobile: {
        type: String,
        require: true
    },
    address: {
        type: String,
        require: true
    },
    type: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        require: true
    },
    lastName: {
        type: String,
        require: true
    },
    alternativeMobile: { 
        type: String,
        require: true
    }
})

const Adress = mongoose.model("adress", addressSchema);
module.exports = Adress;