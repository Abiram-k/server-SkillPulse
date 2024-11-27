const mongoose = require("mongoose");

const AdminSchema = new mongoose.Schema({
    firstName: {
        type: String,
        default: "admin"
    },
    lastName: {
        type: String,
        default: ""
    },
    email: {
        type: String,
        require: true,
        unique: true
    },
    password: {
        type: String,

        require: true
    },
    mobileNumber: {
        type: String,
        default: ""
    },
    profileImage: {
        type: String,
        default: ""
    },
    dateOfBirth: {
        type: Date,
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
})

AdminSchema.methods.comparePassword = async (password) => {
    return await bcrypt.compare(password, this.password);
}
const Admin = mongoose.model("admin", AdminSchema);
module.exports = Admin;