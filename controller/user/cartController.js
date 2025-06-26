const { default: mongoose } = require("mongoose");
const Cart = require("../../models/cartModel");
const User = require("../../models/userModel");
const Coupon = require("../../models/couponModel.");
const { StatusCodes } = require("../../constants/statusCodes");

exports.getCart = async (req, res) => {
    try {
        // const { id } = req.params;
        const id = req.body.authUser._id
        const cartItems = await Cart.find({ user: id })
            .populate([{ path: "products.product" },
            { path: "appliedCoupon" }
            ]);

        return res.status(StatusCodes.OK).json({ message: "Successfully fetched all cart items", cartItems });

    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "failed to fetch cart items" })
    }
}

exports.updateQuantity = async (req, res) => {
    try {
        const { productId } = req.params;
        const { value } = req.query;
        const userId = req.body.authUser._id
        const cart = await Cart.findOne({
            user: userId,
            products: { $elemMatch: { "product": productId } }
        }).populate([{ path: "products.product" }, { path: "appliedCoupon" }]);

        if (!cart) return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Cart not found." });
        console.log(cart)

        const productIndex = cart.products.findIndex(item => item.product._id.toString() === productId);

        if (cart?.products[productIndex]?.quantity >= 5 && value == 1)
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Already added 5 units" });

        if (productIndex === -1)
            return res.status(StatusCodes.NOT_FOUND).json({ success: false, message: "Product not found in cart." });

        const product = cart.products[productIndex];
        const currentQuantity = product.quantity;
        const newQuantity = currentQuantity + parseInt(value);

        // if ((cart.grandTotal - cart.totalDiscount) == cart.appliedCoupon?.maxDiscount && value > 0)
        //     return res.status(400).json({ couponMessage: "Maximum coupon discount applied" });

        if (newQuantity < 0)
            return res.status(StatusCodes.BAD_REQUEST).json({ success: false, message: "Quantity cannot be negative." });

        product.quantity = newQuantity;
        product.totalPrice = product.product.salesPrice * newQuantity;
        const { appliedCoupon } = cart;

        product.offeredPrice = product.totalPrice;

        cart.appliedCoupon = null;
        totalDiscoutApplied = cart.grandTotal - cart.totalDiscount


        cart.grandTotal = cart.products.reduce((acc, p) => p.totalPrice + acc, 0);

        if (appliedCoupon) {
            let totalDiscount = cart.products.reduce((acc, p) => acc + (p.offeredPrice), 0);

            if (cart.grandTotal - totalDiscount < appliedCoupon?.maxDiscount) {
                cart.totalDiscount = totalDiscount;
            } else {
                cart.totalDiscount = cart.grandTotal - appliedCoupon.maxDiscount;
            }
        } else {
            cart.totalDiscount = cart.products.reduce((acc, p) => acc + (p.offeredPrice), 0);
        }

        await cart.save();
        res.status(StatusCodes.OK).json({ message: "Cart updated successfully" });
    } catch (error) {
        console.error(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occurred while updating" });
    }
};

exports.removeCartItem = async (req, res) => {
    try {
        const { productId } = req.params;
        // const { userId } = req.query;
        const userId = req.body.authUser._id

        const cart = await Cart.findOne({ user: userId }).populate("appliedCoupon")
        if (cart) {
            const productIndex = cart.products.findIndex((item) => item.product.toString() === productId);
            if (productIndex === -1)
                console.log("Product not found");

            const deletedItem = cart.products.splice(productIndex, 1);

            cart.grandTotal -= deletedItem[0]?.totalPrice;
            // cart.totalDiscount -= deletedItem[0].offeredPrice;
            if (deletedItem[0].offeredPrice <= cart.totalDiscount) {
                cart.totalDiscount -= deletedItem[0].offeredPrice;
            }

            if (cart.grandTotal < cart.appliedCoupon?.purchaseAmount) {
                cart.appliedCoupon = null
            }
            if (cart.products.length == 0) {
                cart.appliedCoupon = null
                cart.grandTotal = 0
                cart.totalDiscount = 0
            }
            await cart.save();
            return res.status(StatusCodes.OK).json({ message: "Item were deleted" })
        } else {
            console.log("Cart not founded");
        }

    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Server failed to delete this item" })
    }
}

exports.applyCoupon = async (req, res) => {
    try {
        const { couponId } = req.query;
        const id = req.body.authUser._id
        if (!id) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User id not founded" })
        }
        const cart = await Cart.findOneAndUpdate({ user: id },
            { appliedCoupon: couponId },
            { new: true })

        if (cart) {
            const cart = await Cart.findOne({ user: id }).populate("appliedCoupon");
            const coupon = await Coupon.findOne({ _id: couponId });
            if (cart.appliedCoupon) {
                if (cart.appliedCoupon.couponType === "Percentage") {
                    cart.products.forEach((product) => {
                        if (coupon.purchaseAmount <= cart.grandTotal) {
                            const discountAmount =
                                product.totalPrice * (coupon.couponAmount / 100)
                            const maxDiscountExceedPercentage = (cart.appliedCoupon.maxDiscount / cart.grandTotal) * 100;
                            const maxDiscountExceedAmount =
                                product.totalPrice * (maxDiscountExceedPercentage / 100)
                            let appliedDiscount = cart.grandTotal * (coupon.couponAmount / 100)
                            if (appliedDiscount > coupon.maxDiscount) {
                                product.offeredPrice = product.totalPrice - maxDiscountExceedAmount
                            } else {
                                product.offeredPrice = product.totalPrice - discountAmount;
                            }
                        } else {
                            product.offeredPrice = product.totalPrice;
                        }
                    });
                } else {
                    cart.products.forEach((product) => {
                        if (coupon.purchaseAmount <= cart.grandTotal) {
                            const proportionalDiscount =
                                (product.totalPrice / cart.grandTotal) * coupon.couponAmount
                            product.offeredPrice = Math.round(Math.max(0, product.totalPrice - (proportionalDiscount)));
                        } else {
                            product.offeredPrice = product.totalPrice;
                        }
                    });
                }
                cart.totalDiscount = cart.products.reduce((acc, product) => acc + (product.offeredPrice), 0);
                cart.grandTotal = cart.products.reduce((acc, product) => acc + product.totalPrice, 0)
                await cart.save();
                return res.status(StatusCodes.OK).json({ message: "Coupon applied successfully" });
            }
        }
        return res.status(StatusCodes.BAD_REQUEST).json({ message: "Coupon failed to apply" });
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while applying coupon" })
    }
}

exports.removeCoupon = async (req, res) => {
    try {
        // const { id } = req.params;
        const id = req.body.authUser._id

        const cart = await Cart.findOne({ user: id }).populate("products.product")
        if (!cart) {
            return res.status(StatusCodes.BAD_REQUEST).json({ message: "Cart not founded while removing coupon" });
        }
        cart.products.forEach((product => product.offeredPrice = product.totalPrice))
        cart.appliedCoupon = null
        cart.totalDiscount = cart.products.reduce((acc, product) => product.offeredPrice + acc, 0)
        cart.save();
        return res.status(StatusCodes.OK).json({ message: "Coupon removed successfully" });

    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while removing coupon" })
    }
} 