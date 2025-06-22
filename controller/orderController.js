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
const nodeMailer = require("nodemailer");
const Razorpay = require("razorpay");
const Order = require('../models/orderModel');
const { StatusCodes } = require('../constants/statusCodes');

dotenv.config({ path: path.resolve(__dirname, "../.env") })

let orderCounter = 0;


const transporter = nodeMailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL, // Email id of use
        pass: process.env.NODEMAILER_PASSWORD,// Password for nodemailer
    }
});

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
    try {
        const { paymentMethod, totalAmount, appliedCoupon, isRetryPayment, deliveryCharge = 0
        } = req.query;
        // const { id } = req.params;
        const id = req.body.authUser._id

        // console.log("Request body: ", req.body);
        const paymentFailed = req.query.paymentFailed ?? false;
        console.log("Payment failed: ", paymentFailed);

        if (isRetryPayment) {
            const { checkoutItems } = req.body;
            const order = await Orders.findOne({ user: id, _id: checkoutItems[0]._id })
            try {
                if (paymentFailed == "false") {
                    for (const item of checkoutItems[0].orderItems) {
                        const productId = item.product;
                        const product = await Product.findById(productId);

                        if (!product) {
                            return res.status(StatusCodes.NOT_FOUND).json({ message: `Product with ID ${productId} not found.` });
                        }

                        if (product.units < item.quantity) {
                            return res.status(StatusCodes.BAD_REQUEST).json({
                                message: `Insufficient stock for product ${product.productName}. Available units: ${product.units}. Requested: ${item.quantity}.`
                            });
                        }
                        if (product.isDeleted || !product.isListed)
                            return res.status(StatusCodes.NOT_FOUND).json({
                                message: `${product?.productName} is not available.`
                            });
                    }
                    for (const item of checkoutItems[0].orderItems) {
                        const productId = item.product;
                        await Product.findByIdAndUpdate(productId, { $inc: { units: -item.quantity } });
                    }

                    order.paymentStatus = "Success";
                    await order.save();

                    return res.status(StatusCodes.OK).json({ message: "Payment successful" });
                } else {
                    return res.status(StatusCodes.FORBIDDEN).json({ message: "Payment Failed" });
                }
            } catch (error) {
                return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Payment rejected" })
            }

        } else {
            const checkoutItems = req.body.map(item => {
                const { authUser, ...rest } = item;
                return rest;
            });

            const coupon = await Coupon.findById(appliedCoupon);

            if (appliedCoupon && !coupon)
                return res.status(StatusCodes.NOT_FOUND).json({ message: "Coupon is unavailable" });

            const order = await Orders.findOne({ user: id });

            const user = await User.findById(id);

            if (!user.appliedCoupons) {
                user.appliedCoupons = [];
            }

            const deliveryAddressId = user.deliveryAddress;

            if (!deliveryAddressId && user.address.length == 0)
                return res.status(StatusCodes.BAD_REQUEST).json({ message: "Add a delivery Address" });

            let [address] = user.address.filter((addr) => addr._id.toString() === deliveryAddressId);

            if (!user.address[0])
                return res.status(StatusCodes.NOT_FOUND).json({ message: "Add an address" });

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
                        totalPrice: item.totalPrice,
                        // totalPrice: item.product.salesPrice * item.quantity + Number(Number(deliveryCharge)),
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


                    if (paymentFailed == "false") {
                        const product = await Product.findById(item.product?._id);
                        if (!product) {
                            return res.status(StatusCodes.NOT_FOUND).json({ message: ` ${product?.productName}- product not found.` });
                        }

                        if (product.units < item.quantity) {
                            return res.status(StatusCodes.BAD_REQUEST).json({
                                message: `Insufficient stock for product ${product.productName}. Available units: ${product.units}. Requested: ${item.quantity}.`
                            });
                        }
                        if (product.isDeleted || !product.isListed)
                            return res.status(StatusCodes.NOT_FOUND).json({
                                message: `${product?.productName} is not available.`
                            });

                        await Product.findByIdAndUpdate(item.product._id, { $inc: { units: -item.quantity } });
                    }

                } catch (error) {
                    console.error(error);
                    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error processing item" });
                }
            }

            const totalDiscount = checkoutItems[0].totalDiscount + Number(deliveryCharge);
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
                            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Coupon usage limit per user exceeded" });
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
            let orderId = "";
            let orderDate = "";
            let orderAmount = totalDiscount || totalAmount;
            let IsPaymentSuccess = false;

            await newOrder.save()
                .then(async (order) => {
                    console.log("Order saved: ", order._id)
                    if (!isRetryPayment) {
                        const result = await Cart.deleteOne({ user: id });
                        if (result.deletedCount === 1) {
                            orderId = newOrder.orderId;
                            orderDate = newOrder.orderDate;
                            IsPaymentSuccess = order?.paymentStatus == "Success"
                            console.log("Order placed successfully");
                        } else {
                            console.log("Cart not found while attempting to delete")
                        }
                    }
                })
                .catch(error => console.error("Error saving order:", error));


            const mailCredentials = {
                from: "abiramk0107@gmail.com",
                to: user?.email,
                subject: 'SKILL PULSE – Order Confirmation',
                text: `Dear ${user?.firstName || "User"},

Thank you for your order with SkillPulse!

We’re excited to inform you that your order has been successfully placed. Below are the details of your order:

Order ID: ${orderId}
Order Date: ${orderDate}
Total Amount: ₹${orderAmount}

You will receive another email once your order is processed and shipped. If you have any questions, feel free to reach out to our support team.

Thank you for choosing SkillPulse. We look forward to serving you again!

Best regards,  
The SkillPulse Team`,
            };

            try {

                if (IsPaymentSuccess)
                    await transporter.sendMail(mailCredentials);
            } catch (err) {
                console.error("Error sending order email:", err);
            }
            return res.status(StatusCodes.OK).json({ message: "Order placed successfully" });
        }
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "An error occurred while placing the order" });
    }
};
exports.getOrderDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const orderDetails = await Order.findOne({ _id: id }).populate({
            path: "orderItems.product",
            populate: [
                {
                    path: "category",
                    model: "category",
                },
                {
                    path: "brand",
                    model: "brand",
                },
            ],
        });


        if (!orderDetails) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Order not found" });
        }
        return res.status(StatusCodes.OK).json({ message: "Order Fetched", orderDetails });

    } catch (error) {
        console.log(error)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while fetching order" });
    }
}
exports.getOrder = async (req, res) => {
    try {
        const { search = "", sort = "", filter = "", page = 1, limit = 8, startDate = null, endDate = null } = req.query;
        const id = req.body?.authUser?._id;
        const queryObj = { user: id };
        const sortObj = { createdAt: -1 }

        if (filter == "pay-success") {
            queryObj.paymentStatus = "Success"
        } else if (filter == "pay-failed") {
            queryObj.paymentStatus = "Failed"
        } else if (filter == "pay-pending") {
            queryObj.paymentStatus = "Pending"
        } else if (filter == "delivered") {
            queryObj.status = "delivered"
        } else if (filter == "returned") {
            queryObj.status = "returned"
        } else if (filter == "shipped") {
            queryObj.status = "shipped"
        }
        else if (filter == "processing") {
            queryObj.status = "processing"
        }
        else if (filter == "cancelled") {
            queryObj.status = "cancelled"
        }
        if (startDate && endDate) {
            queryObj.$and = [{ createdAt: { $gte: startDate } }, { createdAt: { $lte: endDate } }];
        }
        if (sort == "oldest") {
            sortObj.createdAt = 1;
        }
        const totalDocumentCount = await Orders.countDocuments(queryObj);
        const pageCount = Math.ceil(totalDocumentCount / limit);

        const orderData = await Orders.find(queryObj).populate({
            path:
                "orderItems.product",
            populate: {
                path: 'category',
                model: "category"
            }
        }).sort(sortObj).limit(limit).skip((page - 1) * limit);


        // const filteredOrders = search
        //     ? orderData
        //         .map((order) => {
        //             const matchesOrderId = order.orderId
        //                 .toLowerCase()
        //                 .includes(search.toLowerCase());

        //             const matchesFilteredItems = order.orderItems.filter(
        //                 (item) =>
        //                     item.product.productName
        //                         .toLowerCase()
        //                         .includes(search.toLowerCase()) ||
        //                     item.product.category.name
        //                         .toLowerCase()
        //                         .includes(search.toLowerCase())
        //             );

        //             if (matchesOrderId || matchesFilteredItems.length > 0) {
        //                 return {
        //                     ...order,
        //                     orderItems: matchesOrderId
        //                         ? order.orderItems
        //                         : matchesFilteredItems,
        //                 };
        //             }
        //             return null;
        //         })
        //         .filter(Boolean)
        //     : orderData;


        if (!orderData)
            console.log("No order were founded in this user id");
        return res.status(StatusCodes.OK).json({ message: "Orders fetched successfully", orderData, pageCount });
    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch orders" });
    }
}
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.query;
        const userId = req.body.authUser._id

        if (!id) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "orderId not founded" });
        }
        if (!userId) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User id not founded" });
        }

        const order = await Order.findById(id);
        const refundPrice = order?.orderItems
            .filter(item => item?.productStatus == "processing")
            .reduce((total, item) => total + item?.price, 0);
        order.orderItems.forEach((item) => {
            item.productStatus = "cancelled"
        })
        order.status = "cancelled";
        const updatedOrder = await order.save();
        if (updatedOrder.paymentStatus == "Success") {
            const walletData = {
                amount: refundPrice,
                description: "Cancellation Refund",
                transactionId: `REF-${id}-${Date.now()}`
            }
            const wallet = await Wallet.findOneAndUpdate({ user: userId }, { $push: { transaction: walletData }, $inc: { totalAmount: parseFloat(refundPrice) } }, { upsert: true, new: true });

            if (!wallet)
                return res.status(StatusCodes.BAD_REQUEST).json({ message: " Refund money failed, contact costumer service" });
        }

        return res.status(StatusCodes.OK).json({ message: "Order Cancelled successfully" });

    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while cancelling the order" });
    }
}
exports.cancelOrderItem = async (req, res) => {
    try {
        const { itemId } = req.query;
        const id = req.body.authUser._id
        if (!id) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User id not founded" })
        }
        const order = await Orders.findOne({ user: id, orderItems: { $elemMatch: { _id: itemId } } })
        const orderIndex = order.orderItems.findIndex(item => item._id.toString() == itemId);
        if (orderIndex == -1)
            console.log("Failed to find order")
        order.orderItems[orderIndex].productStatus = "cancelled";
        const itemStatus = order.orderItems.map(item => item.productStatus)

        if (itemStatus.every((status) => status == "cancelled"))
            order.status = "cancelled";

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
                return res.status(StatusCodes.BAD_REQUEST).json({ message: " Refund money failed, contact costumer service" });
        }
        return res.status(StatusCodes.OK).json({ message: "Order Cancelled successfully" });

    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while cancelling the order" })
    }
}
exports.returnOrderRequest = async (req, res) => {
    const { returnDescription } = req.body;
    try {
        const { id, itemId } = req.query;
        const order = await Orders.findOne({ user: id, orderItems: { $elemMatch: { _id: itemId } } })
        const orderIndex = order.orderItems.findIndex(item => item._id.toString() == itemId);

        if (orderIndex == -1)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Failed to find ordered Item" });

        order.orderItems[orderIndex].returnDescription = returnDescription;
        order.orderItems[orderIndex].returnedAt = new Date();

        await order.save();
        return res.status(StatusCodes.OK).json({ message: "Return request sended successfully" });

    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while returning the order" })
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
            res.status(StatusCodes.OK).json({ success: true });

        } else {
            res.status(StatusCodes.BAD_REQUEST).json({ success: false });
        }
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured during verification" })
        console.log(error)
    }
}