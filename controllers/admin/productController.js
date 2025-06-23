const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/BrandSchema");
// const {uploads}=require("../../config/multer")
// const fs=require("fs");
// const path = require('path');
const cloudinary = require('../../config/cloudinary');



const productInfo = async (req, res) => {
    try {
        const search = decodeURIComponent(req.query.search || "").trim();
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 3;
        let query = { isDeleted: false };
        if (search) {
            query.$and = [
                { isDeleted: false },
                {
                    $or: [
                        { productName: { $regex: search, $options: 'i' } },
                        { 'category.name': { $regex: search, $options: 'i' } },
                        { 'brand.name': { $regex: search, $options: 'i' } }
                    ]
                }
            ];
        }

        const products = await Product.find(query)
            .populate('category', 'name')
            .populate('brand', 'name')
            .select('productName productImage category brand quantity salePrice isListed _id')
            .limit(limit)
            .skip((page - 1) * limit)
            .lean();

        const count = await Product.countDocuments(query);
        const totalPages = Math.ceil(count / limit);
        if (req.headers.accept.includes('application/json')) {
            return res.json({ products, currentPage: page, totalPages });
        }
        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });

        if (categories.length > 0 && brands.length > 0) {
            res.render('products', {
                product: products,
                currentPage: page,
                totalPages,
                category: categories,
                brand: brands,
                search
            });
        } else {
            res.status(404).redirect('/admin/pagenotFounderror');
        }
    } catch (error) {
        console.error('Error in productInfo:', error);
        if (req.headers.accept.includes('application/json')) {
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.status(500).render('error', { message: 'Internal Server Error' });
        }
    }
};


const loadaddProduct = async (req, res) => {
    try {
      
        const categories = await Category.find({ isListed: true, isDeleted:false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });
        const products = await Product.find({ isListed: true, isDeleted: false});
        res.render("addProduct", {
            category: categories,
            brand: brands,
            product: products,
        });
    } catch (error) {
        console.error("Error loading add product page:", error);
        res.redirect("/admin/pagenotFounderror");
    }
};


const listAvailableProducts = async (req, res) => {
  try {
    const products = await Product.find(
      { isDeleted: false, isListed: true }, // only listed, active products
      '_id productName' // only return _id and productName
    );

    res.status(200).json({ products }); // send in JSON format for dropdown
  } catch (error) {
    console.error("Error fetching product list for offer:", error);
    res.status(500).json({ error: "Failed to load products" });
  }
};

const addProducts = async (req, res) => {
    try {
    
        const {
            productName,
            description,
            brand,
            category,
            salePrice,
            quantity,
            processor,
            graphicsCard,
            ram,
            Storage,
            display,
            operatingSystem,
            Battery,
            Weight,
            Warranty,
            additionalFeatures
        } = req.body;

        const productExist = await Product.findOne({
            productName: productName.trim(),
            isDeleted: false
        });

     

        if (productExist) {
            return res.status(400).json({ error: 'Product already exists' });
        }
     

        if (!req.files || req.files.length < 2 || req.files.length > 5) {
            return res.status(400).json({
                error: `Please upload between 2 and 5 images. Received: ${req.files ? req.files.length : 0}.`
            });
        }

        const images = req.files.map(file => ({
            url: file.path,
            public_id: file.filename
        }));

      
        const newProduct = new Product({
            productName,
            description,
            brand,
            category,
            salePrice: parseFloat(salePrice),
            createdOn: new Date(),
            quantity: parseInt(quantity),
            productImage: images.map(img => img.url),
            status: 'Available',
            processor: processor || '',
            graphicsCard: graphicsCard || '',
            ram: ram || '',
            Storage: Storage || '',
            display: display || '',
            operatingSystem: operatingSystem || '',
            Battery: Battery || '',
            Weight: Weight || '',
            additionalFeatures: additionalFeatures || '',
            Warranty: Warranty || ''
        });

        const savedProduct = await newProduct.save();
        return res.status(200).json({
            success: true,
            message: 'Product added successfully',
            productId: savedProduct._id
        });
    } catch (error) {
        console.error('Error adding product:', error);
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message
        });
    }
};

const deleteImageFromCloudinary = async (publicId) => {
    if (!publicId) return;
    
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result;
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        throw error;
    }
};

//   listed Product 
const listedProduct=async (req,res) => {
    try {
        
        const id=req.params.id
        await Product.updateOne({_id:id},{$set:{isListed:true}})
        res.status(200).json({message:"Product listed Successfully"})
    } catch (error) {
        console.error('Error listing product:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
}

//   unlisted Product
const unlistedProduct=async (req,res) => {
    try {
        
        const id=req.params.id;
        await Product.updateOne({_id:id},{$set:{isListed:false}})
        res.status(200).json({message:"Product Unlisted Successfully"})
    } catch (error) {
        console.error('Error unlisting product:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
}
//  product editpage rendering
const loadEditProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.redirect('/admin/pagenotFounderror');
        }

        const product = await Product.findById(productId).populate('brand category');
        if (!product) {
            return res.redirect('/admin/pagenotFounderror');
        }

        const brand = await Brand.find({ isListed: true, isDeleted: false });
        const category = await Category.find({ isListed: true, isDeleted: false });

        res.render('editProduct', { product, brand, category });
    } catch (error) {
        console.error('Error loading edit product:', error);
        res.redirect('/admin/pagenotFounderror');
    }
};

const editProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        const updatedFields = {
            productName: data.productName ? data.productName.trim() : '',
            description: data.description || '',
            brand: data.brand || '',
            category: data.category || '',
            salePrice: parseFloat(data.salePrice) || 0,
            quantity: parseInt(data.quantity) || 0,
            processor: data.processor || '',
            graphicsCard: data.graphicsCard || '',
            ram: data.ram || '',
            Storage: data.Storage || '',
            display: data.display || '',
            operatingSystem: data.operatingSystem || '',
            Battery: data.Battery || '',
            Weight: data.Weight || '',
            additionalFeatures: data.additionalFeatures || '',
            Warranty: data.Warranty || '',
            status: 'Available',
            productImage: []
        };

        const requiredFields = [
            'productName', 'description', 'brand', 'category',
            'salePrice', 'processor', 'graphicsCard', 'ram',
            'Storage', 'display', 'operatingSystem', 'Battery', 'Weight', 'Warranty'
        ];
        for (const field of requiredFields) {
            if (!updatedFields[field]) {
                return res.status(400).json({
                    success: false,
                    message: `${field} is required`
                });
            }
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Preserve existing images
        updatedFields.productImage = [...(product.productImage || [])];

        // Add new images from req.files
        if (req.files && req.files.length > 0) {
            const newImageUrls = req.files.map(file => file.path);
            updatedFields.productImage = [...updatedFields.productImage, ...newImageUrls];
        }

        // Validate total image count
        if (updatedFields.productImage.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Minimum 2 images required'
            });
        }
        if (updatedFields.productImage.length > 5) {
            updatedFields.productImage = updatedFields.productImage.slice(0, 5);
        }
    
     
        updatedFields.productImage = [...new Set(updatedFields.productImage.filter(url => url && typeof url === 'string'))];

        const updatedProduct = await Product.findByIdAndUpdate(id, updatedFields, {
            new: true,
            runValidators: true
        });

        if (!updatedProduct) {
            return res.status(500).json({
                success: false,
                message: 'Failed to update product'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Product updated successfully',
            product: updatedProduct
        });
    } catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during product update',
            error: error.message
        });
    }
};

const removeProductImage = async (req, res) => {
    try {
        const { productId, index } = req.params;
        const imageIndex = parseInt(index);

        if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ success: false, message: 'Invalid product ID' });
        }

        if (isNaN(imageIndex) || imageIndex < 0) {
            return res.status(400).json({ success: false, message: 'Invalid image index' });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        if (imageIndex >= product.productImage.length) {
            return res.status(400).json({ success: false, message: 'Image index out of bounds' });
        }

        if (product.productImage.length <= 2) {
            return res.status(400).json({ success: false, message: 'Cannot remove image: Minimum 2 images required' });
        }

        const imageUrl = product.productImage[imageIndex];
        const getPublicIdFromUrl = (url) => {
            if (!url) return null;
            try {
                const regex = /\/Uploads\/(.+?)\.(?:jpg|jpeg|png|webp)$/i;
                const match = url.match(regex);
                return match ? `Uploads/${match[1]}` : null;
            } catch (error) {
                console.error('Error parsing public_id from URL:', url, error);
                return null;
            }
        };

        const publicId = getPublicIdFromUrl(imageUrl);
        if (publicId) {
            try {
                await cloudinary.uploader.destroy(publicId);
            } catch (deleteError) {
                console.error(`Failed to delete image with public_id: ${publicId}`, deleteError);
            }
        }

        product.productImage.splice(imageIndex, 1);
        const updatedProduct = await product.save();

        return res.status(200).json({
            success: true,
            message: 'Image removed successfully',
            product: updatedProduct
        });
    } catch (error) {
        console.error('Error removing product image:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during image removal',
            error: error.message
        });
    }
};


const deleteProduct=async(req,res) => {
    try{
        const id=req.params.id;
        const deletedProduct=await Product.findByIdAndUpdate(
            id,
            {isDeleted:true},
            {new:true},
        )
        
        if(!deletedProduct){
            return res.status(404).json({error:"Product Not found"})
        }
        return res.status(200).json({message:"Product is deleted"})
    }catch(error){
        console.error("Error soft deletde is not working",error)
        return res.status(500).json({error:"Internal server error"})
    }
}

// module.exports = { loadEditProduct, editProduct, removeProductImage };


const searchproduct = async (req, res) => {
    try {
        const searchQuery = req.query.search ? req.query.search.trim() : '';

        // Build query for MongoDB
        let query = { isDeleted: false }; // Only include non-deleted products
        if (searchQuery) {
            query.$and = [
                { isDeleted: false },
                {
                    $or: [
                        { productName: { $regex: searchQuery, $options: 'i' } }, // Case-insensitive search on product name
                        { 'category.name': { $regex: searchQuery, $options: 'i' } }, // Search category name
                        { 'brand.name': { $regex: searchQuery, $options: 'i' } } // Search brand name
                    ]
                }
            ];
        }

        // Fetch products with populated category and brand
        const products = await Product.find(query)
            .populate('category', 'name') // Only select category name
            .populate('brand', 'name') // Only select brand name
            .select('productName productImage category brand quantity salePrice isListed')
            .lean(); // Convert to plain JavaScript object for faster processing

        // Return JSON response
        res.json({ products });
    } catch (error) {
        console.error('Error in live search:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports={
    productInfo,
    listedProduct,
    unlistedProduct,
    addProducts,
    editProduct,
    loadaddProduct,
    loadEditProduct,
    removeProductImage,
    deleteProduct,
    deleteImageFromCloudinary

}
