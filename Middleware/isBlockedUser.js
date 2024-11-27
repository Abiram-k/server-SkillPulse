const dotenv = require("dotenv");
const User = require("../models/userModel");
const path = require("node:path");
const jwt = require('jsonwebtoken');
dotenv.config({ path: path.resolve(__dirname, "../.env") });


exports.isBlocked = async (req, res, next) => {
    const { authUser } = req.body;
    try {

        if (authUser?.isBlocked) {
            req.body.isBlocked = true;
            return res.status(404).json({ message: `No access ,${authUser.firstName} were blocked by admin`, isBlocked: req.body.isBlocked });
        }
        else {
            res.status(200)
            next();
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server Error from isBlockedAuth" })
    }
}