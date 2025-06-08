const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

// PRODUCT IMAGE STORAGE
const productStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'Uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        public_id: (req, file) => `product-${Date.now()}-${file.originalname.split('.')[0]}`,
        transformation: [{ width: 800, crop: 'limit' }]
    }
});

const productUpload = multer({
    storage: productStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFilter
}).array('images', 5);

// PROFILE IMAGE STORAGE
const profileStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'ProfilePictures',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        public_id: (req, file) => `profile-${Date.now()}-${file.originalname.split('.')[0]}`,
        transformation: [{ width: 400, height: 400, crop: 'thumb', gravity: 'face' }]
    }
});

const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 3* 1024 * 1024 },
    fileFilter: imageFilter
}).single('profileImage');

// COMMON FILTER
function imageFilter(req, file, cb) {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(file.originalname.toLowerCase().split('.').pop());
    const mimetype = filetypes.test(file.mimetype.split('/')[1]);
    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, or WebP images are allowed!'));
    }
}

module.exports = {
    productUpload,
    profileUpload
};
