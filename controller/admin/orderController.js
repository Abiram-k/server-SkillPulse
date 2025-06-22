
const path = require("path");
const Orders = require("../../models/orderModel");
const Wallet = require("../../models/walletModel");
const dotenv = require("dotenv");
const nodeMailer = require("nodemailer");
const { StatusCodes } = require("../../constants/statusCodes");

dotenv.config({ path: path.resolve(__dirname, "../.env") })


const transporter = nodeMailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD,
    }
});

exports.getAllOrders = async (req, res) => {
    try {
        const { filter, startDate, endDate } = req.query;
        function formatDateToDDMMYYYY(date) {
            const day = String(date.getDate())
                .padStart(2, '0');
            const month = String(date.getMonth() + 1)
                .padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
        let from;
        let to;

        switch (filter) {
            case "Daily": {
                from = new Date()
                to = new Date()
                // from = formatDateToDDMMYYYY(new Date());
                // to = formatDateToDDMMYYYY(new Date());
                break;
            }
            case "Weekly": {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                from = weekAgo;
                to = new Date();
                // from = formatDateToDDMMYYYY(weekAgo);
                // to = formatDateToDDMMYYYY(new Date());
                break;
            }
            case "Monthly": {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                monthAgo.setDate(1);
                monthAgo.setHours(0, 0, 0, 0);
                // from = formatDateToDDMMYYYY(monthAgo);
                from = monthAgo
                const currentMonth = new Date();
                currentMonth.setHours(23, 59, 59, 999);
                // to = formatDateToDDMMYYYY(currentMonth);
                to = currentMonth
                break;
            }
            case "Custom": {
                if (!startDate || !endDate)
                    return res.status(StatusCodes.BAD_REQUEST).json({ message: "Enter date range" });

                from = new Date(startDate)
                to = new Date(endDate)
                // from = formatDateToDDMMYYYY(new Date(startDate));
                // to = formatDateToDDMMYYYY(new Date(endDate));
                break;
            }
            default: {
                console.log("");
            }
        }

        const query = {};

        if (from && to) {
            query.createdAt = { $gte: from, $lte: to };
        }
        const orders = await Orders.find(query)
            .populate([{ path: "user" }, { path: "orderItems.product" }, {
                path: "orderItems.product",
                populate: { path: "category" },
            }, {
                path: "orderItems.product",
                populate: { path: "brand" },
            },]);

        if (!orders)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "No orders were found" });
        return res.status(StatusCodes.OK).json({ message: "Successfully fetched all orders", orders })
    } catch (error) {
        console.log(error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occred while fetching order details" });
    }
}

exports.editStatus = async (req, res) => {
    try {
        const { id } = req.query;
        const { orderId, productId, updatedStatus } = req.body;

        const updatingOrder = await Orders.findOne({ orderId })
        if (updatedStatus == "cancelled") {
            const walletData = {
                amount: updatingOrder.orderItems[0].price,
                description: "Cancellation Refund",
                transactionId: `REF-${orderId}-${Date.now()}`
            }
            const wallet = await Wallet.findOneAndUpdate({ user: updatingOrder.user }, { $push: { transaction: walletData }, $inc: { totalAmount: parseFloat(updatingOrder.orderItems[0].price) } }, { upsert: true, new: true });
            if (!wallet)
                return res.status(StatusCodes.BAD_REQUEST).json({ message: "Wallet not found to refund money " });
        }
        if (!updatingOrder) {
            console.log("Order not found");
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Order not found" });
        }

        if (!updatedStatus) {
            console.log("No status were founded");
        } else {
            const productIndex = updatingOrder.orderItems.findIndex((product) => product._id.toString() == productId);

            if (productIndex === -1) {
                console.log("Product not found in order items");
                return res.status(StatusCodes.NOT_FOUND).json({ message: "Product not found" });
            }
            if (updatingOrder.paymentMethod == "cod" &&
                updatedStatus == "delivered") {
                updatingOrder.paymentStatus = "Success";
            }
            updatingOrder.orderItems[productIndex].productStatus = updatedStatus;
            const itemStatus = updatingOrder.orderItems.map(item => item.productStatus)

            if (itemStatus.every((status) => status == "cancelled"))
                updatingOrder.status = "cancelled";
            if (itemStatus.every((status) => status == "delivered"))
                updatingOrder.status = "delivered";
            if (itemStatus.every((status) => status == "returned"))
                updatingOrder.status = "returned";
            if (itemStatus.every((status) => status == "shipped"))
                updatingOrder.status = "shipped"
            if (itemStatus.some((status) => status == "processing"))
                updatingOrder.status = "processing";

            await updatingOrder.save().then(() => console.log("saved")
            ).catch((error) => console.log("Error while saving order,order not saved", error))

            return res.status(StatusCodes.OK).json({ message: "updated order status" })
        }
    } catch (error) {
        console.log(error.message);

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while updating status" });
    }
}

exports.getOrder = async (req, res) => {
    try {
        const { search = "", filter = "", page = 1, limit = 5, startDate = null, endDate = null, isForReturned = false } = req.query;

        const query = {};
        if (["cancelled", "shipped", "processing", "delivered", "returned"].includes(filter)) {
            query.status = filter;
        }
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        const totalDocs = await Orders.countDocuments(query);
        const pageCount = Math.ceil(totalDocs / limit);

        const orderData = await Orders.find(query).skip((page - 1) * limit)
            .limit(Number(limit))
            .populate({
                path: "orderItems.product",
                populate: {
                    path: "category",
                    model: "category",
                },
            })
            .populate("user").sort({ createdAt: -1 })

        return res.status(StatusCodes.OK).json({ message: "Orders fetched successfully", orderData, pageCount });
    } catch (error) {
        console.error("Error fetching orders:", error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch orders" });
    }
};

exports.getReturnRequests = async (req, res) => {
    try {
        const { search, page, limit } = req.query;
        const offset = (page - 1) * limit;

        const orderData = await Orders.find().populate({
            path: "orderItems.product",
            populate: {
                path: "category",
                model: "category",
            },
        }).populate("user");

        const allReturnedItems = [];
        for (const order of orderData) {
            for (item of order?.orderItems) {
                if (item.returnDescription && (
                    !search ||
                    item.product?.productName?.toLowerCase().includes(search.toLowerCase()) ||
                    order?.user?.firstName?.toLowerCase().includes(search.toLowerCase())
                )) {
                    allReturnedItems.push({
                        orderId: order.orderId,
                        orderDate: order.createdAt,
                        user: order.user.firstName,
                        orderStatus: item.productStatus,
                        returnDescription: item.returnDescription,
                        productName: item.product.productName,
                        returnedAt: item.returnedAt,
                        itemId: item._id
                    });
                }
            }
        }

        allReturnedItems.sort((a, b) => {
            if (a.orderStatus === "delivered" && b.orderStatus !== "delivered") return -1;
            if (a.orderStatus !== "delivered" && b.orderStatus === "delivered") return 1;
            return 0;
        });

        const totalDocs = allReturnedItems.length;
        const pageCount = Math.ceil(totalDocs / limit);

        const paginatedItems = allReturnedItems.slice(
            offset,
            offset + Number(limit)
        );

        return res.status(StatusCodes.OK).json({ message: "Orders fetched successfully", returnedItems: paginatedItems, pageCount });

    } catch (error) {
        console.error("Error fetching return requests:", error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch return requests" });
    }
}

exports.returnOrder = async (req, res) => {
    try {
        const { itemId } = req.body;

        const order = await Orders.findOne({ orderItems: { $elemMatch: { _id: itemId } } }).populate({
            path: "orderItems.product",
            populate: {
                path: "category",
                model: "category",
            },
        }).populate("user");

        if (!order) {
            console.log("Filed to find order");
            return res.status(StatusCodes.NOT_FOUND);
        }
        const id = order?.user?._id;
        const orderIndex = order?.orderItems?.findIndex(item => item._id.toString() == itemId);
        const returnedProductName = order.orderItems[orderIndex]?.product?.productName;
        if (orderIndex == -1)
            console.log("Failed to find order Item")
        order.orderItems[orderIndex].productStatus = "returned";
        await order.save();
        const refundPrice = order.orderItems[orderIndex]?.price;
        const walletData = {
            amount: refundPrice,
            description: "Return Refund",
            transactionId: `REF-${itemId}-${Date.now()}`
        }
        const wallet = await Wallet.findOneAndUpdate({ user: id }, { $push: { transaction: walletData }, $inc: { totalAmount: parseFloat(refundPrice) } }, { upsert: true, new: true });

        if (!wallet)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Wallet not found to refund money " });

        const mailCredentials = {
            from: "abiramk0107@gmail.com",
            to: order?.user?.email,
            subject: "SKILL PULSE – Return Request Approved",
            text: `Dear ${order?.user?.firstName || "User"},

We're pleased to inform you that your return request for the following order has been approved:

Order ID: ${order?.orderId}
Returned Product: ${returnedProductName || "Product"}
Refund Amount: ₹${refundPrice || "N/A"}

The refunded amount has been successfully credited to your SkillPulse wallet.

You can view your updated wallet balance and transaction history in your account dashboard.

If you have any questions or need further assistance, feel free to contact our support team.

Thank you for shopping with SkillPulse!

Best regards,  
The SkillPulse Team`,
        };

        await transporter.sendMail(mailCredentials);

        return res.status(StatusCodes.OK).json({ message: "Order Returned successfully" });

    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while returning the order" })
    }
}