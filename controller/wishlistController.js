const Wishlist = require("../models/wishlistModel");


exports.getwishlist = async (req, res) => {


    try {
        const user = req.body.authUser._id;
        const wishlist = await Wishlist.find({ user }).populate('products.product');
        return res.status(200).json({ message: "Successfully fetched all the wishlist items", wishlist });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Server failed to fetch wishlist items" });
    }

}

exports.addToWishlist = async (req, res) => {
    try {
        const { product } = req.body;
        const user = req.body.authUser._id
        if (!product)
            return res.status(400).json({ message: "Product not found" });

        const wishlist = await Wishlist.findOneAndUpdate(
            { user },
            { $push: { products: { product } } },
            { new: true, upsert: true }
        )

        if (!wishlist) {
            return res.status(400).json({ message: "Wishlist not found" });
        }

        res.status(200).json({ message: "Product added to wishlist", wishlist });
    } catch (error) {
        console.log("Error", error);
        res.status(500).json({ message: "An error occurred", error });
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
            return res.status(404).json({ message: "Wishlist not found" });
        }

        res.status(200).json({ message: "Product removed from wishlist" });
    } catch (error) {
        console.error("Error while removing product from wishlist:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
