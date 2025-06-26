const { StatusCodes } = require("../../constants/statusCodes");
const Banner = require("../../models/bannerModel")

exports.getBanner = async (req, res) => {
    try {
        const { search = "", page = 1, limit = 5, startDate = null, endDate = null, isAdmin = false } = req.query;
        const filterObj = {};
        if (!isAdmin) {
            filterObj.isListed = true;
        }

        if (startDate && endDate) {
            filterObj.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }
        if (search) {
            filterObj.description = { $regex: search, $options: "i" }
        }
        let sortObj = { createdAt: -1 };
        const totalDocs = await Banner.countDocuments(filterObj);
        const pageCount = Math.ceil(totalDocs / limit);

        const banner = await Banner.find(filterObj).sort(sortObj).skip((page - 1) * limit)
            .limit(Number(limit));

        if (banner) {
            return res.status(StatusCodes.OK).json({ message: "succesully fetched all banners", banner, pageCount });
        }

    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch banners" });
    }
}
exports.addBanner = async (req, res) => {
    try {
        let { description } = req.body;
        const image = req.file?.path;
        if (!description) {
            description = undefined;
        }
        const existBanner = await Banner.findOne({
            name: {
                $regex: `^${description}$`,
                $options: ""
            }
        })
        if (existBanner)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Banner already exists" });
        else {
            const banner = await Banner.create({
                description, image
            })
            return res.status(StatusCodes.OK).json({
                message: "Banner added succesfully",
                banner
            })
        }
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal Server Error" });
    }
}

exports.listBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await Banner.findById(id);
        banner.isListed = !banner?.isListed
        banner.save();
        return res.status(StatusCodes.OK).json({ message: "success", banner })
    } catch (error) {
        console.log(error)
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || "Failed to list/unlist Category" })
    }
}
exports.deleteBanner = async (req, res) => {
    try {
        let { id } = req.params;
        if (!id) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Banner ID is required" });
        }
        const deletedBanner = await Banner.
            findByIdAndDelete(id);
        if (deletedBanner)
            return res.status(StatusCodes.OK).json({ message: "Banner successfully deleted" });
    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "failed to delete banner" });
    }
}