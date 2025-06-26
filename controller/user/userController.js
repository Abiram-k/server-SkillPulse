const { StatusCodes } = require("../../constants/statusCodes");
const User = require("../../models/userModel");
const path = require("path");
const dotenv = require('dotenv');
const Wallet = require("../../models/walletModel");
dotenv.config({ path: path.resolve(__dirname, "../../.env") })

exports.getUserData = async (req, res) => { 
    try {
        const token = req.cookies.refreshToken;
        if (!token) return res.status(StatusCodes.UNAUTHORIZED).send("Unauthorized");
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN);
        const user = await User.findById(decoded.id).select("-password");
        res.status(StatusCodes.OK).json(user);
    } catch (error) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: "Failed to retrieve user data", error });
    }
}



exports.updateUser = async (req, res) => {

    try {
        const { firstName, lastName, mobileNumber, dateOfBirth } = req.body;
        // const { id } = req.query;
        const id = req.body.authUser._id

        const profileImage = req.file?.path;

        const validDateOfBirth = dateOfBirth && !isNaN(Date.parse(dateOfBirth))
            ? new Date(dateOfBirth)
            : null;
        const userData = {
            firstName, lastName, mobileNumber, profileImage, dateOfBirth: validDateOfBirth
        };
        const updatedUser = await User.findByIdAndUpdate(id, { $set: userData }, { new: true, upsert: true });

        if (updatedUser) {
            return res.status(StatusCodes.OK).json({ message: "Profile successfully updated", updatedUser });
        }
    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Filed to update your profile" })
    }
}

exports.getUser = async (req, res) => {
    try {
        const id = req.body.authUser._id
        // const { id } = req.query;
        const userData = await User.findById(id);
        return res.status(StatusCodes.OK).json({ message: "User successfully fetched", userData });

    } catch (error) {

        console.log(error.message);
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch user data !" });

    }
}


exports.addAddress = async (req, res) => {
    try {
        const { firstName, secondName, mobileNumber, alternativeMobile, city, state, address, pincode, type } = req.body;
        // const { id } = req.query;
        const id = req.body.authUser?._id
        console.log(req.body.authUser)
        if (!id) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User id not founded" })
        }

        const user = await User.findById(id);
        if (!user.address) {
            user.address = [];
        } else {
            if (user.address.some((addr) => addr.address === address)) {
                console.log("User already exists")
                return res.status(StatusCodes.BAD_REQUEST).json({ message: "Address already exists" })
            }
        }
        user.address.push({ firstName, secondName, mobileNumber, alternativeMobile, city, state, address, pincode, type });
        await user.save();
        return res.status(StatusCodes.OK).json({ message: "Address added successfully" })
    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: error.message || "Error occured while adding address" })
    }
}

exports.getAddress = async (req, res) => {
    try {
        const { addrId } = req.query;
        const id = req.body.authUser._id
        if (!id) {
            return res.status(StatusCodes.UNAUTHORIZED).json({ message: "User id not founded" })
        }
        const user = await User.findById(id);
        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found" });
        }
        let addresses = user.address || [];
        let selectedAddress;
        if (addrId) {
            selectedAddress = addresses.find((addr) => addr._id.toString() === addrId);
            if (!selectedAddress) {
                return res.status(StatusCodes.NOT_FOUND).json({ message: "Address not found" });
            }
            user.deliveryAddress = addrId;
            await user.save();
        } else {
            selectedAddress = addresses.find(
                (addr) => addr._id.toString() === user.deliveryAddress
            ) || addresses[0];
        }
        if (!addresses.length) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "You can add address here" });
        }
        return res.status(StatusCodes.OK).json({
            message: "Address successfully fetched",
            addresses,
            selectedAddress,
        });
    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: error.message || "Error occurred while fetching address",
        });
    }
};


exports.getEditAddress = async (req, res) => {
    try {
        const { id } = req.query;
        const [addressObj] = await User.find({ "address._id": id }, { "address.$": 1 })
        const [address] = addressObj.address
        return res.status(StatusCodes.OK).json({ message: "Successfully fetched edit address details", address })
    } catch (error) {
        console.log(error.message);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to fetch details,You can enter details" })
    }
}

exports.editAddress = async (req, res) => {

    try {
        const {
            firstName,
            secondName,
            mobileNumber,
            alternativeMobile,
            city,
            state,
            pincode,
            type,
            address
        } = req.body;


        const { id } = req.query;

        const user = await User.findOne({ "address._id": id });

        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "User not found." });
        }

        const addressIndex = user.address.findIndex(addr => addr._id.toString() === id);

        if (addressIndex === -1) {
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Address not found." });
        }

        user.address[addressIndex] = {
            ...user.address[addressIndex],
            firstName,
            secondName,
            mobileNumber,
            alternativeMobile,
            city,
            state,
            address,
            pincode,
            type
        };
        await user.save();

        return res.status(StatusCodes.OK).json({ message: "Address updated successfully.", address: user.address[addressIndex] });
    } catch (error) {
        console.error(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Failed to update address. Please try again later." });
    }
};

exports.deleteAddress = async (req, res) => {
    try {
        const { id } = req.query;

        const user = await User.findOne({ "address._id": id });
        const addressIndex = user.address.findIndex((addr, index) => addr._id.toString() == id);

        if (addressIndex == -1)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "address not founded" });
        user.address.splice(addressIndex, 1);
        await user.save();
        return res.status(StatusCodes.OK).json({ message: "Address deleted successfully" });
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while deleting address" })
    }
}

exports.getWallet = async (req, res) => {
    try {
        // const { id } = req.params;
        const id = req.body.authUser._id

        const { page, limit, isForCheckout } = req.query;
        const offset = (page - 1) * limit;

        const wallet = await Wallet.findOne({ user: id })

        if (isForCheckout) {
            return res.status(StatusCodes.OK).json({ message: "successfully fetched wallet data", wallet: { totalAmount: wallet.totalAmount } })
        }

        if (!wallet)
            return res.status(StatusCodes.NOT_FOUND).json({ message: "Wallet not found" });

        const totalDocs = wallet.transaction?.length
        const pageCount = Math.ceil(totalDocs / limit);


        const paginatedTransactions = wallet.transaction
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(offset, offset + Number(limit));

        const totalAmount = Math.round(wallet.totalAmount.toFixed(2)) || 0

        return res.status(StatusCodes.OK).json({
            message: "successfully fetched wallet data", wallet: {
                ...wallet,
                transaction: paginatedTransactions,
            }, pageCount, totalAmount
        })
    } catch (error) {
        console.log(error);
        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ message: "Error occured while fetching wallet data" })
    }
}