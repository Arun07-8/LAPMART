// middleware/upload.js or wherever your original multer code is

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary'); // adjust the path

// Setup storage to upload to Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'Uploads', // Cloudinary folder
    allowed_formats: ['jpg', 'png', 'jpeg'],
    public_id: `${Date.now()}-${file.originalname.split('.')[0]}`, // Optional custom filename
  }),
});

const uploads = multer({ storage }).fields([
  { name: 'image1', maxCount: 1 },
  { name: 'image2', maxCount: 1 },
  { name: 'image3', maxCount: 1 },
  { name: 'image4', maxCount: 1 }
]);

const singleupload = multer({ storage }).single("croppedImage");

module.exports = {
  uploads,
  singleupload
};
