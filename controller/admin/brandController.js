const { StatusCodes } = require("../../constants/statusCodes");
const Brand = require("../../models/brandModel");
const Category = require("../../models/categoryModel");



exports.getBrand = async (req, res) => {
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
        const brands = await Brand.find(filterObj).sort(sortObj)
            .skip((page - 1) * limit)
            .limit(Number(limit));
        if (brands) {
            return res.json({ message: "succesully fetched all brands", brands, pageCount });
        }
    } catch (err) {
        console.log(err.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch brands" });
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
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Brand already exists" });
        else {
            const brand = await Brand.create({
                name, description, image
            })
            return res.status(StatusCodes.OK).json({
                message: "Brand added succesfully",
                brand
            })
        }
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
    }
}

exports.deleteBrand = async (req, res) => {
    try {
        let { id } = req.params;
        const deletedBrand = await Brand.
            findByIdAndUpdate({ _id: id }, { isDeleted: true, deletedAt: Date.now() });
        if (deletedBrand)
            return res.status(StatusCodes.OK).json({ message: "Brand successfully deleted" });
    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "failed to delete Brand" });
    }
}

exports.brandRestore = async (req, res) => {
    try {
        const { id } = req.params;
        const RestoredBrand = await Brand.
            findByIdAndUpdate({ _id: id }, { isDeleted: false, deletedAt: null });

        if (RestoredBrand)
            return res.status(StatusCodes.OK).json({ message: "Brand successfully Restore" });
    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "failed to Restore Brand" });
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
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Brand already exists" });
        }
        const updateData = { name };
        if (description) updateData.description = description;
        if (req.file?.path) updateData.image = req.file.path;

        const updatedBrand = await Brand.findByIdAndUpdate(id, updateData, { new: true });

        return res.status(StatusCodes.OK).json({
            message: "Successfully edited the brand",
            updatedBrand,
        });
    } catch (error) {
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || "Brand not edited" });
    }
};

exports.listBrand = async (req, res) => {
    try {
        const { id } = req.params;
        const brand = await Brand.findById(id);
        brand.isListed = !brand?.isListed
        brand.save();
        return res.status(StatusCodes.OK).json({ message: "success", brand })
    } catch (error) {
        console.log(error)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || "Failed to list/unlist Brand" })
    }
}