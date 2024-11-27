const jwt = require("jsonwebtoken");
const Admin = require("../models/adminModel");
const path = require("node:path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

exports.verifyAdmin = async (req, res, next) => {
    const token = req.cookies.adminToken;
    // console.log(token);
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRETE);
            const admin = await Admin.findById(decoded.id).select("-password");
            next();
        } catch (error) {
            console.log(error)
            res.status(500).json({ message: "Failed to authenticate Admin" })
        }
    } else {
        console.log("Token not founded");
        res.status(404).json({ message: "Token not found" })
    }
}