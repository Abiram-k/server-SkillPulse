const User = require('../../models/userModel');
const nodeMailer = require("nodemailer");
const path = require("path");
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, "../../.env") })
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Wallet = require('../../models/walletModel');
const RefreshToken = require('../../models/refreshTokenModel');
const BlacklistedToken = require("../../models/blacklistModel");
const { StatusCodes } = require('../../constants/statusCodes');
const { generateOTP } = require('../../utils/generateOTP');
const { getPassResetMailCred, getRegisterMailCred } = require('../../utils/getMailCredentials');
const { generateAccessToken, generateRefreshToken } = require('../../utils/generateTokens');

//this is a middleware to make service for gmail
const transporter = nodeMailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL, // Email id of use
        pass: process.env.NODEMAILER_PASSWORD,// Password for nodemailer
    }
});

exports.baseRoute = (req, res) => {
    res.status(StatusCodes.OK).send("SERVER IS RUNNING...");
}
exports.generateNewToken = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        console.log('Refresh token not found')
        return res.status(StatusCodes.UNAUTHORIZED).json({ message: 'Refresh token not found' });
    }
    try {
        const hasAccess = await RefreshToken.findOne({ token: refreshToken });
        if (!hasAccess) {
            return res.status(StatusCodes.FORBIDDEN).json({ message: 'Invalid refresh token' });
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
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Invalid refresh token' });
    }
}

exports.logout = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.status(StatusCodes.BAD_REQUEST).json({ message: "No refresh token provided" });

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
        res.clearCookie("accessToken", {
            httpOnly: true,
            secure: true,
            sameSite: "None"
        });

        res.status(StatusCodes.OK).json({ message: "Logged out successfully" });

    } catch (error) {
        console.error("Error blacklisting refresh token:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to log out" });
    }
}

const sendOTPEmail = async (email, otp, name) => {
    console.log("OTP IS:", otp);
    try {
        const mailCredentials = getRegisterMailCred(email, name, otp);
        await transporter.sendMail(mailCredentials);
        console.log('OTP sent successfully');
        return true
    } catch (error) {
        console.error('Error sending OTP:', error);
        return false;
    }
}

exports.signUp = async (req, res) => {
    const { firstName, email: rawEmail } = req.body;
    if (!rawEmail)
        return res.status(StatusCodes.NOT_FOUND).json({ message: "Email id not found" })
    email = rawEmail.toLowerCase();
    const existingUser = await User.findOne({
        email:
            { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }
    })

    if (existingUser) {
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "User already exists" });
    } else {
        const otp = generateOTP();
        const otpSent = await sendOTPEmail(email, otp, firstName);
        if (!otpSent) {
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to send OTP" });
        }
        req.session.user = req.body;
        req.session.otp = otp;
        return res.status(StatusCodes.OK).json({ message: "Proceeded to Otp verification" })
    }
}

exports.otp = async (req, res) => {
    const { otp } = req.body;
    try {
        if (!req.session.otp) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Otp expired !" })
        }
        else if (!req.session.user) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
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
            res.status(StatusCodes.OK).json({ message: "User Created Succesfully", user })
            req.session.otp = null;
        } else {

            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Incorrect Otp !" })
        }
    } catch (error) {
        console.log(error)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message })
    }
}
exports.resendOtp = async (req, res) => {
    try {
        const otp = generateOTP();
        req.session.otp = otp; // re assaigning the otp with new otp
        req.session.save((err) => { // this ensure the session is successfully saved
            if (err) {
                console.error("Session save error:", err);
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to store session" });
            }
        });
        if (req.session.user) {
            const email = req.session.user.email
            const otpSent = await sendOTPEmail(email, otp);
            if (!otpSent) {
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to send OTP" });
            } else {
                return res.status(StatusCodes.OK).json({ message: "Otp resended !" })
            }
        } else {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
        }
    } catch (error) {
        console.log(error)
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
}

const passResetEmail = async (email, otp, name) => {
    console.log("OTP IS:", otp);
    try {
        const mailCredentials = getPassResetMailCred(email, name, otp);
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
        if (!email)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Email id not found" })
        const user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "User not found" })
        const otp = generateOTP();
        req.session.resetPassOtp = otp;
        const otpSuccess = await passResetEmail(email, otp, user.firstName)
        if (!otpSuccess)
            console.log("Otp verification Failed")
        return res.status(StatusCodes.OK).json({ message: "OTP sent successfully" });
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while verifying email" })
    }
}
exports.verifyResetOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const validOtp = req.session.resetPassOtp;
        if (otp && otp != validOtp)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Otp is incorrect" });
        else
            return res.status(StatusCodes.OK).json({ message: "Verification completed" });
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while verifying otp" })
    }
}
exports.forgotPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const email = req.body.email?.replace(/"/g, '').trim().toLowerCase();
        if (!newPassword)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "New password not found" });
        if (!email)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Email not found" });

        const user = await User.findOne({ email });
        if (!user)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found " });
        // if (user.googleid && !user.password) {
        //     return res.status(404).json({ message: "You signed up using google! can't change password at this moment" });
        // }
        if (!user?.password && !user?.googleid)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "password missing" });

        if (user?.password) {
            const existingPass = await bcrypt.compare(newPassword, user?.password);
            if (existingPass)
                return res.status(StatusCodes.NOT_FOUND).json({ message: "This password is already in use" })
        }
        user.password = newPassword;
        await user.save();
        return res.status(StatusCodes.OK).json({ message: "Password Reseted" })
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while resetting password" });
    }
}
exports.login = async (req, res) => {
    try {
        const { email: rawEmail, password, referralCode } = req.body;
        if (!rawEmail)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Email id not found" })
        email = rawEmail.toLowerCase()
        const user = await User.findOne({
            email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }
        });
        if (!user) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "User not found !" });
        }
        else {
            if (!user.password && user?.googleid) {
                return res.status(StatusCodes.BAD_REQUEST).json({ message: "Login using google!" });
            }
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
                    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Already claimed referral once!" })
                }
                if (user.referralCode == referralCode) {
                    return res.status(StatusCodes.BAD_REQUEST).json({ message: "You cannot use your own code" })
                } else {
                    const refUser = await User.findOne({ referralCode });
                    if (!refUser || refUser._id == user._id) {
                        return res.status(StatusCodes.BAD_REQUEST).json({ message: "Ref code not exists" });
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

            if (!user.password || !password) {
                console.log("User.password: ", user.password, "password: ", password)
                return res.status(StatusCodes.BAD_REQUEST).json({ message: "password is missing" })
            }

            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {

                return res.status(StatusCodes.BAD_REQUEST).json({ message: "Password is incorrect" });
            }
            else if (user.isBlocked) {

                return res.status(StatusCodes.BAD_REQUEST).json({ message: "User were blocked " });
            }
            else {
                const refreshToken = await generateRefreshToken(user?._id, req);
                const accessToken = generateAccessToken(user?._id);
                res.cookie('accessToken', accessToken, {
                    httpOnly: true,//
                    secure: true,
                    sameSite: 'None',
                    maxAge: 15 * 60 * 1000,
                });

                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'None',
                    maxAge: 7 * 24 * 60 * 60 * 1000,
                });

                return res.status(StatusCodes.OK).json({ message: "Successfully Logged in", user });
            }
        }
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message });
    }
}
exports.changePassword = async (req, res) => {
    try {
        const id = req.body.authUser._id;
        const { currentPassword, newPassword } = req.body;
        const user = await User.findById(id);
        if (!user) {
            console.log("User not found");
            return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Please enter the correct password" });
        }
        user.password = newPassword;
        await user.save();

        return res.status(StatusCodes.OK).json({ message: "Password changed successfully" });
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "An error occurred while changing the password" });
    }
};
