const Wishlist=require("../../models/wishlistSchema")
const User=require("../../models/userSchema")
const Cart=require("../../models/cartSchema")
const Product=require("../../models/productSchema")

const getWishlistPage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).redirect('/login'); 
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 4; 
    const skip = (page - 1) * limit; 

    const wishlist = await Wishlist.findOne({ userId })
      .populate({
        path: 'products.productId',
        populate: {
          path: 'brand',
          model: 'Brand'
        }
      })
      .lean(); 

    let products = [];
    let totalItems = 0;

    if (wishlist && wishlist.products) {
      totalItems = wishlist.products.length; 
      products = wishlist.products.slice(skip, skip + limit); 
    }

    const totalPages = Math.ceil(totalItems / limit);
    const userData = await User.findById(userId).lean();
    res.render('wishlist', {
      wishlist: { products }, 
      currentPage: page,
      totalPages,
      totalItems,
      user:userData
    });
  } catch (error) {
    console.error('Wishlist page rendering error:', error);
    res.redirect('/pageNotFound');
  }
};



const addWishlist=async (req,res) => {
    try {
        const userId=req.session.user
        const productId=req.body.productId
        let wishlist=await Wishlist.findOne({userId})

        if(!wishlist){
            wishlist=new Wishlist({
                userId,
                products:[{productId}]
            })
        }else{
            const exist=wishlist.products.some(item=>
                item.productId.toString()===productId
            )

            if(!exist){
                wishlist.products.push({productId})
            }else{
                return res.status(404).json({success:false,message:"Product already in wishlist"})
            }
        }
    
    const addwishlist=await wishlist.save()

    if(addWishlist){
        return res.status(200).json({success:true,message:"Product Added in wishlist"})
    }

    } catch (error) {
        console.error("product adding wishlist error",error)
    }
}
const deleteWishlistProduct = async (req, res) => {
  try {
    
    if (!req.session.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Please log in' });
    }

    const userId = req.session.user;
    const productId = req.params.productId;
    const wishlist = await Wishlist.findOne({ userId });
    console.log('Wishlist:', wishlist);

    if (!wishlist || !wishlist.products.some(p => p.productId.toString() === productId)) {
      return res.status(404).json({ success: false, message: 'Product not found in wishlist' });
    }

    const result = await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId } } }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ success: false, message: 'Failed to remove product from wishlist' });
    }

    // Fetch updated wishlist for response
    const updatedWishlist = await Wishlist.findOne({ userId }).populate('products.productId');
    res.json({
      success: true,
      message: 'Product removed from wishlist',
      wishlist: updatedWishlist
    });
  } catch (error) {
    console.error('Error removing product from wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error: Unable to remove product' });
  }
};


const addToCartFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user;
    const productId=req.params.productId
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Please log in' });
    }

    // Fetch product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Check stock and listing
    if (product.quantity === 0 || !product.isListed) {
      return res.status(400).json({ success: false, message: 'Product is out of stock or not available' });
    }

    const salePrice = product.salePrice || product.price;
    const totalPrice = salePrice * 1;

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({
        userId,
        items: [{ productId, quantity: 1, salePrice, totalPrice }]
      });
    } else {
      const existingItem = cart.items.find(item => item.productId.equals(productId));
      if (existingItem) {
        existingItem.quantity += 1;
        existingItem.totalPrice = existingItem.quantity * existingItem.salePrice;
      } else {
        cart.items.push({ productId, quantity: 1, salePrice, totalPrice });
      }
    }

    await cart.save();

    // Remove from wishlist (corrected to match schema)
    const wishlistResult = await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId}} }
    );

    if (wishlistResult.modifiedCount === 0) {
      console.warn(`Product ${productId} not found in wishlist for user ${userId}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Product added to cart and removed from wishlist'
    });
  } catch (error) {
    console.error('Add to Cart from Wishlist failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error: Unable to add product to cart'
    });
  }
};


module.exports={
    getWishlistPage,
    addWishlist,
    deleteWishlistProduct,
    addToCartFromWishlist
}