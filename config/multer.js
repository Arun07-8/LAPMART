const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => ({
    folder: 'Uploads', // Cloudinary folder
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    public_id: `${Date.now()}-${file.originalname.split('.')[0]}`, // Unique filename
    quality: 'auto:good', // Optimize image quality
    fetch_format: 'auto', // Optimize format
    transformation: [{ width: 800, crop: 'limit' }] // Resize to max width 800px
  }),
});

const uploads = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, or WebP images are allowed!'));
    }
  }
}).array('images', 4); // Accept up to 4 files under 'images'

module.exports = { uploads };