const { StatusCodes } = require("../constants/statusCodes");
const Wishlist = require("../models/wishlistModel");


exports.getwishlist = async (req, res) => {
    try {
        const user = req.body.authUser._id;
        if (!user) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User id not founded" })
        }
        const wishlist = await Wishlist.find({ user }).populate('products.product');
        return res.status(StatusCodes.OK).json({ message: "Successfully fetched all the wishlist items", wishlist });
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Server failed to fetch wishlist items" });
    }

}

exports.addToWishlist = async (req, res) => {
    try {
        const { product } = req.body;
        const user = req.body.authUser._id
        if (!user)
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User id not founded" })
        if (!product)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Product not found" });

        const userWishList = await Wishlist.find({ user });
        if (userWishList[0]?.products.length >= 5) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Already added 5 items!" });
        }
        const wishlist = await Wishlist.findOneAndUpdate(
            { user },
            { $push: { products: { product } } },
            { new: true, upsert: true }
        )

        if (!wishlist) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Wishlist not found" });
        }

        res.status(StatusCodes.OK).json({ message: "Product added to wishlist", wishlist });
    } catch (error) {
        console.log("Error", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "An error occurred", error });
    }
};

exports.deleteWishlistItem = async (req, res) => {
    try {
        const { product } = req.query;
        user = req.body.authUser._id
        const wishlist = await Wishlist.findOneAndUpdate(
            { user },
            { $pull: { products: { product } } },
            { new: true }
        );

        console.log(user);

        if (!wishlist) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Wishlist not found" });
        }

        res.status(StatusCodes.OK).json({ message: "Product removed from wishlist" });
    } catch (error) {
        console.error("Error while removing product from wishlist:", error);
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
    }
};
