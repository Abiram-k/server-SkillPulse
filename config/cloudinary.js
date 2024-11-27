const cloudinary = require("cloudinary").v2;
const dotenv = require('dotenv');
const path = require("node:path")

dotenv.config({ path: path.resolve(__dirname, "../.env") });

// console.log(
//       "cloudinary name:", process.env.CLOUDINARY_NAME,
//       "cloudinary key:", process.env.CLOUDINARY_KEY,
//       "cloudinary seceret", process.env.CLOUDINARY_SECERTE
//           )
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_NAME,
    api_key: process.env.CLOUDINARY_KEY,
    api_secret: process.env.CLOUDINARY_SECERTE,
});

module.exports = cloudinary;