const razorpay = require("../../config/razorpay");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const mongoose = require('mongoose');
const { verifySignature } = require("../../helpers/razorpayUtils");
const { applyBestOffer}=require("../../helpers/offerHelper")
const Wallet=require("../../models/walletSchema")
const Coupon=require("../../models/couponSchema")



const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.session.user;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { userId }
    });

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount
      },
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Create Razorpay order error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating Razorpay order.' });
  }
};




const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      addressId,
      orderId,
      paymentFailed
    } = req.body;

    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in.' });
    }

 
    if (paymentFailed && orderId) {
      const failedOrder = await Order.findOne({ _id: orderId, userId });
      if (failedOrder) {
        failedOrder.paymentStatus = 'failed';
        failedOrder.status = 'Payment Failed';
        failedOrder.orderedItems.forEach(item => {
          item.paymentStatus = 'failed';
          item.status = 'Payment Failed';
        });
        await failedOrder.save();
        return res.json({ success: false, message: 'Payment failed. Order updated.', orderId });
      }
    }

    const isValidSignature = verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET
    );

    if (!isValidSignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed.', redirectUrl: `/payment-failed/${orderId}` });
    }

    // Retry payment success
    if (orderId) {
      const existingOrder = await Order.findOne({ _id: orderId, userId });
      if (!existingOrder) {
        return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
      }

      existingOrder.razorpayOrderId = razorpay_order_id;
      existingOrder.razorpayPaymentId = razorpay_payment_id;
      existingOrder.paymentStatus = 'success';
      existingOrder.status = 'Pending';
      existingOrder.orderedItems.forEach(item => {
        item.paymentStatus = 'success';
        item.status = 'Pending';
      });

      await existingOrder.save();
      await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });

      return res.json({
        success: true,
        message: 'Payment verified. Order updated.',
        orderId: existingOrder._id
      });
    }

    // New payment
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "category" }, { path: "brand" }]
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const blockedItems = cart.items.filter(item => {
      const p = item.productId;
      const categoryListed = p.category ? p.category.isListed : true;
      const brandListed = p.brand ? p.brand.isListed : true;
      return !p.isListed || !categoryListed || !brandListed;
    });

    if (blockedItems.length > 0) {
      const names = blockedItems.map(i => i.productId.name).join(', ');
      return res.status(403).json({
        success: false,
        message: `You cannot order these blocked products: ${names}`,
      });
    }

    const orderedItems = [];
    let totalPrice = 0;
    let offerPrice = 0;

    for (const item of cart.items) {
      const product = item.productId;

      const offer = await applyBestOffer(product) || {};
      const originalPrice = product.salePrice;
      const finalPrice = !isNaN(offer.finalPrice) ? offer.finalPrice : originalPrice;
      const offerDiscount = originalPrice - finalPrice;
      const subtotal = finalPrice * item.quantity;

      if (isNaN(finalPrice) || isNaN(offerDiscount) || isNaN(subtotal)) {
        return res.status(400).json({ success: false, message: `Invalid pricing for ${product.name}` });
      }

      orderedItems.push({
        product: product._id,
        quantity: item.quantity,
        originalPrice,
        finalPrice,
        offerDiscount,
        subtotal,
        status: 'Pending',
        paymentStatus: 'success'
      });

      totalPrice += originalPrice * item.quantity;
      offerPrice += offerDiscount * item.quantity;
    }

    const appliedCoupon = req.session.appliedCoupon;
    let discount = 0;
    let couponCode = null;

    if (appliedCoupon) {
      couponCode = appliedCoupon.code;
      const coupon = await Coupon.findOne({
        couponCode,
        isActive: true,
        isDeleted: false
      });

      if (
        coupon &&
        !coupon.usedBy.includes(userId) &&
        coupon.validFrom <= new Date() &&
        coupon.validUpto >= new Date() &&
        totalPrice >= coupon.minPurchase
      ) {
        discount = coupon.type === 'percentage'
          ? Math.floor((totalPrice * coupon.offerPrice) / 100)
          : coupon.offerPrice;

        if (discount > totalPrice) discount = totalPrice;

        await Coupon.updateOne(
          { _id: coupon._id },
          { $addToSet: { usedBy: userId } }
        );
      }
    }

    const finalAmount = totalPrice - offerPrice - discount;

    if (isNaN(finalAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid final amount calculation.' });
    }

    const addressData = await Address.findOne({ userId, 'address._id': addressId });
    const selectedAddress = addressData?.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: 'Address not found' });
    }

    const newOrder = new Order({
      userId,
      orderedItems,
      totalPrice,
      offerPrice, 
      discount,   
      finalAmount,
      couponApplied: !!appliedCoupon,
      couponCode,
      shippingAddress: selectedAddress,
      paymentMethod: 'Razorpay',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentStatus: 'success',
      status: 'Pending',
      invoiceDate: new Date(),
    });

    await newOrder.save();
    await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });
    req.session.appliedCoupon = null;

    res.json({
      success: true,
      message: 'Payment verified and order placed.',
      orderId: newOrder._id
    });

  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};




const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: "User not logged in." });
    }

    const existingOrder = await Order.findOne({ _id: orderId, userId });
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: "Order not found or unauthorized." });
    }

    if (existingOrder.paymentStatus !== "failed") {
      return res.status(400).json({ success: false, message: "Order is not in a failed payment state." });
    }

    const amount = existingOrder.finalAmount;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount in order." });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: { userId, orderId },
    });

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
      },
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Retry Razorpay order error:", error);
    res.status(500).json({ success: false, message: "Server error while creating retry payment." });
  }
};




// Cash on Delivery
const createCODOrder = async (req, res) => {
  try {
    const { amount, addressId, paymentMethod } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in.' });
    }
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }
    if (!addressId) {
      return res.status(400).json({ success: false, message: 'Address ID is required.' });
    }
    if (paymentMethod !== 'Cash on Delivery') {
      return res.status(400).json({ success: false, message: 'Invalid payment method.' });
    }

if (amount > 30000) {
  return res.status(400).json({
    success: false,
    message: 'Cash on Delivery is allowed only for orders up to ₹30,000.',
  });
}

    const user = await User.findById(userId).populate('wallet');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "category" }, { path: "brand" }]
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    const blockedItems = cart.items.filter(item => {
      const p = item.productId;
      const categoryListed = p.category ? p.category.isListed : true;
      const brandListed = p.brand ? p.brand.isListed : true;
      return !p.isListed || !categoryListed || !brandListed;
    });

    if (blockedItems.length > 0) {
      const names = blockedItems.map(i => i.productId.name).join(', ');
      return res.status(403).json({ success: false, message: `Blocked products: ${names}` });
    }

    const addressDoc = await Address.findOne({ userId, "address._id": addressId }, { "address.$": 1 });
    if (!addressDoc || !addressDoc.address || addressDoc.address.length === 0) {
      return res.status(400).json({ success: false, message: 'Selected address not found.' });
    }

    const selectedAddress = addressDoc.address[0];
    const orderedItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product) {
        return res.status(400).json({ success: false, message: `Product not found: ${item.productId.name}` });
      }

      if (product.quantity < item.quantity) {
        return res.status(400).json({ success: false, message: `${product.name} has only ${product.quantity} in stock.` });
      }
      const offer =await applyBestOffer(product) || {};
      const originalPrice = product.salePrice;
      const finalPrice = !isNaN(offer.finalPrice) ? offer.finalPrice : originalPrice;
      const offerDiscount = originalPrice - finalPrice;
      const subtotal = finalPrice * item.quantity;

      if (
        isNaN(finalPrice) || isNaN(offerDiscount) || isNaN(subtotal)
      ) {
        return res.status(400).json({ success: false, message: `Invalid pricing for product ${product.name}` });
      }

      product.quantity -= item.quantity;
      await product.save();

      orderedItems.push({
        product: product._id,
        quantity: item.quantity,
        originalPrice,
        finalPrice,
        offerDiscount,
        subtotal,
      });
    }

    const totalPrice = orderedItems.reduce((sum, item) => sum + (item.originalPrice * item.quantity), 0);
    const offerPrice = orderedItems.reduce((sum, item) => sum + (item.offerDiscount * item.quantity), 0);

    const appliedCoupon = req.session.appliedCoupon;
    let discount = 0;
    let couponCode = null;

    if (appliedCoupon) {
      couponCode = appliedCoupon.code;
      const coupon = await Coupon.findOne({
        couponCode,
        isActive: true,
        isDeleted: false
      });

      if (
        coupon &&
        !coupon.usedBy.includes(userId) &&
        coupon.validFrom <= new Date() &&
        coupon.validUpto >= new Date() &&
        totalPrice >= coupon.minPurchase
      ) {
        discount = coupon.type === 'percentage'
          ? Math.floor((totalPrice * coupon.offerPrice) / 100)
          : coupon.offerPrice;

        if (discount > totalPrice) discount = totalPrice;

        await Coupon.updateOne(
          { _id: coupon._id },
          { $addToSet: { usedBy: userId } }
        );
      }
    }

    const finalAmount = totalPrice - offerPrice - discount;

    if (isNaN(finalAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid final amount calculation.' });
    }

    const shippingAddress = {
      addressType: selectedAddress.addressType,
      name: selectedAddress.name,
      phone: selectedAddress.phone,
      altPhone: selectedAddress.altPhone || '',
      city: selectedAddress.city,
      state: selectedAddress.state,
      landmark: selectedAddress.landmark || '',
      pincode: selectedAddress.pincode,
      fullAddress: selectedAddress.fullAddress,
      isDefault: selectedAddress.isDefault || false,
    };

    const newOrder = new Order({
      userId,
      orderedItems,
      totalPrice,
      offerPrice,
      discount,
      finalAmount,
      couponApplied: !!appliedCoupon,
      couponCode,
      shippingAddress,
      paymentMethod,
      status: 'Pending',
      paymentStatus: 'pending',
      invoiceDate: new Date(),
    });

    await newOrder.save();


    if (user.firstOrder && user.referredBy) {
      let userWallet = await Wallet.findOne({ user: user._id });
      if (!userWallet) {
        userWallet = new Wallet({
          user: user._id,
          balance: 0,
          transactions: []
        });
      }

      if (!userWallet.transactions.some(t => t.description === "Referral bonus for first COD purchase")) {
        userWallet.balance += 100;
        userWallet.transactions.push({
          transactionId: new mongoose.Types.ObjectId().toString(),
          amount: 100,
          type: "credit",
          description: "Referral bonus for first COD purchase",
          status: "success",
          date: new Date()
        });
        await userWallet.save();
        user.wallet = userWallet._id;
      }

      const referrer = await User.findById(user.referredBy).populate('wallet');
      if (referrer) {
        let referrerWallet = await Wallet.findOne({ user: referrer._id });
        if (!referrerWallet) {
          referrerWallet = new Wallet({
            user: referrer._id,
            balance: 0,
            transactions: []
          });
        }

        if (!referrerWallet.transactions.some(t => t.description === `Referral bonus for ${user.name}'s first COD purchase`)) {
          referrerWallet.balance += 200;
          referrerWallet.transactions.push({
            transactionId: new mongoose.Types.ObjectId().toString(),
            amount: 200,
            type: "credit",
            description: `Referral bonus for ${user.name}'s first COD purchase`,
            status: "success",
            date: new Date()
          });
          await referrerWallet.save();
          referrer.wallet = referrerWallet._id;

          const referral = referrer.referralStatus.find(r => r.userId.toString() === user._id.toString());
          if (referral) {
            referral.status = "Completed";
          }
          await referrer.save();
        }
      }

      user.firstOrder = false;
      await user.save();
    }

    req.session.appliedCoupon = null;

    await User.findByIdAndUpdate(userId, { $push: { orderHistory: newOrder._id } });
    await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });

    const orderedProductIds = cart.items.map(item => item.productId._id.toString());
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId: { $in: orderedProductIds } } } }
    );

    res.status(200).json({
      success: true,
      orderId: newOrder._id,
      message: 'Order placed successfully!',
    });

  } catch (error) {
    console.error('Create COD order error:', error.message, error.stack);
    res.status(500).json({ success: false, message: 'Failed to place order. Please try again later.' });
  }
};





const walletPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(400).json({ success: false, message: 'Wallet not found' });
    }

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "category" }, { path: "brand" }]
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    const blockedItems = cart.items.filter(item => {
      const p = item.productId;
      const categoryListed = p.category?.isListed ?? true;
      const brandListed = p.brand?.isListed ?? true;
      return !p.isListed || !categoryListed || !brandListed;
    });

    if (blockedItems.length > 0) {
      const blockedNames = blockedItems.map(i => i.productId.name).join(', ');
      return res.status(403).json({ success: false, message: `Blocked items: ${blockedNames}` });
    }

    const addressDoc = await Address.findOne({ userId, "address._id": addressId }, { "address.$": 1 });
    if (!addressDoc || !addressDoc.address || addressDoc.address.length === 0) {
      return res.status(400).json({ success: false, message: 'Address not found' });
    }
    const selectedAddress = addressDoc.address[0];

    let totalPrice = 0;
    let offerPrice = 0;
    const orderedItems = [];

    for (const item of cart.items) {
      const product = await Product.findById(item.productId._id);
      if (!product || product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Out of stock: ${product?.name || 'Unknown Product'}`
        });
      }

      const offer = await applyBestOffer(product) || {};
      const originalPrice = product.salePrice;
      const finalPrice = !isNaN(offer.finalPrice) ? offer.finalPrice : originalPrice;
      const offerDiscount = originalPrice - finalPrice;
      const subtotal = finalPrice * item.quantity;

      product.quantity -= item.quantity;
      await product.save();

      orderedItems.push({
        product: product._id,
        quantity: item.quantity,
        originalPrice,
        finalPrice,
        offerDiscount,
        subtotal,
        status: 'Pending',
        paymentStatus: 'success'
      });

      totalPrice += originalPrice * item.quantity;
      offerPrice += offerDiscount * item.quantity;
    }

    const appliedCoupon = req.session.appliedCoupon;
    let discount = 0;
    let couponCode = null;

    if (appliedCoupon) {
      couponCode = appliedCoupon.code;

      const coupon = await Coupon.findOne({
        couponCode,
        isActive: true,
        isDeleted: false
      });

      if (
        coupon &&
        !coupon.usedBy.includes(userId) &&
        coupon.validFrom <= new Date() &&
        coupon.validUpto >= new Date() &&
        totalPrice >= coupon.minPurchase
      ) {
        discount = coupon.type === 'percentage'
          ? Math.floor((totalPrice * coupon.offerPrice) / 100)
          : coupon.offerPrice;

        if (discount > totalPrice) discount = totalPrice;

        await Coupon.updateOne({ _id: coupon._id }, { $addToSet: { usedBy: userId } });
      }
    }

    const finalAmount = totalPrice - offerPrice - discount;

    if (isNaN(finalAmount)) {
      return res.status(400).json({ success: false, message: 'Invalid final amount calculation' });
    }

    if (wallet.balance < finalAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    const shippingAddress = {
      addressType: selectedAddress.addressType,
      name: selectedAddress.name,
      phone: selectedAddress.phone,
      altPhone: selectedAddress.altPhone || '',
      city: selectedAddress.city,
      state: selectedAddress.state,
      landmark: selectedAddress.landmark || '',
      pincode: selectedAddress.pincode,
      fullAddress: selectedAddress.fullAddress,
      isDefault: selectedAddress.isDefault || false,
    };

    const newOrder = new Order({
      userId,
      orderedItems,
      totalPrice,
      offerPrice,
      discount,
      finalAmount,
      couponApplied: !!appliedCoupon,
      couponCode,
      shippingAddress,
      paymentMethod: 'Wallet',
      paymentStatus: 'success',
      status: 'Pending',
      invoiceDate: new Date(),
    });

    await newOrder.save();

    const transactionId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    wallet.balance -= finalAmount;
    wallet.transactions.push({
      type: 'debit',
      amount: finalAmount,
      description: `Wallet payment for Order ${newOrder._id}`,
      transactionId,
      date: new Date(),
      status: "success"
    });
    await wallet.save();
    await User.findByIdAndUpdate(userId, { wallet: wallet._id });
    await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });

    const orderedProductIds = cart.items.map(item => item.productId._id);
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId: { $in: orderedProductIds } } } }
    );

    await User.findByIdAndUpdate(userId, { $push: { orderHistory: newOrder._id } });
    req.session.appliedCoupon = null;

    return res.status(200).json({
      success: true,
      orderId: newOrder._id,
      message: 'Wallet order placed successfully',
    });

  } catch (error) {
    console.error('Wallet Payment Error:', error.message, error.stack);
    return res.status(500).json({ success: false, message: 'Failed to process wallet order' });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  createCODOrder,
   retryPayment ,
   walletPayment
};
