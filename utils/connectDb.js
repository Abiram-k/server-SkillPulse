const mongoose = require("mongoose");

const connectToMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log("Successfully connected to MongoDB");
    } catch (error) {
        console.error(`Error occurred with MongoDB: ${error.name} - ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectToMongoDB;
