const razorpay = require("../../config/razorpay");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const { verifySignature } = require("../../helpers/razorpayUtils");

const createOrder = async (req, res) => {
  try {
    const { amount, addressId } = req.body;
    const userId = req.session.user;
    if (!amount || isNaN(amount) || amount <= 0) {
      console.error('Invalid amount:', amount);
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }
    if (!addressId) {
      console.error('Missing addressId');
      return res.status(400).json({ success: false, message: 'Address ID is required.' });
    }
    if (!userId) {
      console.error('No user ID in session');
      return res.status(400).json({ success: false, message: 'User not logged in.' });
    }
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "category" }, { path: "brand" }]
    });

    if (!cart || !cart.items.length) {
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }
    cart.items.forEach(item => {
      console.log({
        product: item.productId.name,
        productListed: item.productId.isListed,
        categoryListed: item.productId.category ? item.productId.category.isListed : 'No category',
        brandListed: item.productId.brand ? item.productId.brand.isListed : 'No brand',
      });
    });
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
    const address = await Address.findOne({ userId, 'address._id': addressId });
    if (!address) {
      return res.status(400).json({ success: false, message: 'Address not found.' });
    }
    const selectedAddress = address.address.find(addr => addr._id.toString() === addressId);
    if (!selectedAddress) {
      return res.status(400).json({ success: false, message: 'Selected address not found.' });
    }

    const orderedItems = cart.items.map(item => ({
      product: item.productId._id,
      quantity: item.quantity,
      price: item.salePrice || item.totalPrice / item.quantity,
    }));

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

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { addressId, userId },
    });

  
    const newOrder = new Order({
      userId,
      orderedItems,
      totalPrice: amount,
      finalAmount: amount,
      shippingAddress,
      paymentMethod: 'Razorpay',
      razorpayOrderId: razorpayOrder.id,
      status: 'Pending',
      invoiceDate: new Date(),
    });

    await newOrder.save();

    res.json({
      success: true,
      order: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
      },
      key: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Create order error:', error.message, error.stack);
    res.status(500).json({
      success: false,
      message: `Failed to create order: ${error.message}`,
    });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      addressId,
    } = req.body;

    const isValidSignature = verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET
    );

    if (!isValidSignature) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature.' });
    }

    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { razorpayPaymentId: razorpay_payment_id, addressId, status: 'completed' },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    await Cart.findOneAndUpdate({ userId: order.userId }, { items: [], totalPrice: 0 });

    res.json({
      success: true,
      message: 'Payment verified successfully.',
      orderId: order._id,
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed. Please contact support.',
    });
  }
};



//  Cash on delivery
const createCODOrder = async (req, res) => {
  try {
    const { amount, addressId, paymentMethod } = req.body;
    const userId = req.session.user;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }
    if (!addressId) {
      return res.status(400).json({ success: false, message: 'Address ID is required.' });
    }
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in.' });
    }
    if (!paymentMethod || paymentMethod !== 'Cash on Delivery') {
      return res.status(400).json({ success: false, message: 'Invalid payment method.' });
    }

    // Fetch cart with nested category and brand for blocked product check
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      populate: [{ path: "category" }, { path: "brand" }]
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty.' });
    }

    // Check for blocked products
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

      product.quantity -= item.quantity;
      await product.save();

      orderedItems.push({
        product: product._id,
        quantity: item.quantity,
        price: product.salePrice,
      });
    }

    const totalPrice = cart.items.reduce((sum, item) => sum + item.productId.salePrice * item.quantity, 0);
    const discount = 0;
    const finalAmount = totalPrice - discount;

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
      discount,
      finalAmount,
      shippingAddress,
      paymentMethod,
      status: 'Pending',
      invoiceDate: new Date(),
    });

    await newOrder.save();

    await User.findByIdAndUpdate(userId, { $push: { orderHistory: newOrder._id } });

    await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });

    const orderedProductIds = cart.items.map(item => item.productId._id.toString());
    await Wishlist.updateOne({ userId }, { $pull: { products: { productId: { $in: orderedProductIds } } } });


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


//   payment failed

const paymentFailed=async (req,res) => {
  try {
    const userId=req.session.user
      const {
    errorCode,
    orderId,
    fullOrderId,
    paymentId,
    amount,
    status,
    reason
  } = req.query;
  const userData=await User.findById(userId)

   res.render('paymentFailed', {
    user:userData,
    errorCode,
    orderId,
    fullOrderId,
    paymentId,
    amount,
    status,
    reason,
    order:orderId,
  });
  } catch (error) {
    console.error("retry payement paoge is not working ")
    res.redirect("/pagenotFounderror")
  }
}

// Retry Payment
const  createRetryRazorpayOrder = async (req, res) => {
  const { orderId } = req.body;

  try {
    const existingOrder = await Order.findById(orderId);

    if (!existingOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: existingOrder.amount * 100,
      currency: "INR",
      receipt: `retry_${existingOrder._id}`,
    });

    res.json({
      success: true,
      order: razorpayOrder,
      localOrderId: existingOrder._id
    });
  } catch (err) {
    console.error("Retry Razorpay Order Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  createCODOrder,
  paymentFailed
};
