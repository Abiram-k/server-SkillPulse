const Brand = require("../../models/brandModel");
const Category = require("../../models/categoryModel");



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