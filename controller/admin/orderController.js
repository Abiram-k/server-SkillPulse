
const Orders = require("../../models/orderModel");
const Wallet = require("../../models/walletModel");



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
                    return res.status(400).json({ message: "Enter date range" });

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
            return res.status(400).json({ message: "No orders were found" });
        return res.status(200).json({ message: "Successfully fetched all orders", orders })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Error occred while fetching order details" });
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
                return res.status(400).json({ message: "Wallet not found to refund money " });
        }
        if (!updatingOrder) {
            console.log("Order not found");
            return res.status(404).json({ message: "Order not found" });
        }

        if (!updatedStatus) {
            console.log("No status were founded");
        } else {
            const productIndex = updatingOrder.orderItems.findIndex((product) => product._id.toString() == productId);

            if (productIndex === -1) {
                console.log("Product not found in order items");
                return res.status(404).json({ message: "Product not found" });
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

            return res.status(200).json({ message: "updated order status" })
        }
    } catch (error) {
        console.log(error.message);

        return res.status(500).json({ message: "Error occured while updating status" });
    }
}

exports.getOrder = async (req, res) => {
    try {
        const { search = "", filter = "", page = 1, limit = 5, startDate = null, endDate = null } = req.query;

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
            .populate("user");
        return res.status(200).json({ message: "Orders fetched successfully", orderData, pageCount });
    } catch (error) {
        console.error("Error fetching orders:", error.message);
        return res.status(500).json({ message: "Failed to fetch orders" });
    }
};

exports.returnOrder = async (req, res) => {
    try {
        const { itemId } = req.body;

        const order = await Orders.findOne({ orderItems: { $elemMatch: { _id: itemId } } })
        if (!order) {
            console.log("Filed to find order");
            return res.status(404);
        }
        const id = order.user;
        const orderIndex = order?.orderItems?.findIndex(item => item._id.toString() == itemId);
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
            return res.status(400).json({ message: "Wallet not found to refund money " });

        return res.status(200).json({ message: "Order Returned successfully" });

    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while returning the order" })
    }
}