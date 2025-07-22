const Cart = require("../../models/cartSchema")
const Product = require("../../models/productSchema")
const User = require("../../models/userSchema")
const {applyBestOffer}=require("../../helpers/offerHelper")
const Wishlist=require("../../models/wishlistSchema")

  const renderCartPage = async (req, res) => {
    try {
      const userId = req.session.user;
      const userData = await User.findById(userId);
      const cart = await Cart.findOne({ userId }).populate("items.productId");

      if (!cart || cart.items.length === 0) {
        return res.render("cartPage", {
          cart: [],
          user: userData,
          totalDiscount: 0,
          message: "Cart is empty"
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

      // Apply offers
      let originalTotal = 0;
      let discountedTotal = 0;

      const cartWithOffers = await Promise.all(
        cart.items.map(async (item) => {
          const offerProduct = await applyBestOffer(item.productId);
          const salePrice = offerProduct.salePrice;
          const offerPrice = offerProduct.finalPrice || salePrice;

          originalTotal += salePrice * item.quantity;
          discountedTotal += offerPrice * item.quantity;

          return {
            ...item.toObject(),
            product: offerProduct,       
            productId: item.productId     
          };
        })
      );

      const totalDiscount = originalTotal - discountedTotal;

      return res.render("cartPage", {
        cart: cartWithOffers,
        user: userData,
        message: null,
        totalDiscount
      });

    } catch (error) {
      console.error("Cart page can't be loaded:", error);
    }
  };
const addTocart = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please login to add items to cart" });
    }

    const { productId, quantity } = req.body;

    if (!productId || !quantity || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: "Out of Stock" });
    }

    const product = await Product.findOne({
      _id: productId,
      isDeleted: false,
      isListed: true,
    }).populate('category').populate('brand');

    if (!product || !product.category?.isListed || !product.brand?.isListed) {
      return res.status(404).json({
        success: false,
        message: "Product not found or unavailable (blocked product, category, or brand)",
      });
    }

    const maximumQuantity = 5;

    const validateQuantity = (qty, availableStock) => {
      if (qty > availableStock) {
        return `Only ${availableStock} items available in stock`;
      }
      if (qty > maximumQuantity) {
        return `Maximum ${maximumQuantity} units per product allowed`;
      }
      return null;
    };

    let cart = await Cart.findOne({ userId }); 

 
    const session = await Cart.startSession();
    session.startTransaction();

    try {
      if (cart) {
        const existingItemIndex = cart.items.findIndex(
          (item) => item.productId.toString() === productId
        );

        if (existingItemIndex > -1) {
          const existingQty = cart.items[existingItemIndex].quantity;
          const newQty = existingQty + quantity;
          const stockError = validateQuantity(newQty, product.quantity);
          if (stockError) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: stockError });
          }

          cart.items[existingItemIndex].quantity = newQty;
          cart.items[existingItemIndex].totalPrice = product.salePrice * newQty;
        } else {
          const stockError = validateQuantity(quantity, product.quantity);
          if (stockError) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: stockError });
          }

          cart.items.push({
            productId: product._id,
            salePrice: product.salePrice,
            quantity,
            totalPrice: product.salePrice * quantity,
          });
        }
      } else {
        const stockError = validateQuantity(quantity, product.quantity);
        if (stockError) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ success: false, message: stockError });
        }

        cart = new Cart({
          userId,
          items: [{
            productId: product._id,
            salePrice: product.salePrice,
            quantity,
            totalPrice: product.salePrice * quantity,
          }],
        });
      }

  
      await cart.save({ session });

      await Wishlist.updateOne(
        { userId },
        { $pull: { products: { productId: product._id } } },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      res.status(200).json({ success: true, message: "Product added to cart successfully!" });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error; 
    }
  } catch (error) {
    console.error("Add to cart error:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again." });
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

    const maximumQuantity = 5;
      if (quantity > maximumQuantity) {
        return res.status(400).json({ success: false, message: `Maximum ${maximumQuantity} units per product allowed.` });
      }

    if (quantity > product.quantity) {
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
module.exports = {
  renderCartPage,
  addTocart,
  removeCartProduct,
  updateCartQuantity
}