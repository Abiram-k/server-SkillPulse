const Admin = require("../../models/adminModel");
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
dotenv.config()
const jwt = require('jsonwebtoken');
const User = require("../../models/userModel");
const BlacklistedToken = require("../../models/blacklistModel");



exports.customers = async (req, res) => {
    try {
        const { sort, startDate, endDate, search, page = 1, limit = 8 } = req.query;
        const query = {};
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        if (search) {
            query.$or = [
                { email: { $regex: search, $options: "i" } },
                { firstName: { $regex: search, $options: "i" } }
            ];
        }

        const sortObj = {};
        if (sort === "A-Z") {
            sortObj.firstName = 1;
        } else if (sort === "Z-A") {
            sortObj.firstName = -1;
        } else if (sort === "oldest") {
            sortObj.createdAt = 1;
        } else {
            sortObj.createdAt = -1;
        }


        const totalDocument = await User.countDocuments(query);
        const pageCount = Math.ceil(totalDocument / limit)
        const users = await User.find(query).sort(sortObj).skip((page - 1) * limit).limit(limit);

        return res.status(200).json({ message: "success", users, pageCount });
    } catch (error) {
        return res.status(500).json({ message: "Internal server error" });
    }
}

exports.blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById({ _id: id });
        user.isBlocked = !user.isBlocked
        await user.save();
        return res.status(200).json({ message: "User bloked successfully", name: user.firstName, user })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: "Failed to block user" })
    }
}

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // const hashed =await bcrypt.hash(password, 10);
        // await Admin.create({ email, password: hashed });
        const admin = await Admin.findOne({ email });
        if (!admin)
            return res.status(400).json({ message: "Check the email id" })
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch)
            return res.status(400).json({ message: "Check the password" })


        const token = jwt.sign({ id: admin._id }, process.env.JWT_SECRETE, { expiresIn: '30d' });

        res.cookie('adminToken',
            token,
            {
                httpOnly: true,
                secure: true,
                sameSite: 'None',
                maxAge: 30 * 24 * 60 * 60 * 1000
            });

        const adminData = {
            email, password
        }
        return res.status(200).json({ message: "Login Successfull", adminData });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message });
    }
}

exports.logout = async (req, res) => {
    try {
        const token = req.cookies.adminToken;
        await BlacklistedToken.create({ token, role: "Admin" }).then(() => console.log("Black listed successfully")).catch((error) => console.log("Failed to black list token", error))
        res.clearCookie('adminToken');
        return res.status(200).json({ message: "Successfully logged out" })
    } catch (error) {
        console.log(error);
        return res.status(501).json({ message: "Failed to logout admin" });
    }
}