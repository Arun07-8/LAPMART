const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const User=require("../../models/userSchema")

//  checkout page getting
const checkOutpage = async (req, res) => {
  try {
    const userId = req.session.user;
    const existingCart=await Cart.findOne({userId}).populate('items.productId');
    const existingAddress = await Address.findOne({ userId})
    const userData = await User.findById(userId);
    res.render("checkOut", {
    user: userData,
    Address: existingAddress?.address || [] , 
    Cart:existingCart||[]
});

  } catch (error) {
    console.error("the checkout page is not loading error:", error);
    res.redirect("/pageNotFound");
  }
};

const checkoutHandler = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    for (const item of cart.items) {
      const product = item.productId;
      if (item.quantity > product.quantity) {
        return res.status(400).json({
          success: false,
          message: `${product.productName} has only ${product.quantity} units available. Please adjust your cart.`,
        });
      }
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during checkout",
    });
  }
};

  
module.exports={
    checkOutpage,
   checkoutHandler,

}