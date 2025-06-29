const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const User=require("../../models/userSchema")
const Wallet=require("../../models/walletSchema")
const {applyBestOffer}=require("../../helpers/offerHelper")
const Coupon=require("../../models/couponSchema")

const checkOutpage = async (req, res) => {
  try {
    const userId = req.session.user;
    if (!userId) {
      return res.redirect('/login?redirect=/checkout');
    }

    const existingCart = await Cart.findOne({ userId }).populate('items.productId');
    const existingAddress = await Address.findOne({ userId });
    const userData = await User.findById(userId);
    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      await Wallet.create({ user: userId, balance: 0, transactions: [] });
      wallet = await Wallet.findOne({ user: userId }); // <--- re-fetch
    }

    const addresses = existingAddress ? existingAddress.address : [];

    let totalPrice = 0;
    let totalSavings = 0;

    if (existingCart && existingCart.items) {
      for (const item of existingCart.items) {
        const product = item.productId;
        const quantity = item.quantity;
        const salePrice = item.salePrice;
        const updatedProduct = await applyBestOffer(product);
        const finalPrice = updatedProduct.finalPrice || updatedProduct.salePrice;

        item.finalPrice = finalPrice;

        const subtotal = finalPrice * quantity;
        const savings = (salePrice - finalPrice) * quantity;

        item.subtotal = subtotal;
        item.savings = savings;

        totalPrice += subtotal;
        totalSavings += savings;
      }
    }


    const appliedCoupon = req.session.appliedCoupon;
    let coupon = null;
    let discountAmount = 0;

    if (appliedCoupon?.code) {
      coupon = await Coupon.findOne({
        couponCode: appliedCoupon.code,
        isActive: true,
        isDeleted: false,
        validFrom: { $lte: new Date() },
        validUpto: { $gte: new Date() }
      });

      if (coupon && totalPrice >= coupon.minPurchase) {
        if (coupon.type === 'percentage') {
          discountAmount = Math.floor((totalPrice * coupon.offerPrice) / 100);
        } else if (coupon.type === 'fixed') {
          discountAmount = coupon.offerPrice;
        }

        if (discountAmount > totalPrice) {
          discountAmount = totalPrice;
        }
      }
    }

    const grandTotal = totalPrice - discountAmount;

    res.render("checkOut", {
      key_id: process.env.RAZORPAY_KEY_ID,
      user: userData,
      Address: addresses,
      wallet: wallet,
      Cart: {
        ...existingCart?.toObject(),
        items: existingCart.items.map(item => ({
          ...item.toObject(),
          finalPrice: item.finalPrice,
          subtotal: item.subtotal,
          savings: item.savings,
        })),
        totalPrice,
        totalSavings,
        discountAmount,
        grandTotal,
      },
      coupon: coupon,
    });

  } catch (error) {
    console.error("Checkout page error:", error);
    res.redirect("/pageNotFound");
  }
};



const checkoutHandler = async (req, res) => {
  try {
    const userId = req.session.user;
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "category" }, { path: "brand" }],
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const blockedItems = cart.items.filter(item => {
      const p = item.productId;
      return (!p.isListed ||(p.category && !p.category.isListed) ||(p.brand && !p.brand.isListed));
    });

    if (blockedItems.length > 0) {
      const names = blockedItems.map(i => i.productId.productName).join(", ");
      return res.status(403).json({
        success: false,
        message: `Blocked products in your cart: ${names} this product category/brand blocked`
      });
    }

    // Check for stock
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