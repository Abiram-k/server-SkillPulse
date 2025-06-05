const Category = require("../../models/categoryModel");
const Product = require("../../models/productModel");




exports.getCategory = async (req, res) => {
    try {
        const { search = "", filter = "", page = 1, limit = 5, startDate = null, endDate = null } = req.query;
        const filterObj = {};

        if (startDate && endDate) {
            filterObj.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        if (search) {
            filterObj.$or = [
                { name: { $regex: search, $options: "i" } },
                { description: { $regex: search, $options: "i" } }
            ];
        }
        let sortObj = { createdAt: -1 };
        if (filter === "oldest") {
            sortObj.createdAt = 1;
        } else if (filter === "A-Z") {
            sortObj.name = 1;
        } else if (filter === "Z-A") {
            sortObj.name = -1;
        }
        const totalDocs = await Category.countDocuments(filterObj);
        const pageCount = Math.ceil(totalDocs / limit);

        const categories = await Category.find(filterObj).sort(sortObj)
            .skip((page - 1) * limit)
            .limit(Number(limit));

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
                if (product.salesPrice <= 1) {
                    product.salesPrice = 1;
                }
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
        console.log(error);
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