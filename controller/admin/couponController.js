const Coupon = require("../../models/couponModel.");
const User = require("../../models/userModel");


exports.getCoupons = async (req, res) => {
    try {
        const { search = "", isForUser = false } = req.query;
        const userId = req.body.authUser?._id
        let filteredCoupons;
        if (isForUser) {
            if (!userId)
                return res.status(401).json({ message: "User id not founded" });
            const user = await User.findById(userId);

            if (!user)
                return res.status(401).json({ message: "User  not founded" });
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

            filteredCoupons = await Coupon.find(query).sort({ createdAt: -1 });
        }
        return res.status(200).json(filteredCoupons);

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
        const coupon = await Coupon.findOne({ couponCode: couponCode.trim() });
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

