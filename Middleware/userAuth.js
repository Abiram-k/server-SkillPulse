const dotenv = require("dotenv");
const User = require("../models/userModel");
const path = require("node:path");
const jwt = require('jsonwebtoken');
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const BlacklistedToken = require("../models/blacklistModel");

// const redisClient = require("../config/redis")

exports.verifyUser = async (req, res, next) => {
    const token = req.cookies?.accessToken;

    const refreshToken = req.cookies?.refreshToken;

    // console.log("Access Token: ", token, "Refresh token: ", refreshToken, "Req: ", req.url, req.method)
    if (token) {
        try {
            // const isTokenBlacklisted =await redisClient.get(refreshToken);
            // if(isTokenBlacklisted !== 'active' ){
            //     console.log("Token is blacklisted");
            //     return res.status(401).json({message:"Token is blacklisted, Login again!"})
            // }

            const isTokenBlacklisted = await BlacklistedToken.findOne({ token: refreshToken });
            if (isTokenBlacklisted) {
                console.log("Token is blacklisted");
                return res.status(401).json({ message: "Token is blacklisted, Login again!" })
            }

            const decode = jwt.verify(token, process.env.ACCESS_TOKEN);

            const user = await User.findById(decode.id).select("-password");
            req.body.authUser = user;

            next();

        } catch (error) {
            // console.log(error);
            // console.log("User not authorized, token failed");
            return res.status(401).json({ message: "User not authorized, token failed" });
        }
    } else {
        console.log("Token not founded !");
        return res.status(401).json({ message: "token not found" });
    }
}
