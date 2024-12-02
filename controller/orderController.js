const { model } = require('mongoose');
const dotenv = require("dotenv");
const path = require("node:path")
const crypto = require("crypto")
const Cart = require('../models/cartModel');
const Orders = require('../models/orderModel');
const User = require("../models/userModel");
const Product = require('../models/productModel');
const Wallet = require('../models/walletModel');
const Coupon = require('../models/couponModel.');
const Razorpay = require("razorpay");
const Order = require('../models/orderModel');

dotenv.config({ path: path.resolve(__dirname, "../.env") })

let orderCounter = 0;

const generateOrderId = () => {
    orderCounter += 1;
    const timestamp = Date.now();
    return `SKPUL-FT-${timestamp}-${orderCounter}`;
};

const generateOrderDate = () => {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, 0)
    const month = String(date.getMonth() + 1).padStart(2, 0)
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}


exports.addOrder = async (req, res) => {
    console.log("REQ GOT!")
    try {
        const { paymentMethod, totalAmount, appliedCoupon, paymentFailed, isRetryPayment, deliveryCharge } = req.query;
        const { id } = req.params;
        console.log(paymentMethod, "1", totalAmount, "2", appliedCoupon, "3", paymentFailed, "4", isRetryPayment, "5", deliveryCharge, "6", id)

        if (isRetryPayment) {
            const { checkoutItems } = req.body;
            const order = await Orders.findOne({ user: id, _id: checkoutItems[0]._id })
            try {
                if (paymentFailed === "true") {
                    return res.status(400).json({ message: "Payment Failed" });
                } else {
                    order.paymentStatus = "Success"
                    await order.save();
                    return res.status(200).json({ message: "Payment successfull" });
                }
            } catch (error) {
                return res.status(500).json({ message: "Payment rejected" })
            }

        } else {
            const checkoutItems = req.body.map(item => {
                const { authUser, ...rest } = item;
                return rest;
            });
            const coupon = await Coupon.findById(appliedCoupon);

            if (appliedCoupon && !coupon)
                return res.status(400).json({ message: "Coupon is unavailable" })

            const order = await Orders.findOne({ user: id })

            const user = await User.findById(id);
            if (!user.appliedCoupons) {
                user.appliedCoupons = [];
            }
            const deliveryAddressId = user.deliveryAddress;

            if (!deliveryAddressId && user.address.length == 0)
                return res.status(400).json({ message: "Add a delivery Address" });

            let [address] = user.address.filter((addr) => addr._id.toString() === deliveryAddressId);

            if (!user.address[0])
                return res.status(404).json({ message: "Add an address" });

            if (!address)
                address = user.address[0];

            let orderItems = [];
            let totalQuantity = 0;
            let paymentStatus = "";

            if (paymentMethod == "cod") {
                paymentStatus = "Pending"
            } else if (paymentMethod == "wallet") {
                paymentStatus = "Success"
            } else if (paymentMethod == "Razorpay" && paymentFailed == "true") {
                paymentStatus = "Failed"
            }
            else if (paymentMethod == "Razorpay" && paymentFailed == "false") {
                paymentStatus = "Success"
            }

            for (const item of checkoutItems[0].products) {
                try {
                    const orderItem = {
                        product: item.product._id,
                        quantity: item.quantity,
                        totalPrice: item.product.salesPrice * item.quantity,
                        price: item.offeredPrice,
                        paymentStatus
                    };

                    if (paymentMethod === "wallet") {
                        const wallet = await Wallet.findOne({ user: id });
                        if (!wallet) {
                            return res.status(404).json({ message: "Wallet not found" });
                        }
                        if (wallet.totalAmount < totalAmount) {
                            return res.status(402).json({ message: `Wallet balance is insufficient: ${wallet.totalAmount}` });
                        } else {
                            const walletData = {
                                amount: -totalAmount,
                                description: "purchased product",
                                transactionId: `REF-${item.product._id}-${Date.now()}`
                            };
                            wallet.transaction.push(walletData);
                            wallet.totalAmount -= totalAmount;
                            await wallet.save();
                        }
                    }

                    orderItems.push(orderItem);

                    totalQuantity += item.quantity;

                    // console.log("IS PAYMENT FAILED :", paymentFailed, "RETRY :", isRetryPayment);

                    if (!paymentFailed)
                        await Product.findByIdAndUpdate(item.product._id, { $inc: { units: -item.quantity } });

                } catch (error) {
                    console.error(error);
                    return res.status(500).json({ message: "Error processing item" });
                }
            }
            const totalDiscount = checkoutItems[0].totalDiscount;
            const currentOrderData = {
                user: id,
                orderId: generateOrderId(),
                orderDate: generateOrderDate(),
                orderItems,
                totalAmount,
                totalQuantity,
                address,
                appliedCoupon,
                totalDiscount,
                paymentMethod,
                paymentStatus,
                deliveryCharge
            };
            const newOrder = new Orders(currentOrderData);
            if (appliedCoupon) {
                const coupon = await Coupon.findById(appliedCoupon);
                if (!coupon) {
                    console.log("No Coupon found");
                } else {
                    const couponIndex = user.appliedCoupons.findIndex(c => c.coupon.toString() === appliedCoupon.toString());
                    if (couponIndex === -1) {
                        user.appliedCoupons.push({ coupon: appliedCoupon, usedCount: 1 });
                    } else {
                        const userCoupon = user.appliedCoupons[couponIndex];
                        if (userCoupon.usedCount >= coupon.perUserLimit) {
                            return res.status(402).json({ message: "Coupon usage limit per user exceeded" });
                        }
                        userCoupon.usedCount += 1;
                    }
                    if (coupon.totalLimit <= 0) {
                        return res.status(402).json({ message: "Coupon is no longer available" });
                    }
                    coupon.totalLimit -= 1;
                    await coupon.save();
                }
            }
            await user.save();

            await newOrder.save()
                .then(async (order) => {
                    const result = await Cart.deleteOne({ user: id });
                    if (result.deletedCount === 1) {
                        console.log("Order placed successfully");
                    } else {
                        console.log("Cart not found while attempting to delete");
                    }
                })
                .catch(error => console.error("Error saving order:", error));
            return res.status(200).json({ message: "Order placed successfully" });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "An error occurred while placing the order" });
    }
};

exports.getOrder = async (req, res) => {
    try {
        const { id } = req.query;
        const orderData = await Orders.find({ user: id }).populate({
            path:
                "orderItems.product",
            populate: {
                path: 'category',
                model: "category"
            }
        });
        if (!orderData)
            console.log("No order were founded in this user id");
        return res.status(200).json({ message: "Orders fetched successfully", orderData });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "Failed to fetch orders" });
    }
}
exports.cancelOrder = async (req, res) => {
    try {
        const { id, itemId } = req.query;
        const order = await Orders.findOne({ user: id, orderItems: { $elemMatch: { _id: itemId } } })
        const orderIndex = order.orderItems.findIndex(item => item._id.toString() == itemId);
        if (orderIndex == -1)
            console.log("Failed to find order")
        order.orderItems[orderIndex].productStatus = "cancelled";
        const updatedOrder = await order.save();
        if (updatedOrder.paymentStatus == "Success") {
            const refundPrice = order.orderItems[orderIndex]?.price;
            const walletData = {
                amount: refundPrice,
                description: "Cancellation Refund",
                transactionId: `REF-${itemId}-${Date.now()}`
            }
            const wallet = await Wallet.findOneAndUpdate({ user: id }, { $push: { transaction: walletData }, $inc: { totalAmount: parseFloat(refundPrice) } }, { upsert: true, new: true });

            if (!wallet)
                return res.status(400).json({ message: "Wallet not found to refund money " });
        }
        return res.status(200).json({ message: "Order Cancelled successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while returning the order" })
    }
}
exports.returnOrderRequest = async (req, res) => {
    const { returnDescription } = req.body;
    try {
        const { id, itemId } = req.query;
        const order = await Orders.findOne({ user: id, orderItems: { $elemMatch: { _id: itemId } } })
        const orderIndex = order.orderItems.findIndex(item => item._id.toString() == itemId);

        if (orderIndex == -1)
            return res.status(404).json({ message: "Failed to find ordered Item" });

        order.orderItems[orderIndex].returnDescription = returnDescription;
        order.orderItems[orderIndex].returnedAt = new Date();

        await order.save();
        return res.status(200).json({ message: "Return request sended successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while returning the order" })
    }
}
exports.verifyPayment = async (req, res) => {
    const instance = new Razorpay({
        key_id: process.env.RAZORPAY_ID,
        key_secret: process.env.RAZORPAY_KEY,
    });

    const { paymentId, orderId, signature, actuallOrder, retry } = req.body;
    try {
        const body = orderId + "|" + paymentId;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY)
            .update(body.toString())
            .digest("hex");


        // if (retry) {
        //     const order = await Order.findById(actuallOrder);
        //     console.log(order);
        //     if (!order)
        //         console.log("Order not found");
        // } else {
        const order = await Cart.findById(actuallOrder);
        if (!order)
            console.log("Order not found");
        // }

        if (expectedSignature === signature) {
            res.status(200).json({ success: true });

        } else {
            res.status(400).json({ success: false });
        }
    } catch (error) {
        res.status(500).json({ message: "Error occured during verification" })
        console.log(error)
    }
}