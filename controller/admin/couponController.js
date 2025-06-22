const { StatusCodes } = require("../../constants/statusCodes");
const Coupon = require("../../models/couponModel.");
const User = require("../../models/userModel");


exports.getCoupons = async (req, res) => {
    try {
        const { search = "", isForUser = false, page = 1, limit = 5 } = req.query;
        const userId = req.body.authUser?._id
        let filteredCoupons;
        let pageCount = 0
        if (isForUser) {
            if (!userId)
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User id not founded" });
            const user = await User.findById(userId);

            if (!user)
                return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User  not founded" });
            const coupons = await Coupon.find().sort({ createdAt: -1 })
            filteredCoupons = coupons.filter((coupon) => {
                const applied = user.appliedCoupons.find(
                    (entry) => entry.coupon.toString() === coupon._id.toString()
                );

                return !applied || applied?.usedCount < coupon.perUserLimit;
            });
        } else {
            const query = {};
            if (search.trim()) {
                query.couponCode = { $regex: `${search.trim()}`, $options: "i" };
            }
            const totalCoupons = await Coupon.countDocuments(query);
            pageCount = Math.floor(totalCoupons / limit)
            filteredCoupons = await Coupon.find(query).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
        }
        return res.status(StatusCodes.OK).json({ coupons: filteredCoupons, pageCount });

    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while fecthing coupon data" });
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
        const coupon = await Coupon.findOne({ couponCode: couponCode.trim() });
        if (coupon)
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Coupon code already added" })
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
        return res.status(StatusCodes.OK).json({ message: "Coupon added successfully" })
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while adding coupon" })
    }
}

exports.deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        const coupon = await Coupon.findOneAndDelete({ _id: id }, { new: true });
        if (coupon)
            return res.status(StatusCodes.OK).json({ message: "Coupon deleted successfully" });
        else
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Coupon failed to delete" });
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while deleting coupon" })
    }
}

