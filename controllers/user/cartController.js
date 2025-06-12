const Cart=require("../../models/cartSchema")
const Product=require("../../models/productSchema")
const User=require("../../models/userSchema")

const renderCartPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
    const cart = await Cart.findOne({ userId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.render("cartPage", {
        cart: [],
        message: "Cart is empty",
        user: userData
      });
    }

let updated = false;
cart.items = cart.items.filter(item => {
  const product = item.productId;
  
  if (!product || product.quantity === 0) {
    updated = true;
    return false; 
  }


  return true; 
});


    if (updated) {
      await cart.save(); 
    }

    res.render("cartPage", {
      cart: cart.items,
      message: null,
      user: userData
    });

  } catch (error) {
    console.error("cart page can't available", error);
    res.status(500).render("cartPage", {
      cartItems: [],
      message: "Something went wrong while loading your cart"
    });
  }
};


const addTocart = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Please login to add items to cart" 
      });
    }

    const { productId, price, quantity = 1 } = req.body;
    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
      isListed: true
    });

    if (!product) {
      return res.status(404).json({ 
        success: false, 
        message: "Product not found or unavailable" 
      });
    }

    if (product.quantity < quantity) {
      return res.status(400).json({ 
        success: false, 
        message: "Insufficient stock available" 
      });
    }
    if (quantity > product.quantity) {
    return res.json({
    success: false,
    message: `You requested ${quantity} for "${product.ame}", but only ${product.quantity} available.`,
  });
}


    let cart = await Cart.findOne({ userId: userId });

    if (cart) {
      const existingItemIndex = cart.items.findIndex(
        item => item.productId.toString() === productId
      );

      if (existingItemIndex > -1) {
        const newQuantity = cart.items[existingItemIndex].quantity + quantity;
        
        if (product.quantity < newQuantity) {
          return res.status(400).json({ 
            success: false, 
            message: "Cannot add more items. Stock limit reached" 
          });
        }

        cart.items[existingItemIndex].quantity = newQuantity;
        cart.items[existingItemIndex].totalPrice = product.salePrice * newQuantity;
      } else {
        // Add new item to cart
        const newItem = {
          productId: product._id,
          salePrice: product.salePrice,
          quantity: quantity,
          totalPrice: product.salePrice * quantity
        };
        cart.items.push(newItem);
      }
    } else {
      // Create new cart
      cart = new Cart({
        userId: userId,
        items: [{
          productId: product._id,
          price: product.regularPrice,
          salePrice: product.salePrice,
          quantity: quantity,
          totalPrice: product.salePrice * quantity
        }]
      });
    }

    await cart.save();

    res.status(200).json({ 
      success: true, 
      message: "Product added to cart successfully!" 
      
    });

  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server error. Please try again." 
    });
  }
};
const updateCartQuantity = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const item = cart.items.find(item => item.productId._id.toString() === productId);

    if (!item) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    const product = item.productId;

    if (product.quantity === 0) {
      return res.status(400).json({ message: "Product is out of stock" });
    }

// Important: Allow decrease, block only when increasing above stock
if (quantity > product.quantity) {
  // Only block if user is increasing beyond stock
  if (quantity > item.quantity) {
    return res.status(400).json({ message: `Only ${product.quantity} units available.` });
  }
}


    item.quantity = quantity;
    item.totalPrice = quantity * product.salePrice;

    await cart.save();

    const totalPrice = cart.items.reduce((sum, i) => sum + i.quantity * i.productId.salePrice, 0);

    res.json({
      message: "Quantity updated",
      newQuantity: item.quantity,
      productTotal: item.totalPrice,
      newTotalPrice: totalPrice
    });

  } catch (error) {
    console.error("Cart update error:", error);
    res.status(500).json({ message: "Server error. Try again." });
  }
};



const removeCartProduct = async (req, res) => {
  try {
    const userId = req.session.user;
    const { productId } = req.body;
    if (!userId) {
      return res.status(401).json({ message: 'Please login to remove items' });
    }
    if (!productId) {
      return res.status(400).json({ message: 'Product ID is required' });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => !item.productId.equals(productId));
    if (initialLength === cart.items.length) {
      return res.status(404).json({ message: 'Product not found in cart' });
    }

    await cart.save();
    const totalPrice = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

   
    res.status(200).json({
      message: 'Item removed from cart',
      cart: {
        items: cart.items,
        totalItems: cart.items.length,
        totalPrice: totalPrice
      }
    });
  } catch (error) {
    console.error('Error removing item:', error);
    res.status(500).json({ message: 'Server error removing item' });
  }
};
module.exports={
    renderCartPage,
    addTocart,
    removeCartProduct,
    updateCartQuantity
}