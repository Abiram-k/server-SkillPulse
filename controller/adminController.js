const path = require("path");
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require("../models/userModel");
const Admin = require("../models/adminModel");
const Category = require("../models/categoryModel");
const Brand = require("../models/brandModel");
const Product = require("../models/productModel");
const Orders = require("../models/orderModel");
const mongoose = require("mongoose")
const { listenerCount } = require("process");
const Coupon = require("../models/couponModel.");
const Wallet = require("../models/walletModel");
const RefreshToken = require("../models/refreshTokenModel");
const BlacklistedToken = require("../models/blacklistModel");

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

exports.customers = async (req, res) => {
    try {
        const { filter } = req.query;

        const users = await User.find();

        if (filter == "A-Z")
            users.sort((a, b) => a.firstName.localeCompare(b.firstName));
        else if (filter == "Z-A")
            users.sort((a, b) => b.firstName.localeCompare(a.firstName));
        else if (filter === "Recently added") {
            users = users.sort((a, b) => b.createdAt - a.createdAt);
        }

        return res.status(200).json({ message: "success", users });
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

exports.addCategory = async (req, res) => {
    try {
        let { name, description } = req.body;
        const image = req.file?.path;
        if (!description) {
            description = undefined;
        }
        const existCategory = await Category.findOne({
            name: {
                $regex: `^${name}$`,
                $options: ""
            }
        })
        if (existCategory)
            return res.status(400).json({ message: "Category already exists" });
        else {
            const category = await Category.create({
                name, description, image
            })
            return res.status(200).json({
                message: "Category added succesfully",
                category
            })
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}
exports.addBrand = async (req, res) => {
    try {
        let { name, description } = req.body;
        const image = req.file?.path;
        if (!description) {
            description = undefined;
        }
        const existBrand = await Brand.findOne({
            name: {
                $regex: `^${name}$`,
                $options: ""
            }
        })
        if (existBrand)
            return res.status(400).json({ message: "Brand already exists" });
        else {
            const brand = await Brand.create({
                name, description, image
            })
            return res.status(200).json({
                message: "Brand added succesfully",
                brand
            })
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

exports.getCategory = async (req, res) => {
    try {
        const { search = "", filter = "", page = 1, limit = 5 } = req.query;
        const filterObj = {};
        if (search) {
            filterObj.name = { $regex: search, $options: "i" };
        }
        let sortObj = {};
        if (filter === "Recently Added") {
            sortObj.createdAt = -1;
        } else if (filter === "A-Z") {
            sortObj.name = 1;
        } else if (filter === "Z-A") {
            sortObj.name = -1;
        }
        const totalDocs = await Category.countDocuments(filterObj);
        const pageCount = Math.ceil(totalDocs / limit);

        const categories = await Category.find(filterObj).sort(sortObj)
            .skip((page - 1) * limit)
            .limit(Number(limit));;

        if (categories) {
            return res.json({
                message: "succesully fetched all category", categories, pageCount
            });
        }
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ message: "Failed to fetch categories" });
    }
}
exports.getBrand = async (req, res) => {
    try {
        const { search = "", filter = "", page = 1, limit = 5 } = req.query;
        const filterObj = {};
        if (search) {
            filterObj.name = { $regex: search, $options: "i" };
        }
        let sortObj = {};
        if (filter === "Recently Added") {
            sortObj.createdAt = -1;
        } else if (filter === "A-Z") {
            sortObj.name = 1;
        } else if (filter === "Z-A") {
            sortObj.name = -1;
        }
        const totalDocs = await Category.countDocuments(filterObj);
        const pageCount = Math.ceil(totalDocs / limit);
        const brands = await Brand.find(filterObj).sort(sortObj)
            .skip((page - 1) * limit)
            .limit(Number(limit));
        if (brands) {
            return res.json({ message: "succesully fetched all brands", brands, pageCount });
        }
    } catch (err) {
        console.log(err.message);
        return res.status(500).json({ message: "Failed to fetch brands" });
    }
}

exports.deleteBrand = async (req, res) => {
    try {
        let { id } = req.params;
        const deletedBrand = await Brand.
            findByIdAndUpdate({ _id: id }, { isDeleted: true, deletedAt: Date.now() });
        if (deletedBrand)
            return res.status(200).json({ message: "Brand successfully deleted" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "failed to delete Brand" });
    }
}

exports.brandRestore = async (req, res) => {
    try {
        const { id } = req.params;
        const RestoredBrand = await Brand.
            findByIdAndUpdate({ _id: id }, { isDeleted: false, deletedAt: null });

        if (RestoredBrand)
            return res.status(200).json({ message: "Brand successfully Restore" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "failed to Restore Brand" });
    }
}

exports.editBrand = async (req, res) => {
    try {
        let { id, name, description } = req.body;
        if (!description) {
            description = undefined;
        }
        const isExistbrand = await Brand.findOne({ name, _id: { $ne: id } });
        if (isExistbrand) {
            return res.status(400).json({ message: "Brand already exists" });
        }
        const updateData = { name };
        if (description) updateData.description = description;
        if (req.file?.path) updateData.image = req.file.path;

        const updatedBrand = await Brand.findByIdAndUpdate(id, updateData, { new: true });

        return res.status(200).json({
            message: "Successfully edited the brand",
            updatedBrand,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Brand not edited" });
    }
};

exports.listBrand = async (req, res) => {
    try {

        const { id } = req.params;
        const brand = await Brand.findById(id);
        brand.isListed = !brand?.isListed
        brand.save();
        return res.status(200).json({ message: "success", brand })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message || "Failed to list/unlist Brand" })
    }
}


exports.deleteCategory = async (req, res) => {
    try {
        let { id } = req.params;
        const deletedCategory = await Category.
            findByIdAndUpdate({ _id: id }, { isDeleted: true, deletedAt: Date.now() });
        if (deletedCategory)
            return res.status(200).json({ message: "Category successfully deleted" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "failed to delete category" });
    }
}


exports.categoryRestore = async (req, res) => {
    try {
        const { id } = req.params;
        const RestoredCategory = await Category.
            findByIdAndUpdate({ _id: id }, { isDeleted: false, deletedAt: null });

        if (RestoredCategory)
            return res.status(200).json({ message: "Category successfully Restore" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "failed to Restore category" });
    }
}

exports.editCategory = async (req, res) => {
    try {
        let { id, name, description, offer, maxDiscount } = req.body;
        if (!description) {
            description = undefined;
        }
        const isExistcategory = await Category.findOne({ name, _id: { $ne: id } });

        if (isExistcategory) {
            return res.status(400).json({ message: "Category already exists" });
        }
        const updateData = { name, offer };
        if (description) updateData.description = description;
        if (req.file?.path) updateData.image = req.file.path;

        const updatedCategory = await Category.findByIdAndUpdate(id, updateData, { new: true });

        const products = await Product.find({ category: id });
        products.forEach((product) => {
            if (product.offer < offer) {
                const discountAmount = product.regularPrice * (offer / 100);
                product.categoryOffer = offer;
                product.salesPrice = (discountAmount <= maxDiscount)
                    ? product.regularPrice - discountAmount
                    : product.regularPrice - maxDiscount;
            } else {
                product.categoryOffer = 0;
                product.salesPrice = product.regularPrice - (product.regularPrice * (product.offer / 100));
            }
        });
        for (const product of products) {
            await product.save();
        }

        return res.status(200).json({
            message: "Successfully edited the category",
            updatedCategory,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message || "Category not edited" });
    }
};

exports.listCategory = async (req, res) => {
    try {

        const { id } = req.params;
        const category = await Category.findById(id);
        category.isListed = !category?.isListed
        category.save();
        return res.status(200).json({ message: "success", category })
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message || "Failed to list/unlist Category" })
    }
}


exports.getProduct = async (req, res) => {
    try {
        const { filter } = req.query;
        const products = res.locals.results?.data;
        res.locals.results.products = products;
        // console.log(res.locals.results)
        if (filter == "Recently Added")
            products.sort((a, b) => b.createdAt - a.createdAt);
        else if (filter == "High-Low")
            products.sort((a, b) => b.salesPrice - a.salesPrice);
        else if (filter == "Low-High")
            products.sort((a, b) => a.salesPrice - b.salesPrice);
        if (filter === "A-Z") {
            products.sort((a, b) => a.productName.localeCompare(b.productName));
        } else if (filter === "Z-A") {
            products.sort((a, b) => b.productName.localeCompare(a.productName));
        }
        const results = res.locals.results;
        return res.status(200).json({ message: "successfully fetched all products", results });

    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message || "Failed to fetch data" })
    }
}

exports.addProduct = async (req, res) => {
    try {
        const {
            productName,
            productDescription,
            offer,
            regularPrice,
            units,
            category,
            brand,
        } = req.body;
        let salesPrice;
        const productImage = req.files.map((file) => file.path)
        const existProduct = await Product.findOne({ productName });

        if (!existProduct) {
            salesPrice = offer ? (regularPrice - (offer / 100) * regularPrice) : regularPrice
        }
        const categoryDoc = await Category.findOne({ name: category });
        const brandDoc = await Brand.findOne({ name: brand })
        if (!categoryDoc)
            return res.status(400).json({ message: "Category not existing" });
        if (!brandDoc)
            return res.status(400).json({ message: "Brand not existing" });
        if (existProduct) {
            console.log("product exists");
            return res.status(400).json({ message: "product already exists" });
        }
        else {
            const product = await Product.create({
                productName,
                productDescription,
                salesPrice,
                regularPrice,
                units,
                category: categoryDoc,
                brand: brandDoc,
                productImage
            });
            return res.status(200).json({ message: "product added successully" })
        }
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: error.message || "Error occurred while adding product" })

    }
}

exports.editProduct = async (req, res) => {
    try {
        const {
            productName,
            productDescription,
            offer,
            regularPrice,
            units,
            category,
            brand,
            file
        } = req.body;
        const { id } = req.params;
        let productImage = []
        productImage = req.files?.flatMap((file) => file?.path)
        if (file) {
            if (Array.isArray(file)) {
                productImage.push(...file);
            } else {
                productImage.push(file);
            }
        }
        const existProduct = await Product.findOne({
            productName: { $regex: new RegExp(`^${productName}$`), $options: 'i' },
            _id: { $ne: id }
        });
        let salesPrice;
        if (!existProduct) {
            salesPrice = offer ? regularPrice - ((offer / 100) * regularPrice) : regularPrice
        }
        const categoryDoc = await Category.findOne({ name: { $regex: new RegExp(`^${category}$`, 'i') } })
        const brandDoc = await Brand.findOne({ name: { $regex: new RegExp(`^${brand}$`, 'i') } })
        if (!brandDoc)
            return res.status(400).json({ message: "Brand not existing" });
        if (!categoryDoc)
            return res.status(400).json({ message: "Category not existing" });
        if (existProduct) {
            console.log("product exists");
            return res.status(400).json({ message: "product already exists" });
        }
        else {
            await Product.findByIdAndUpdate(id, {
                productName,
                productDescription,
                salesPrice,
                regularPrice,
                units,
                category: categoryDoc._id,
                brand: brandDoc._id,
                productImage,
                offer
            });
            return res.status(200).json({ message: "product edited successully" })
        }
    } catch (error) {
        console.log(error)
        return res.status(500).json({ message: error.message || "Error occurred while adding product" })
    }
}

exports.deleteProduct = async (req, res) => {
    try {
        let { id } = req.params;
        const deletedProduct = await Product.
            findByIdAndUpdate({ _id: id }, { isDeleted: true, deletedAt: Date.now() });
        if (deletedProduct)
            return res.status(200).json({ message: "Product successfully deleted" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "failed to delete Product" });
    }
}

exports.restoreProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const RestoredProduct = await Product.
            findByIdAndUpdate({ _id: id }, { isDeleted: false, deletedAt: null });

        if (RestoredProduct)
            return res.status(200).json({ message: "product successfully Restored" });
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "failed to Restore product" });
    }
}

exports.handleProductListing = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product.findById(id);
        product.isListed = !product.isListed;
        product.save();
        if (!product)
            return res.status(400).json({ message: "No products were founded !" });
        else
            return res.status(200).json({ message: `product sucessfully ${product.isListed ? "Listed" : "Unlisted"}`, product })
    } catch (error) {
        console.log(error.message);
        return res.status(500).json({ message: "Failed to list/unilist product" })
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
        const { search = "", filter = "", page = 1, limit = 5 } = req.query;
        console.log(req.query)

        const query = {};
        if (["cancelled", "shipped", "processing", "delivered", "returned"].includes(filter)) {
            query.status = filter;
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

        // if (!orderData.length) {
        //     console.log("No orders were found with the given filter.");
        //     return res.status(404).json({ message: "No orders found." });
        // }

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

exports.getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find();
        if (coupons)
            return res.status(200).json(coupons);
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while fecthing coupon data" });
    }
}
exports.addCoupons = async (req, res) => {
    try {
        const { couponCode,
            couponType,
            couponAmount,
            description,
            totalLimit,
            perUserLimit,
            purchaseAmount,
            expiryDate,
            maxDiscount } = req.body;

        const expirationDate = new Date(expiryDate + 'T00:00:00Z');
        const coupon = await Coupon.findOne({ couponCode });
        if (coupon)
            return res.status(400).json({ message: "Coupon code already added" })
        const newCouponData = new Coupon({
            couponCode,
            description,
            couponType,
            couponAmount,
            purchaseAmount,
            expirationDate,
            totalLimit,
            perUserLimit,
            maxDiscount
        })
        await newCouponData.save();
        return res.status(200).json({ message: "Coupon added successfully" })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while adding coupon" })
    }
}

exports.deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findOneAndDelete({ _id: id }, { new: true });
        if (coupon)
            return res.status(200).json({ message: "Coupon deleted successfully" });
        else
            return res.status(400).json({ message: "Coupon failed to delete" });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Error occured while deleting coupon" })
    }
}


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
                from = formatDateToDDMMYYYY(new Date());
                to = formatDateToDDMMYYYY(new Date());
                break;
            }
            case "Weekly": {
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                from = formatDateToDDMMYYYY(weekAgo);
                to = formatDateToDDMMYYYY(new Date());
                break;
            }
            case "Monthly": {
                const monthAgo = new Date();
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                monthAgo.setDate(1);
                monthAgo.setHours(0, 0, 0, 0);
                from = formatDateToDDMMYYYY(monthAgo);
                const currentMonth = new Date();
                currentMonth.setHours(23, 59, 59, 999);
                to = formatDateToDDMMYYYY(currentMonth);
                break;
            }
            case "Custom": {
                if (!startDate || !endDate)
                    return res.status(400).json({ message: "Enter date range" });

                from = formatDateToDDMMYYYY(new Date(startDate));
                to = formatDateToDDMMYYYY(new Date(endDate));
                break;
            }
            default: {
                console.log("");
            }
        }

        const query = {};

        if (from && to) {
            query.orderDate = { $gte: from, $lte: to };
        }
        const orders = await Orders.find(query).populate([{ path: "user" }, { path: "orderItems.product" }, {
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