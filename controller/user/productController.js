const { StatusCodes } = require("../../constants/statusCodes");
const Brand = require("../../models/brandModel");
const Cart = require("../../models/cartModel");
const Category = require("../../models/categoryModel");
const Product = require("../../models/productModel");

exports.getProducts = async (req, res) => {
    try {
        const { brand, category, price, newArrivals, offer, search = "", page = 1, limit = 5, } = req.query;
        const query = { isListed: true, isDeleted: false };
        if (category) {
            const categoryDoc = await Category.findOne({ name: category });
            if (categoryDoc) query.category = categoryDoc._id.toString();
        }

        if (brand) {
            const brandDoc = await Brand.findOne({ name: brand });
            if (brandDoc) query.brand = brandDoc._id.toString();
        }
        if (search) {
            query.productName = {
                $regex: `^${search}`,
                $options: 'i'
            };
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
                query.$expr = {
                    $and: [
                        { $gte: [{ $max: ["$offer", "$categoryOffer"] }, 10] },
                        { $lte: [{ $max: ["$offer", "$categoryOffer"] }, 20] },
                    ],
                };
            } else if (offer === "20-30") {
                query.$expr = {
                    $and: [
                        { $gte: [{ $max: ["$offer", "$categoryOffer"] }, 20] },
                        { $lte: [{ $max: ["$offer", "$categoryOffer"] }, 30] },
                    ],
                };
            } else if (offer === "above-50") {
                query.$expr = {
                    $gte: [{ $max: ["$offer", "$categoryOffer"] }, 50],
                };
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

        const totalDocs = await Product.countDocuments(query);
        const pageCount = Math.ceil(totalDocs / limit);

        const products = await Product.find(query)
            .sort(sortOrder).skip((page - 1) * limit)
            .limit(Number(limit))
            .populate('category')
            .populate('brand');

        const categoryDoc = await Category.find();
        const brandDoc = await Brand.find();

        return res.status(StatusCodes.OK).json({
            message: "Successfully Fetched All Products",
            products,
            categoryDoc,
            brandDoc,
            isBlocked: req.body.isBlocked || false,
            pageCount
        });
    } catch (error) {
        console.error("Error fetching products:", error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed To Fetch Product Data" });
    }
};

exports.getProductDetails = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Product id not founded" });
        if (id.length < 24)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Invalid product" });
        const productData = await Product.findOne({ _id: id });
        if (!productData)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Product not founded" });

        res.status(StatusCodes.OK).json({ message: "Product data fetched successfully", productData });
    } catch (error) {
        console.log("Executed")
        console.log("Error fetching products details:", error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed To Fetch Product Data" });
    }
}


exports.getSimilarProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const productData = await Product.findById(id);
        const similarProducts = await Product.find({ category: productData?.category, _id: { $ne: id } })
            .populate("brand")
        if (similarProducts.length === 0)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "No Similar products were founded !" })
        return res.status(StatusCodes.OK).json({ message: "Products fetched successfully", similarProducts });
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || "Server error" });
    }
}

exports.getBrandCategoryInfo = async (req, res) => {

    try {
        const { id } = req.params;

        const productData = await Product.findById(id).populate('category brand');
        if (!productData) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Product not found" });
        }
        const { category, brand } = productData;

        const isCategoryAvailable = category && category.isListed && !category.isDeleted;
        const isBrandAvailable = brand && brand.isListed && !brand.isDeleted;

        const isAvailable = isCategoryAvailable && isBrandAvailable;

        return res.status(StatusCodes.OK).json({ message: "success", isAvailable });
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occurred fetching product/brand details" });
    }
}


exports.addToCart = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.body.authUser._id

        if (!userId) {
            res.status(StatusCodes.BAD_REQUEST).json({ message: "Login to you account, to add items" })
        }
        const product = await Product.findById(id);

        if (!product) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: 'Product not found' });
        }
        if (!product.units)
            return res.status(StatusCodes.FORBIDDEN).json({ message: 'Currently product is out of stock!' });
        if (product.isDeleted || !product.isListed)
            return res.status(StatusCodes.NOT_FOUND).json({ message: 'Product is unavailable!' });

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
        return res.status(StatusCodes.OK).json({ message: "Product added to cart", cart })
    } catch (error) {
        console.log(error)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: 'Server error' });
    }
}