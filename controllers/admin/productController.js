const Product=require("../../models/productSchema");
const Category=require("../../models/categorySchema");
const Brand=require("../../models/BrandSchema");
const {uploads}=require("../../config/multer")
const fs=require("fs");
const path = require('path');
const cloudinary = require('../../config/cloudinary');


const produtInfo = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const productData = await Product.find({isDeleted:false,
            productName: { $regex: new RegExp(".*" + search + ".*", "i") }
        })
            .limit(limit)
            .skip((page - 1) * limit)
            .populate('category')
            .populate('brand')
            .exec();

        const count = await Product.countDocuments({
                productName: { $regex: new RegExp(".*" + search + ".*", "i") }   
        });

        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isListed: true, isDeleted: false });

        if (categories && brands) {
            res.render("products", {
                product: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                category: categories,
                brand:brands,
            });
        } else {
            res.redirect("/admin/pagenotFounderror");
        }
    } catch (error) {
        console.error("Error in produtInfo:", error);
        res.redirect("/admin/pagenotFounderror");
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

const addProducts = async (req, res) => {
    try {
        const products = req.body;
        
        const productExist = await Product.findOne({
            productName: products.productName.trim(), 
            isDeleted:false
        });
        
        if (productExist) {
            return res.status(400).json({ error: 'Product already exists' });
        }
        
        // Create new product
        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            brand: products.brand,
            category: products.category,
            regularPrice: parseFloat(products.regularPrice),
            salePrice: parseFloat(products.salePrice),
            createdOn: new Date(),
            quantity: parseInt(products.quantity),
            productImage: [],
            status: 'Available',
            processor: products.processor || '',
            graphicsCard: products.graphicsCard || '',
            ram: products.ram || '',
            Storage: products.Storage || '',
            display: products.display || '',
            operatingSystem: products.operatingSystem || '',
            Battery: products.Battery || '',
            Weight: products.Weight || '',
            additionalFeatures: products.additionalFeatures || "",
            Warranty: products.Warranty || ''
        });

        let images = [];

        for (let i = 1; i <= 4; i++) {
            if (req.files && req.files[`image${i}`] && req.files[`image${i}`][0]) {
                const file = req.files[`image${i}`][0];
        
                
                try {
                  
                    const result = await cloudinary.uploader.upload(file.path, {
                        folder: 'Uploads',
                        resource_type: 'image',
                        quality: 'auto:good', 
                        fetch_format: 'auto', 
                        transformation: [
                            { width: 800, crop: "limit" }
                        ]
                    });
                    
                    console.log(`Image${i} uploaded to Cloudinary:`, result.secure_url);
                    
                 
                    images.push({
                        url: result.secure_url,
                        public_id: result.public_id
                    });
                    
                   
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Error removing temp file: ${file.path}`, err);
                    });
                } catch (uploadError) {
                    console.error(`Error uploading image${i} to Cloudinary:`, uploadError);
                    
           
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Error removing temp file: ${file.path}`, err);
                    });
                    
                    return res.status(500).json({ 
                        error: `Error uploading image: ${uploadError.message}`,
                        details: uploadError.message 
                    });
                }
            }
        }

      
        newProduct.productImage = images.map(img => img.url); 
        const savedProduct = await newProduct.save();
        return res.status(200).json({ 
            success: true, 
            message: "Product added successfully",
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
        console.log('Image deletion result:', result);
        return result;
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        throw error;
    }
};

    //   listed Product 
    const listedProduct=async (req,res) => {
        try {

            const id=req.query.id;
            await Product.updateOne({_id:id},{$set:{isListed:true}})
            res.redirect("/admin/products")
        } catch (error) {
            res.redirect("/admin/pagenotFounderror");
        }
    }

    //   unlisted Product
    const unlistedProduct=async (req,res) => {
        try {

            const id=req.query.id;
            await Product.updateOne({_id:id},{$set:{isListed:false}})
            res.redirect("/admin/products");
        } catch (error) {
            res.redirect("/admin/pagenotFounderror");
        }
    }
    //  product editpage rendering
    const loadEditProduct=async(req,res)=>{
        try {
            const productId = req.params.id;
            const product = await Product.findById(productId);
        
            
            if (!product) {
                return res.status(404).json({error: 'Product not found' });
            }

            const brand = await Brand.find({ isListed: true, isDeleted: false });
            const category = await Category.find({ isListed: true, isDeleted: false });

            res.render('editProduct', { product, brand, category });

            
        }catch(error){
            res.redirect("/admin/pagenotFounderror")
        }
    }

    
    const editProduct = async (req, res) => {
        try {
            const { id } = req.params;
            const data = req.body;
    
            // Validate product ID
            if (!id.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({ success: false, message: 'Invalid product ID' });
            }
    
            // Define updated fields
            const updatedFields = {
                productName: data.productName ? data.productName.trim() : '',
                description: data.description || '',
                brand: data.brand || '',
                category: data.category || '',
                regularPrice: parseFloat(data.regularPrice) || 0,
                salePrice: parseFloat(data.salePrice) || 0,
                quantity: parseInt(data.quantity) || 0,
                productImage: [], // Will be populated with image URLs
                status: 'Available',
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
            };
    
            // Find the product
            const product = await Product.findById(id);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
    
            // Initialize productImage with existing images
            updatedFields.productImage = [...product.productImage];
    
            // Function to extract public_id from Cloudinary URL
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
    
            // Process new images
            for (let i = 1; i <= 4; i++) {
                if (req.files && req.files[`image${i}`] && req.files[`image${i}`][0]) {
                    const file = req.files[`image${i}`][0];
                    console.log(`Processing new image${i}:`, file.originalname);
    
                    // Delete old image from Cloudinary if it exists
                    if (product.productImage[i - 1]) {
                        const publicId = getPublicIdFromUrl(product.productImage[i - 1]);
                        if (publicId) {
                            try {
                                const deleteResult = await cloudinary.uploader.destroy(publicId);
                                console.log(`Deleted old image with public_id: ${publicId}`, deleteResult);
                            } catch (deleteError) {
                                console.error(`Failed to delete old image with public_id: ${publicId}`, deleteError);
                                // Continue to allow new upload
                            }
                        }
                    }
    
                    // Upload new image to Cloudinary
                    try {
                        const result = await cloudinary.uploader.upload(file.path, {
                            folder: 'Uploads',
                            resource_type: 'image',
                            quality: 'auto:good',
                            fetch_format: 'auto',
                            transformation: [{ width: 800, crop: "limit" }]
                        });
    
                        console.log(`Image${i} uploaded to Cloudinary:`, result.secure_url);
    
                        // Update productImage array with new image URL
                        updatedFields.productImage[i - 1] = result.secure_url;
    
                        // Remove temporary file
                        try {
                            await fs.unlink(file.path);
                            console.log(`Removed temporary file: ${file.path}`);
                        } catch (unlinkError) {
                            console.error(`Error removing temporary file: ${file.path}`, unlinkError);
                            // Continue processing, as file deletion failure shouldn't block update
                        }
                    } catch (uploadError) {
                        console.error(`Error uploading image${i} to Cloudinary:`, uploadError);
                        try {
                            await fs.unlink(file.path);
                            console.log(`Removed temporary file after upload error: ${file.path}`);
                        } catch (unlinkError) {
                            console.error(`Error removing temporary file after upload error: ${file.path}`, unlinkError);
                        }
                        return res.status(500).json({
                            success: false,
                            message: `Error uploading image${i}: ${uploadError.message}`
                        });
                    }
                }
            }
    
            // Filter out any empty or invalid image entries
            updatedFields.productImage = updatedFields.productImage.filter(url => url && typeof url === 'string');
    
            console.log('Updated fields:', updatedFields);
    
            // Update the product
            const updatedProduct = await Product.findByIdAndUpdate(id, updatedFields, { new: true });
    
            return res.status(200).json({ success: true, message: 'Product edited successfully', product: updatedProduct });
        } catch (error) {
            console.error('Error updating product:', error);
            return res.status(500).json({ success: false, message: 'Server error', error: error.message });
        }
    };
    
    const removeProductImage = async (req, res) => {
        try {
            const productId = req.params.productId;
            const imageIndex = parseFloat(req.params.imageIndex);
    
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }
            if (imageIndex < 0 || imageIndex >= product.productImage.length) {
                return res.status(400).json({ success: false, message: "Invalid image index" });
            }
            product.productImage.splice(imageIndex, 1);
            await product.save();
            
            res.json({ success: true, message: 'Image removed successfully', updatedImages: product.productImage });
        } catch (error) {
            console.error('Error removing product image:', error);
            res.status(500).json({ success: false, message: 'Server error occurred while removing image' });
        }
    };
    
    const deleteProductImage = async (req, res) => {
        try {
            const { imageIndex, productId } = req.body;
    
            const product = await Product.findById(productId);
            if (!product) {
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
    
            const index = parseInt(imageIndex);
            if (index < 0 || index >= product.productImage.length) {
                return res.status(400).json({ success: false, message: 'Invalid image index' });
            }
    
            const imageToDelete = product.productImage[index];
    
            const publicId = imageToDelete.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(publicId);
    
            product.productImage.splice(index, 1);
            await product.save();
    
            res.json({
                success: true,
                message: 'Image deleted successfully',
                updatedImages: product.productImage
            });
        } catch (error) {
            console.error('Error deleting product image:', error);
            res.status(500).json({ success: false, message: 'Error deleting image' });
        }
    };
    
    module.exports = { editProduct, removeProductImage, deleteProductImage };
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

module.exports={
    produtInfo,
    listedProduct,
    unlistedProduct,
    addProducts,
    editProduct,
    loadaddProduct,
    loadEditProduct,
    removeProductImage,
    deleteProductImage,
    deleteProduct
}
