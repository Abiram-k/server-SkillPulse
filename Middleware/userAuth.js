const dotenv = require("dotenv");
const User = require("../models/userModel");
const path = require("node:path");
const jwt = require('jsonwebtoken');
dotenv.config({ path: path.resolve(__dirname, "../.env") });

exports.verifyUser = async (req, res, next) => {
    const token = req.cookies?.userToken;
    if (token) {
        try {
            const decode = jwt.verify(token, process.env.JWT_SECRETE);
            const user = await User.findById(decode.id).select("-password");
            req.body.authUser = user;
            next();
        } catch (error) {
            console.log(error);
            res.status(401);
            console.log("User not authorized, token failed");
        }
    } else {
        res.status(401).json({ message: "token not found" });
        console.log("Token not founded");
    }
}
