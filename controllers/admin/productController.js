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

        const productData = await Product.find({isDeleted:true,
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
console.log(productData);

        const categories = await Category.find({ isListed: true, isDeleted: true });
        const brands = await Brand.find({ isListed: true, isDeleted: true });

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
// Fixed Product Controller with proper Cloudinary implementation

const loadaddProduct = async (req, res) => {
    try {
        // Changed isDeleted: true to isDeleted: false to fetch active records
        const categories = await Category.find({ isListed: true, isDeleted: true });
        const brands = await Brand.find({ isListed: true, isDeleted: true });
        const products = await Product.find({ isListed: true, isDeleted: true });
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
        
        // Changed isDeleted: true to isDeleted: false to check active products
        const productExist = await Product.findOne({
            productName: products.productName.trim(), 
            isDeleted:true
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
                    // Upload to Cloudinary with proper error handling
                    const result = await cloudinary.uploader.upload(file.path, {
                        folder: 'Uploads',
                        resource_type: 'image',
                        quality: 'auto:good', // Optimize quality
                        fetch_format: 'auto', // Auto-format based on browser
                        transformation: [
                            { width: 800, crop: "limit" } // Resize for better performance
                        ]
                    });
                    
                    console.log(`Image${i} uploaded to Cloudinary:`, result.secure_url);
                    
                    // Store both the public_id and secure_url for future reference
                    images.push({
                        url: result.secure_url,
                        public_id: result.public_id
                    });
                    
                    // Remove the temporary file after uploading
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Error removing temp file: ${file.path}`, err);
                    });
                } catch (uploadError) {
                    console.error(`Error uploading image${i} to Cloudinary:`, uploadError);
                    
                    // Clean up the temporary file even if upload fails
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

        // Store the image URLs in the product object
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

// Add a utility function to delete image from Cloudinary when needed
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

            const brand = await Brand.find({ isListed: true, isDeleted: true });
            const category = await Category.find({ isListed: true, isDeleted: true });

            res.render('editProduct', { product, brand, category });

            
        }catch(error){
            res.redirect("/admin/pagenotFounderror")
        }
    }

    //  edit  products
    const editProduct=async (req,res) => {
        try{
            const id=req.params.id;
            const existingProduct=await Product.findOne({
                productName:data.productName.trim(),
                _id:{$ne:id}
            })

            if(existingProduct){
                return res.status(400).json({error:"Product with  this name  already exists.Please try with another Name" })
            }
            

        const updatedfields={
            productName:data.productName.trim(),
            description:data.description,
            brand:data.brand,
            category:data.category,
            regularPrice: parseFloat(data.regularPrice),
            salePrice: parseFloat(data.salePrice),
            quantity: parseInt(data.quantity),
            productImage:[],
            status: 'Available',
            processor: data.processor || '',
            graphicsCard:data.graphicsCard || '',
            ram: data.ram || '',
            Storage: data.Storage || '',
            display: data.display || '',
            operatingSystem: data.operatingSystem || '',
            Battery: data.Battery || '',
            Weight: data.Weight || '',
            additionalFeatures: data.additionalFeatures || "",
            Warranty: data.Warranty ||""

        }
        const images = [];

        for (let i = 1; i <= 4; i++) {
            if (req.files[`image${i}`]) {
                const file = req.files[`image${i}`][0];
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: 'products'
                });
        
                images[i - 1] = result.secure_url;
        
                fs.unlinkSync(file.path);
            }
        }
        
        const product = await Product.findById(id);
        
        if (images.length > 0) {
            images.forEach((image, index) => {
                if (image) {
                    product.productImage[index] = image;
                }
            });
            updatedfields.productImage = product.productImage;
        }
        

        await Product.findByIdAndUpdate(id, updatedfields, { new: true });


        return  res.status(200).json({success:true,message:"product edited successfully"})
        }catch(error){
            console.error(error)
            res.redirect("/admin/pagenotFounderror")
        }
    }
    //  Remove the images

    const removeProductImage=async (req,res) => {
        try {

            const productId=req.params.productId;
            const imageIndex=parseFloat(req.params.imageIndex);

            const product=await Product.findById(productId);
            if(!product){
                return res.status(404).json({success:false,message:"Product not found"});
            }
            if(imageIndex<0||imageIndex>=product.productImage.length){
                return res.status(400).json({Success:false,message:"Invalid image index"});
            }
            product.productImage.splice(imageIndex,1);
            await prodcut.save();
            
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

            // Delete image from Cloudinary
            const publicId = imageToDelete.split('/').pop().split('.')[0]; // Assuming the URL structure is cloudinary.com/{folder}/{imageName}
            await cloudinary.uploader.destroy(publicId);

            // Remove the image from product
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
    //   soft delete product
    const deleteProduct=async(req,res) => {
        try{
        const id=req.params.id;
        const deletedProduct=await Product.findByIdAndUpdate(
            id,
            {isDeleted:false},
            {new:false},
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
