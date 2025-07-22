const Product = require('../../models/productSchema');
const Wishlist = require('../../models/wishlistSchema');
const Category = require('../../models/categorySchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const { applyBestOffer } = require('../../helpers/offerHelper');
const mongoose = require('mongoose');

// Product view page
const productViewPage = async (req, res) => {
    try {
        let userId = req.session.user;
        let wishlistProductIds = [];
        let cartQuantity = 0; 
        let userData = null;
        const productId = req.query.id;

        if (userId && typeof userId === 'object' && userId._id) {
            userId = userId._id; 
        }

        
        if (userId) {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                console.error('Invalid userId:', userId);
                return res.redirect('/pageNotFound');
            }
            userData = await User.findOne({ _id: userId }).lean();
            if (!userData) {
                console.error('User not found for ID:', userId);
                return res.redirect('/pageNotFound');
            }

            // Fetch wishlist
            const wishlist = await Wishlist.findOne({ userId: userId });
            if (wishlist) {
                wishlistProductIds = wishlist.products.map(item => item.productId.toString());
            }

        
            const cart = await Cart.findOne({ userId: userId });
            if (cart) {
            
                const cartItem = cart.items.find(item => item.productId.toString() === productId);
                cartQuantity = cartItem ? cartItem.quantity : 0;
              
            }
        }

        
        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            error('Invalid or missing productId:', productId);
            return res.redirect('/pageNotFound');
        }

        const product = await Product.findById(productId).populate('category').lean();
        if (!product) {
            console.error('Product not found for ID:', productId);
            return res.redirect('/pageNotFound');
        }

        const findCategory = product.category;
        const updatedProduct = await applyBestOffer(product);

  
        const similarProducts = await Product.find({
            category: findCategory ? findCategory._id : null,
            _id: { $ne: product._id },
            isDeleted: false,
            isListed: true
        }).lean();
        const applyOffSimilarProducts = await Promise.all(similarProducts.map(p => applyBestOffer(p)));

        res.render('productViewPage', {
            user: userData,
            product: updatedProduct,
            quantity: product.quantity,
            cartQuantity: cartQuantity,
            category: findCategory,
            applyoffsimilerProducts: applyOffSimilarProducts,
            wishlistProductIds
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.redirect('/pageNotFound');
    }
};

module.exports = {
    productViewPage,
};