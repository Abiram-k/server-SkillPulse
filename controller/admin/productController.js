
const Product = require("../../models/productModel");
const Brand = require('../../models/brandModel');
const Category = require("../../models/categoryModel")


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

exports.getProduct = async (req, res) => {
    try {
        const { filter } = req.query;
        let products = res.locals.results?.data;
        res.locals.results.products = products;

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


