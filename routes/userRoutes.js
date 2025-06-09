
const userController = require("../controller/userController");
const cartController = require("../controller/cartController");
const wishlistController = require("../controller/wishlistController");
const orderController = require("../controller/orderController");
const couponController = require("../controller/admin/couponController")
const express = require('express');
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const { verifyUser } = require("../Middleware/userAuth");
const { isBlocked } = require("../Middleware/isBlockedUser");
const { uploadImage } = require("../Middleware/multer");

const dotenv = require("dotenv");
const path = require("node:path");
const User = require("../models/userModel");
dotenv.config("")

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
    return token;
}

const generateAccessToken = (userId) => {
    const token = jwt.sign({ id: userId }, process.env.ACCESS_TOKEN, { expiresIn: "15m" });
    return token;
}

dotenv.config({ path: path.resolve(__dirname, "../.env") })

router.get("/", (req, res) => res.status(200).json("Server is running"));

router.post('/token', userController.generateNewToken);

router.post('/signUp', userController.signUp);
router.post('/login', userController.login);
router.post('/otp', userController.otp);
router.post('/resendOtp', userController.resendOtp);

router.post('/verifyEmail', userController.verifyEmail);
router.post('/verifyResetOtp', userController.verifyResetOtp);
router.patch('/forgotPassword', userController.forgotPassword);

router.get('/auth/google', (req, res, next) => {
    const state = JSON.stringify({ method: req.query.method });
    passport.authenticate('google', {
        scope: ['email', 'profile'],
        state: state
    })(req, res, next);
});

router.get('/googleUser', userController.getUserData);

router.get('/auth/google/callback',
    passport.authenticate('google',
        { failureRedirect: 'https://skillpulse.abiram.website/login' }),

    async (req, res) => {
        try {

            const state = JSON.parse(req.query.state || '{}');
            const method = state.method;
            const email = req.user?.email;

            function generateReferralCode(length = 8) {
                const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
                let referralCode = "";
                for (let i = 0; i < length; i++) {
                    const randomIndex = Math.floor(Math.random() * characters.length);
                    referralCode += characters[randomIndex];
                }
                return referralCode;
            }

            const existingUser = await User.findOne({ email });


            if (!existingUser.referralCode) {
                existingUser.referralCode = generateReferralCode();
                await existingUser.save();
            }

            const walletDoc = await Wallet.findOne({ user: existingUser._id })
            if (!walletDoc) {
                const wallet = new Wallet({
                    user: existingUser._id,
                    totalAmount: 0,
                    transaction: []
                })
                await wallet.save();
            }

            const refreshToken = await generateRefreshToken(existingUser?._id, req);
            const accessToken = generateAccessToken(existingUser?._id);

            res.cookie('accessToken', accessToken, {
                httpOnly: true,
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

            res.redirect('https://skillpulse.abiram.website/googleRedirect');
            // res.redirect('https://localhost:5173/googleRedirect');
        } catch (error) {
            console.error("Authentication error:", error);
            res.redirect('https://skillpulse.abiram.website/signup?error=server_error');
        }
    });

router.get("/products", isBlocked, userController.getProducts);
router.get("/product/:id", userController.getProductDetails)
router.get("/getSimilarProduct/:id", userController.getSimilarProduct);
router.get("/brand-category-info/:id", userController.getBrandCategoryInfo);

router.post("/user", uploadImage.single("file"), verifyUser, isBlocked, userController.updateUser);

router.get("/user", verifyUser, isBlocked, userController.getUser);

router.patch("/password", verifyUser, isBlocked, userController.changePassword);
// router.patch("/password/:id", verifyUser, isBlocked, userController.changePassword);

router.get("/address", verifyUser, isBlocked, userController.getAddress);
router.post("/address", uploadImage.none(), verifyUser, isBlocked, userController.addAddress);
router.delete("/address", verifyUser, isBlocked, userController.deleteAddress);
router.get("/editAddress", verifyUser, isBlocked, userController.getEditAddress);
router.put("/address", uploadImage.none(), verifyUser, isBlocked, userController.editAddress);

router.post("/addToCart/:id", verifyUser, isBlocked, userController.addToCart);
router.get("/cart", verifyUser, isBlocked, cartController.getCart);
// router.get("/cart/:id", verifyUser, isBlocked, cartController.getCart);
router.post("/updateQuantity/:productId", verifyUser, isBlocked, cartController.updateQuantity);
router.delete("/cartItem/:productId", verifyUser, isBlocked, cartController.removeCartItem);

// router.delete("/cartItem/:productId", wishlistController.removewishlistItme);
router.get("/wishlist", verifyUser, isBlocked, wishlistController.getwishlist);
router.post("/wishlist", verifyUser, isBlocked, wishlistController.addToWishlist);
router.delete("/wishlist", verifyUser, isBlocked, wishlistController.deleteWishlistItem);

router.post("/order", verifyUser, isBlocked, orderController.addOrder);
// router.post("/order/:id", verifyUser, isBlocked, orderController.addOrder);
router.get("/order", verifyUser, isBlocked, orderController.getOrder);
router.get("/order/details/:id", isBlocked, orderController.getOrderDetails)
router.patch("/cancelOrderItem", verifyUser, isBlocked, orderController.cancelOrderItem);
router.patch("/cancelOrder", verifyUser, isBlocked, orderController.cancelOrder)
router.patch("/returnProduct", verifyUser, isBlocked, orderController.returnOrderRequest);

router.get("/wallet", verifyUser, isBlocked, userController.getWallet);
// router.get("/wallet/:id", verifyUser, isBlocked, userController.getWallet);

router.get("/coupon", verifyUser, isBlocked, couponController.getCoupons);
router.patch("/cartCouponApply", verifyUser, cartController.applyCoupon);
router.patch("/cartCouponRemove", verifyUser, cartController.removeCoupon);
// router.patch("/cartCouponRemove/:id", verifyUser, cartController.removeCoupon);

router.post("/verify-payment", verifyUser, orderController.verifyPayment);

const Razorpay = require("razorpay");
const Wallet = require("../models/walletModel");
const RefreshToken = require("../models/refreshTokenModel");

router.post("/create-razorpay-order", async (req, res) => {
    const instance = new Razorpay({
        key_id: process.env.RAZORPAY_ID,
        key_secret: process.env.RAZORPAY_KEY,
    });
    const { orderId, amount } = req.body;
    try {
        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: `receipt_order_${orderId}`,
        };
        const order = await instance.orders.create(options);

        res.status(200).json({ success: true, orderId: order.id });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/logout", verifyUser, userController.logout);


module.exports = router;