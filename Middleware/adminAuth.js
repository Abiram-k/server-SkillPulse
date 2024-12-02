const jwt = require("jsonwebtoken");
const Admin = require("../models/adminModel");
const path = require("node:path");
const dotenv = require("dotenv");
const BlacklistedToken = require("../models/blacklistModel");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

exports.verifyAdmin = async (req, res, next) => {
    const token = req.cookies.adminToken;
    if (token) {
        try {
            const isTokenBlacklisted = await BlacklistedToken.findOne({ token });
            if (isTokenBlacklisted) {
                console.log("Token is blacklisted");
                return res.status(401).json({ message: "Token is blacklisted, Login again!" })
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRETE);
            const admin = await Admin.findById(decoded.id).select("-password");
            next();
            
        } catch (error) {
            console.log(error);
            res.setHeader('Access-Control-Allow-Origin', 'https://skillpulse.abiram.website');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
          return  res.status(500).json({ message: "Failed to authenticate Admin" })
        }
    } else {
        console.log("Token not founded");
        res.setHeader('Access-Control-Allow-Origin', 'https://skillpulse.abiram.website');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
       return res.status(404).json({ message: "Token not found" })
    }
}