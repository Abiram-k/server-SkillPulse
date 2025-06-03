const User = require('../models/userModel');
const nodeMailer = require("nodemailer");
const path = require("path");
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Product = require('../models/productModel');
const Category = require('../models/categoryModel');
const Brand = require('../models/brandModel');
const { isBlocked } = require('../Middleware/isBlockedUser');
const { listCategory, blockUser } = require('./adminController');
const Cart = require('../models/cartModel');
const Wallet = require('../models/walletModel');
const RefreshToken = require('../models/refreshTokenModel');
dotenv.config({ path: path.resolve(__dirname, "../.env") })
const BlacklistedToken = require("../models/blacklistModel")
// const redisClient = require("../config/redis");


//helper function to generate otp
const generateOTP = () => {
    const otp = Math.floor(100000 + Math.random() * 900000);
    return otp;
}

//helper function to generate Refreshtoken
const generateRefreshToken = async (userId, req) => {
    const token = jwt.sign({ id: userId }, process.env.REFRESH_TOKEN, { expiresIn: "7d" });

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

//helper fuction to generate accesstoken
const generateAccessToken = (userId) => {
    const token = jwt.sign({ id: userId }, process.env.ACCESS_TOKEN, { expiresIn: "15m" });
    return token;
}

//helper fucntion to generate new access token when access token expires
exports.generateNewToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        console.log('Refresh token not found')
        return res.status(401).json({ message: 'Refresh token not found' });
    }

    try {
        const hasAccess = await RefreshToken.findOne({ token: refreshToken });

        if (!hasAccess) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        const user = jwt.verify(refreshToken, process.env.REFRESH_TOKEN);

        const accessToken = jwt.sign({ id: user.id }, process.env.ACCESS_TOKEN, { expiresIn: '15m' });

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'None',
            maxAge: 15 * 60 * 1000,
        });

        res.json({ message: 'Access token refreshed' });

    } catch (err) {
        res.status(403).json({ message: 'Invalid refresh token' });
    }
}

// user logout
exports.logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(400).json({ message: "No refresh token provided" });

    try {
        await RefreshToken.deleteOne({ token: refreshToken }).catch((error) => console.log("Error while deleting refresh token from db", error));

        const ttl = 60 * 60 * 24 * 7;
        // redisClient.setEx(refreshToken, ttl, "blacklisted");

        await BlacklistedToken.create({ token: refreshToken });

        res.clearCookie("refreshToken", {
            httpOnly: true,
            secure: true,
            sameSite: "None"
        });

        res.json({ message: "Logged out successfully" });

    } catch (error) {
        console.error("Error blacklisting refresh token:", error);
        res.status(500).json({ message: "Failed to log out" });
    }
}

//basic route to illustrate the server is currently running
exports.baseRoute = (req, res) => {
    res.status(200).send("SERVER IS RUNNING...");
}

//this is a middleware to make service for gmail
const transporter = nodeMailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL, // Email id of use
        pass: process.env.NODEMAILER_PASSWORD,// Password for nodemailer
    }
});

//its an helper function for to send otp
const sendOTPEmail = async (email, otp, name) => {
    console.log("OTP IS:", otp);
    try {
        const mailCredentials = {
            from: "abiramk0107@gmail.com",
            to: email,
            subject: 'SKILL PULSE ,Your OTP for Signup ',
            text: `Dear ${name},

            Thank you for signing up! Your One-Time Password (OTP) for completing your signup process is:One-Time-Password is: ${otp}
            Please enter this OTP on the signup page to verify your account. This OTP is valid for a limited time only, so please use it promptly.
            If you did not initiate this request, please ignore this email. Your account security is important to us.

            Best regards,  
            The [SkillPulse] Team`,

        };
        await transporter.sendMail(mailCredentials);
        console.log('OTP sent successfully');
        return true
    } catch (error) {
        console.error('Error sending OTP:', error);
        return false;
    }
}




exports.signUp = async (req, res) => {

    const { firstName, email } = req.body;

    const existingUser = await User.findOne({
        email:
            { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }
    })

    if (existingUser) {

        return res.status(400).json({ message: "User already exists" });
    } else {
        const otp = generateOTP();
        const otpSent = await sendOTPEmail(email, otp, firstName);

        if (!otpSent) {
            return res.status(500).json({ message: "Failed to send OTP" });
        }
        req.session.user = req.body;
        req.session.otp = otp;

        return res.status(200).json({ message: "Proceeded to Otp verification" })
    }
}

exports.otp = async (req, res) => {
    const { otp } = req.body;
    // const newUser = req.session.user;
    try {
        if (!req.session.otp) {
            return res.status(400).json({ message: "Otp expired !" })
        }
        else if (!req.session.user) {
            return res.status(400).json({ message: "User not found" });
        }
        else if (req.session.otp == otp) {
            function generateReferralCode(length = 8) { // helper function for generate unique referral id to the users
                const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                let referralCode = "";

                for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(Math.random() * characters.length);
                    referralCode += characters[randomIndex];
                }
                return referralCode;
            }
            req.session.user.referralCode = generateReferralCode();// storing it in session for further use
            const user = await User.create(req.session.user)
            res.status(200).json({ message: "User Created Succesfully", user })
            req.session.otp = null;
        } else {

            return res.status(400).json({ message: "Incorrect Otp !" })
        }
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message })
    }
}


exports.resendOtp = async (req, res) => {
    try {

        const otp = generateOTP();
        req.session.otp = otp; // re assaigning the otp with new otp
        req.session.save((err) => { // this ensure the session is successfully saved
            if (err) {
                console.error("Session save error:", err);
                return res.status(500).json({ message: "Failed to store session" });
            }
        });


        if (req.session.user) {
            const email = req.session.user.email
            const otpSent = await sendOTPEmail(email, otp);
            if (!otpSent) {
                return res.status(500).json({ message: "Failed to send OTP" });
            } else {
                return res.status(200).json({ message: "Otp resended !" })
            }
        } else {
            return res.status(400).json({ message: "User not found" });
        }
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: error.message });
    }
}
//helper function for password reset
const passResetEmail = async (email, otp, name) => {
    console.log("OTP IS:", otp);
    try {
        const mailCredentials = {

            from: "abiramk0107@gmail.com",
            to: email,
            subject: 'Skill Pulse - OTP for Password Reset',
            text: `Dear ${name},

             Thank you for reaching out to reset your password. Your One-Time Password (OTP) for completing the password reset process is: ${otp}

             Please enter this OTP on the password reset page to proceed with resetting your account password. Note that this OTP is valid only for a limited time, so please use it as soon as possible.
             If you did not initiate this request, please ignore this email. Your account security is our priority.

             Best regards,  
             The Skill Pulse Team`
        };

        await transporter.sendMail(mailCredentials);
        console.log('OTP sent successfully');
        return true;
    } catch (error) {
        console.error('Error sending OTP:', error);
        return false;
    }
}

exports.verifyEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user)
            return res.status(400).json({ message: "Email id not found" })
        const otp = generateOTP();
        req.session.resetPassOtp = otp;
        const otpSuccess = await passResetEmail(email, otp, user.firstName)
        if (!otpSuccess)
            console.log("Otp verification Failed")
        return res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while verifying email" })
    }
}

exports.verifyResetOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const validOtp = req.session.resetPassOtp;
        if (otp && otp != validOtp)
            return res.status(400).json({ message: "Otp is incorrect" });
        else
            return res.status(200).json({ message: "Verification completed" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while verifying otp" })
    }
}

exports.forgotPassword = async (req, res) => {

    try {
        const { newPassword } = req.body;
        const email = req.body.email.replace(/"/g, '').trim();
        console.log(email)
        console.log(newPassword)
        const user = await User.findOne({ email });
        console.log(user)

        const existingPass = await bcrypt.compare(newPassword, user.password);

        if (existingPass)
            return res.status(404).json({ message: "This password is already in use" })

        if (!user)
            return res.status(404).json({ message: "User not found" })
        user.password = newPassword;
        await user.save();
        return res.status(200).json({ message: "Password Reseted" })
    } catch (error) {

        console.log(error);
        return res.status(500).json({ message: "Error occured while resetting password" })
    }
}

exports.login = async (req, res) => {
    try {
        const { email, password, referralCode } = req.body;
        const user = await User.findOne({
            email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }
        });
        if (!user) {
            return res.status(400).json({ message: "User not found !" });
        }
        else {
            const walletDoc = await Wallet.findOne({ user: user._id })
            if (!walletDoc) {
                const wallet = new Wallet({
                    user: user._id,
                    totalAmount: 0,
                    transaction: []
                })
                await wallet.save();
            }
            if (referralCode) {
                if (user.isreferredUser) {
                    return res.status(400).json({ message: "You already a reffered user" })
                }
                if (user.referralCode == referralCode) {
                    return res.status(400).json({ message: "You cannot use your own code" })
                } else {
                    const refUser = await User.findOne({ referralCode });
                    if (!refUser || refUser._id == user._id) {
                        console.log("Ref user not found")
                        return res.status(400).json({ message: "Ref user not found" });
                    } else {
                        const refWallet = await Wallet.findOne({ user: refUser._id })
                        if (!refWallet)
                            console.log("Failed to find refWallet");
                        const refferedWallet = await Wallet.findOne({ user: user._id });
                        if (!refferedWallet)
                            console.log("Failed to find reffered wallet")
                        const walletData = {
                            amount: 200,
                            description: "Referral Bonus",
                            transactionId: `REF-${user._id}-${Date.now()}`
                        }
                        await Wallet.findOneAndUpdate({ user: refUser._id }, { $push: { transaction: walletData }, $inc: { totalAmount: parseFloat(200) } }, { upsert: true, new: true });

                        await Wallet.findOneAndUpdate({ user: user._id }, { $push: { transaction: walletData }, $inc: { totalAmount: parseFloat(200) } }, { upsert: true, new: true });

                        refUser.referredCount += 1
                        await refUser.save()
                        user.isreferredUser = true;
                        user.save()
                    }
                }
            }
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {

                return res.status(400).json({ message: "Password is incorrect" });
            }
            else if (user.isBlocked) {

                return res.status(400).json({ message: "User were blocked " });
            }
            else {
                const refreshToken = await generateRefreshToken(user?._id, req);//calling function to generate new refresh token
                const accessToken = generateAccessToken(user?._id);//calling function to generate new access token

                res.cookie('accessToken', accessToken, {
                    httpOnly: true,//
                    secure: true,
                    sameSite: 'None',
                    maxAge: 15 * 60 * 1000,
                });

                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,//flag restricts the cookie to be accessible only via HTTP(S)
                    secure: true,// flag ensures that the cookie is sent only over HTTPS connections.
                    sameSite: 'None',//The cookie is sent with both same-site and cross-site requests.
                    maxAge: 7 * 24 * 60 * 60 * 1000,//life span of a cookie
                });

                return res.status(200).json({ message: "Successfully Logged in", user });
            }
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message });
    }
}

//its for setting data for google user
exports.getUserData = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;
        if (!token) return res.status(401).send("Unauthorized");
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN);
        const user = await User.findById(decoded.id).select("-password");
        res.status(200).json(user);
    } catch (error) {
        res.status(400).json({ message: "Failed to retrieve user data", error });
    }
}



//Product Fetching for listing
exports.getProducts = async (req, res) => {

    try {
        const { brand, category, price, newArrivals, offer } = req.query;
        const query = {};

        if (category) {
            const categoryDoc = await Category.findOne({ name: category });
            if (categoryDoc) query.category = categoryDoc._id.toString();
        }

        if (brand) {
            const brandDoc = await Brand.findOne({ name: brand });
            if (brandDoc) query.brand = brandDoc._id.toString();
        }

        if (price) {
            if (price === 'below-5000') {
                query.salesPrice = { $lt: 5000 };
            } else if (price === '5000-10000') {
                query.salesPrice = { $gte: 5000, $lte: 10000 };
            } else if (price === '10000-50000') {
                query.salesPrice = { $gte: 10000, $lte: 50000 };
            } else if (price === 'above-50000') {
                query.salesPrice = { $gt: 50000 };
            }
        }
        if (offer) {
            if (offer === "10-20") {
                query.offer = { $lte: 20, $gte: 10 };
            } else if (offer === "20-30") {
                query.offer = { $lte: 30, $gte: 20 };
            } else if (offer === "above-50") {
                query.offer = { $gte: 50 };
            }
        }

        let sortOrder = {};

        if (newArrivals) {
            const currentDate = new Date();
            currentDate.setDate(currentDate.getDate() - 30);
            query.createdAt = { $gt: currentDate };
            sortOrder = { createdAt: -1 };
        }

        if (price === 'High-Low') {
            sortOrder = { ...sortOrder, salesPrice: -1 };
        } else if (price === 'Low-High') {
            sortOrder = { ...sortOrder, salesPrice: 1 };
        }

        const products = await Product.find(query)
            .sort(sortOrder)
            .populate('category')
            .populate('brand');

        const categoryDoc = await Category.find();
        const brandDoc = await Brand.find();

        return res.status(200).json({
            message: "Successfully Fetched All Products",
            products,
            categoryDoc,
            brandDoc,
            isBlocked: req.body.isBlocked || false
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        return res.status(500).json({ message: "Failed To Fetch Product Data" });
    }
};

exports.getProductDetails = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id)
            return res.status(400).json({ message: "Product id not founded" });
        if (id.length < 24)
            return res.status(400).json({ message: "Invalid product" });
        const productData = await Product.findOne({ _id: id });
        if (!productData)
            return res.status(404).json({ message: "Product not founded" });

        res.status(200).json({ message: "Product data fetched successfully", productData });
    } catch (error) {
        console.log("Executed")
        console.log("Error fetching products details:", error);
        return res.status(500).json({ message: "Failed To Fetch Product Data" });
    }
}


exports.getSimilarProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const productData = await Product.findById(id);
        const similarProducts = await Product.find({ category: productData?.category })
            .populate("brand")
        if (similarProducts.length === 0)
            return res.status(404).json({ message: "No Similar products were founded !" })
        return res.status(200).json({ message: "Products fetched successfully", similarProducts });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: error.message || "Server error" });
    }
}

exports.getBrandCategoryInfo = async (req, res) => {

    try {
        const { id } = req.params;

        const productData = await Product.findById(id).populate('category brand');
        if (!productData) {
            return res.status(404).json({ message: "Product not found" });
        }
        const { category, brand } = productData;

        const isCategoryAvailable = category && category.isListed && !category.isDeleted;
        const isBrandAvailable = brand && brand.isListed && !brand.isDeleted;

        const isAvailable = isCategoryAvailable && isBrandAvailable;

        return res.status(200).json({ message: "success", isAvailable });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occurred fetching product/brand details" });
    }
}

/////////////////// User Profile ////////////////////////

exports.updateUser = async (req, res) => {

    try {
        const { firstName, lastName, mobileNumber, dateOfBirth } = req.body;
        const { id } = req.query;
        const profileImage = req.file?.path;

        const validDateOfBirth = dateOfBirth && !isNaN(Date.parse(dateOfBirth))
            ? new Date(dateOfBirth)
            : null;
        const userData = {
            firstName, lastName, mobileNumber, profileImage, dateOfBirth: validDateOfBirth
        };


        const updatedUser = await User.findByIdAndUpdate(id, { $set: userData }, { new: true, upsert: true });

        if (updatedUser) {
            return res.status(200).json({ message: "Profile successfully updated", updatedUser });
        }
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "Filed to update your profile" })
    }
}

exports.getUser = async (req, res) => {
    try {
        const id = req.body.authUser._id
        // const { id } = req.query;
        const userData = await User.findById(id);
        return res.status(200).json({ message: "User successfully fetched", userData });

    } catch (error) {

        console.log(error.message);
        console.log(error);
        return res.status(500).json({ message: "Failed to fetch user data !" });

    }
}


exports.addAddress = async (req, res) => {
    try {
        const { firstName, secondName, mobileNumber, alternativeMobile, city, state, address, pincode, type } = req.body;
        const { id } = req.query;
        const user = await User.findById(id);
        if (!user.address) {
            user.address = [];
        } else {
            if (user.address.some((addr) => addr.address === address)) {
                console.log("User already exists")
                return res.status(400).json({ message: "Address already exists" })
            }
        }
        user.address.push({ firstName, secondName, mobileNumber, alternativeMobile, city, state, address, pincode, type });
        await user.save();
        return res.status(200).json({ message: "Address added successfully" })
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: error.message || "Error occured while adding address" })
    }
}

exports.getAddress = async (req, res) => {
    try {
        const { id, addrId } = req.query;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        let addresses = user.address || [];
        let selectedAddress;
        if (addrId) {
            selectedAddress = addresses.find((addr) => addr._id.toString() === addrId);
            if (!selectedAddress) {
                return res.status(404).json({ message: "Address not found" });
            }
            user.deliveryAddress = addrId;
            await user.save();
        } else {
            selectedAddress = addresses.find(
                (addr) => addr._id.toString() === user.deliveryAddress
            ) || addresses[0];
        }
        if (!addresses.length) {
            return res.status(404).json({ message: "You can add address here" });
        }
        return res.status(200).json({
            message: "Address successfully fetched",
            addresses,
            selectedAddress,
        });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({
            message: error.message || "Error occurred while fetching address",
        });
    }
};


exports.getEditAddress = async (req, res) => {
    try {
        const { id } = req.query;
        const [addressObj] = await User.find({ "address._id": id }, { "address.$": 1 })
        const [address] = addressObj.address
        return res.status(200).json({ message: "Successfully fetched edit address details", address })
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "Failed to fetch details,You can enter details" })
    }
}

exports.editAddress = async (req, res) => {

    try {
        const {
            firstName,
            secondName,
            mobileNumber,
            alternativeMobile,
            city,
            state,
            pincode,
            type,
            address
        } = req.body;


        const { id } = req.query;

        const user = await User.findOne({ "address._id": id });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const addressIndex = user.address.findIndex(addr => addr._id.toString() === id);

        if (addressIndex === -1) {
            return res.status(404).json({ message: "Address not found." });
        }

        user.address[addressIndex] = {
            ...user.address[addressIndex],
            firstName,
            secondName,
            mobileNumber,
            alternativeMobile,
            city,
            state,
            address,
            pincode,
            type
        };
        await user.save();

        return res.status(200).json({ message: "Address updated successfully.", address: user.address[addressIndex] });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Failed to update address. Please try again later." });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const { id } = req.query;

        const user = await User.findOne({ "address._id": id });
        const addressIndex = user.address.findIndex((addr, index) => addr._id.toString() == id);

        if (addressIndex == -1)
            return res.status(404).json({ message: "address not founded" });
        user.address.splice(addressIndex, 1);
        await user.save();
        return res.status(200).json({ message: "Address deleted successfully" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while deleting address" })
    }
}

exports.changePassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { currentPassword, newPassword } = req.body;



        const user = await User.findById(id);
        if (!user) {
            console.log("User not found");
            return res.status(404).json({ message: "User not found" });
        }

        console.log("User found, checking current password...");

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            console.log("Current password is incorrect");
            return res.status(400).json({ message: "Please enter the correct password" });
        }

        console.log("Current password is correct, hashing new password...");

        user.password = newPassword;

        console.log("Saving new password...");
        await user.save();

        console.log("Password changed successfully");
        return res.status(200).json({ message: "Password changed successfully" });

    } catch (error) {
        console.error("Error occurred:", error);
        return res.status(500).json({ message: "An error occurred while changing the password" });
    }
};

exports.addToCart = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.query;
        if (!userId) {
            res.status(401).json({ message: "Login to you account, to add items" })
        }
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        let cart = await Cart.findOne({ user: userId }).populate("appliedCoupon")

        if (cart) {
            cart.products.push({ product: id, quantity: 1, totalPrice: product.salesPrice, offeredPrice: product.salesPrice });
            cart.grandTotal = cart.products.reduce((acc, product, index) => product.totalPrice + acc, 0);
            cart.totalDiscount = cart.products.reduce((acc, product, index) => product.totalPrice + acc, 0);
            cart.appliedCoupon = null
        } else {
            cart = new Cart({
                products: [{ product: id, quantity: 1, totalPrice: product.salesPrice, offeredPrice: product.salesPrice }],
                user: userId,
                grandTotal: product.salesPrice,
                totalDiscount: product.salesPrice
            })
        }
        await cart.save();
        return res.status(200).json({ message: "Product added to cart", cart })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: 'Server error' });
    }
}
exports.getWallet = async (req, res) => {
    try {
        const { id } = req.params;
        const wallet = await Wallet.findOne({ user: id });
        if (!wallet)
            return res.status(400).json({ message: "Wallet not found" });
        return res.status(200).json({ message: "successfully fetched wallet data", wallet })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while fetching wallet data" })
    }
}