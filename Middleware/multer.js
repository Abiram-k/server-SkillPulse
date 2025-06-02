const multer = require('multer');
const cloudinary = require("../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Skillpulse_products",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const uploadImage = multer({ storage: storage });

const single = uploadImage.single('file');

const multiple = uploadImage.fields([ 
  { name: 'file1', maxCount: 1 },
  { name: 'file2', maxCount: 1 },
  { name: 'file3', maxCount: 1 }
]);

module.exports = { single, multiple, uploadImage };