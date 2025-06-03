const Coupon = require("../../models/couponModel.");


exports.getCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find().sort({ createdAt: -1 });
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

