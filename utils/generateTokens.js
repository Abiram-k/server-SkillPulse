

const path = require("path");
const dotenv = require('dotenv');
const RefreshToken = require("../models/refreshTokenModel");
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const jwt = require('jsonwebtoken');


const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

exports.generateRefreshToken = async (userId, req) => {
    const token = jwt.sign({ id: userId }, REFRESH_TOKEN, { expiresIn: "7d" });

    const expiresAt = new Date(); 
    expiresAt.setDate(expiresAt.getDate() + 7);
    const device = req.headers['user-agent'];

    await RefreshToken.create({
        token,
        userId,
        device,
        expiresAt
    });
    // await redisClient.set(token, 'active', 'EX', 7 * 24 * 60 * 60);//tried to use redis, will work later
    return token;
}
exports.generateAccessToken = (userId) => {
    const token = jwt.sign({ id: userId }, ACCESS_TOKEN, { expiresIn: "15m" });
    return token;
}
