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
        console.log('req.body:', req.body);
        console.log('req.files:', req.files);

        // Access fields directly from req.body
        const {
            productName,
            description,
            brand,
            category,
            regularPrice,
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

        // Check if product already exists
        const productExist = await Product.findOne({
            productName: productName.trim(),
            isDeleted: false
        });

        console.log("test ====================")

        if (productExist) {
            return res.status(400).json({ error: 'Product already exists' });
        }

        // Validate images
        if (!req.files || req.files.length < 2 || req.files.length > 5) {
            return res.status(400).json({
                error: `Please upload between 2 and 5 images. Received: ${req.files ? req.files.length : 0}.`
            });
        }

        // Use Cloudinary URLs from req.files
        const images = req.files.map(file => ({
            url: file.path,
            public_id: file.filename
        }));

        // Create new product
        const newProduct = new Product({
            productName,
            description,
            brand,
            category,
            regularPrice: parseFloat(regularPrice),
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

module.exports = { addProducts };
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

            const id=req.params.id
            console.log(id);
            
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

            console.log(req.files,"files log");
            
    
            if (!id.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({ success: false, message: 'Invalid product ID' });
            }
    
            const updatedFields = {
                productName: data.productName ? data.productName.trim() : '',
                description: data.description || '',
                brand: data.brand || '',
                category: data.category || '',
                regularPrice: parseFloat(data.regularPrice) || 0,
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
                productImage: [] // Initialize to avoid undefined issues
            };
            const requiredFields = [
                'productName', 'description', 'brand', 'category', 'regularPrice', 
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

            // Use Cloudinary URLs from req.files
        const images = req.files.map(file => ({
            url: file.path,
            public_id: file.filename
        }));

        console.log("images",images);

        let destructedImage = images.map((img) => {
            console.log(img)
            return img.url  
        })

        console.log('desctructed Log: ', destructedImage)
        
    
            // IMPORTANT: Start with existing images
            updatedFields.productImage = [...product.productImage, ...destructedImage];
            console.log("Existing images:", updatedFields.productImage);
    
            // Process new images if they exist
            if (req.files && req.files.images) {
                // Handle single image or multiple images
                const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
                console.log(`Processing ${images.length} new images`);
    
                for (let i = 0; i < images.length; i++) {
                    const file = images[i];
                    console.log(`Processing image ${i + 1}: ${file.name}`);
    
                    try {
                        // Upload image to Cloudinary
                        const result = await new Promise((resolve, reject) => {
                            const uploadStream = cloudinary.uploader.upload_stream(
                                {
                                    folder: 'Uploads',
                                    resource_type: 'image',
                                    quality: 'auto:good',
                                    fetch_format: 'auto',
                                    transformation: [{ width: 800, crop: "limit" }]
                                },
                                (error, result) => {
                                    if (error) reject(error);
                                    else resolve(result);
                                }
                            );
                            
                            uploadStream.end(file.buffer);
                        });
    
                        console.log(`Image ${i + 1} uploaded to Cloudinary:`, result.secure_url);
                        updatedFields.productImage.push(result.secure_url);
                    } catch (uploadError) {
                        console.error(`Error uploading image ${i + 1} to Cloudinary:`, uploadError);
                        return res.status(500).json({
                            success: false,
                            message: `Error uploading image ${i + 1}: ${uploadError.message}`
                        });
                    }
                }
            }
    
            // Validate total image count after all operations
            if (updatedFields.productImage.length < 2) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Minimum 2 images required' 
                });
            }
            if (updatedFields.productImage.length > 5) {
                updatedFields.productImage = updatedFields.productImage.slice(0, 5);
                console.log("Trimmed to maximum 5 images");
            }
    
            // Ensure no duplicate or invalid URLs
            updatedFields.productImage = [...new Set(updatedFields.productImage.filter(url => url && typeof url === 'string'))];
            console.log("Final image URLs:", updatedFields.productImage);
    
            // Update the product
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
            
            console.log(`Received delete request for product: ${productId}, index: ${imageIndex}`);
    
            // Validate productId
            if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error(`Invalid product ID: ${productId}`);
                return res.status(400).json({ success: false, message: 'Invalid product ID' });
            }
    
            // Validate imageIndex
            if (isNaN(imageIndex) || imageIndex < 0) {
                console.error(`Invalid image index: ${index}`);
                return res.status(400).json({ success: false, message: 'Invalid image index' });
            }
    
            // Find the product
            const product = await Product.findById(productId);
            if (!product) {
                console.error(`Product not found: ${productId}`);
                return res.status(404).json({ success: false, message: 'Product not found' });
            }
    
            // Check if index is valid
            if (imageIndex >= product.productImage.length) {
                console.error(`Image index out of bounds: ${imageIndex}, Length: ${product.productImage.length}`);
                return res.status(400).json({ success: false, message: 'Image index out of bounds' });
            }
    
            // Check minimum image requirement
            if (product.productImage.length <= 2) {
                console.error(`Cannot remove image: Minimum 2 images required. Current count: ${product.productImage.length}`);
                return res.status(400).json({ success: false, message: 'Cannot remove image: Minimum 2 images required' });
            }
    
            // Get the image URL to remove
            const imageUrl = product.productImage[imageIndex];
            console.log(`Removing image at index ${imageIndex}: ${imageUrl}`);
    
            // Extract public ID from Cloudinary URL
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
    
            // Delete from Cloudinary if possible
            const publicId = getPublicIdFromUrl(imageUrl);
            if (publicId) {
                try {
                    const deleteResult = await cloudinary.uploader.destroy(publicId);
                    console.log(`Deleted image with public_id: ${publicId}`, deleteResult);
                } catch (deleteError) {
                    console.error(`Failed to delete image with public_id: ${publicId}`, deleteError);
                    // Continue with removal even if Cloudinary deletion fails
                }
            }
    
            // Remove image from product array
            product.productImage.splice(imageIndex, 1);
            
            // Save the updated product
            const updatedProduct = await product.save();
            console.log(`Image removed successfully. Remaining images: ${updatedProduct.productImage.length}`);
    
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
    // const removeProductImage = async (req, res) => {
    //     try {
    //         const productId = req.params.productId;
    //         const imageIndex = parseInt(req.params.imageIndex); // Use parseInt
    
    //         // Validate inputs
    //         if (!productId.match(/^[0-9a-fA-F]{24}$/)) {
    //             console.error('Invalid productId:', productId);
    //             return res.status(400).json({ success: false, message: 'Invalid product ID' });
    //         }
    //         if (isNaN(imageIndex) || imageIndex < 0) {
    //             console.error('Invalid imageIndex:', imageIndex);
    //             return res.status(400).json({ success: false, message: 'Invalid image index' });
    //         }
    
    //         // Find the product
    //         const product = await Product.findById(productId);
    //         if (!product) {
    //             console.error('Product not found for ID:', productId);
    //             return res.status(404).json({ success: false, message: 'Product not found' });
    //         }
    
    //         // Validate image index
    //         if (imageIndex >= product.productImage.length) {
    //             console.error('Image index out of bounds:', imageIndex, 'Length:', product.productImage.length);
    //             return res.status(400).json({ success: false, message: 'Invalid image index' });
    //         }
    
    //         const imageToDelete = product.productImage[imageIndex];
    
    //         // Optional: Delete image from Cloudinary
    //         const getPublicIdFromUrl = (url) => {
    //             if (!url) return null;
    //             try {
    //                 const parts = url.split('/');
    //                 const uploadIndex = parts.indexOf('upload');
    //                 if (uploadIndex === -1) {
    //                     console.error('No "upload" segment in URL:', url);
    //                     return null;
    //                 }
    //                 const path = parts.slice(uploadIndex + 2).join('/').split('.')[0];
    //                 return path; // e.g., Uploads/filename
    //             } catch (error) {
    //                 console.error('Error parsing public_id from URL:', url, error);
    //                 return null;
    //             }
    //         };
    
    //         const publicId = getPublicIdFromUrl(imageToDelete);
    //         if (publicId) {
    //             try {
    //                 const deleteResult = await cloudinary.uploader.destroy(publicId);
    //                 console.log(`Deleted image with public_id: ${publicId}`, deleteResult);
    //             } catch (deleteError) {
    //                 console.error(`Failed to delete image with public_id: ${publicId}`, deleteError);
    //                 // Continue to allow database update
    //             }
    //         } else {
    //             console.warn('No valid publicId extracted from URL:', imageToDelete);
    //         }
    
    //         // Remove image from product
    //         product.productImage.splice(imageIndex, 1);
    //         await product.save();
    
    //         console.log('Image removed successfully for product:', productId, 'Index:', imageIndex);
    //         res.json({
    //             success: true,
    //             message: 'Image removed successfully',
    //             updatedImages: product.productImage
    //         });
    //     } catch (error) {
    //         console.error('Error removing product image:', error);
    //         res.status(500).json({
    //             success: false,
    //             message: 'Server error occurred while removing image',
    //             error: error.message
    //         });
    //     }
    // };
    
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
