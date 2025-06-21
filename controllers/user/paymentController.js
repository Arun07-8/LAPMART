const razorpay = require("../../config/razorpay");
const Order = require("../../models/orderSchema");
const Address = require("../../models/addressSchema");
const Cart = require("../../models/cartSchema");
const User = require("../../models/userSchema");
const Wishlist = require("../../models/wishlistSchema");
const Product = require("../../models/productSchema");
const { verifySignature } = require("../../helpers/razorpayUtils");
const Wallet=require("../../models/walletSchema")

const createOrder = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.session.user;

    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount.' });
    }

    // Just create Razorpay order (no DB save here)
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
      cartItems,
      addressId,
      amount,
      orderId // Handle retry case
    } = req.body;

    const userId = req.session.user;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in.' });
    }

    // Verify Razorpay signature
    const isValidSignature = verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET
    );

    if (!isValidSignature) {
      console.error('Signature verification failed:', {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });
      return res.status(400).json({ success: false, message: 'Payment verification failed.' });
    }

    if (orderId) {
      // Handle retry payment
      const existingOrder = await Order.findOne({ _id: orderId, userId });
      if (!existingOrder) {
        return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
      }

      // Update existing order with new payment details
      existingOrder.razorpayOrderId = razorpay_order_id;
      existingOrder.razorpayPaymentId = razorpay_payment_id;
      existingOrder.paymentStatus = 'success';
      existingOrder.status = 'Pending';
      existingOrder.orderedItems.forEach(item => {
        item.paymentStatus = 'success';
        item.status = 'Pending';
      });

      await existingOrder.save();

      // Clear cart if needed
      await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });

      return res.json({
        success: true,
        message: 'Payment verified. Order updated.',
        orderId: existingOrder._id
      });
    } else {
      // Handle new order (existing logic)
      const addressData = await Address.findOne({ userId, 'address._id': addressId });
      const selectedAddress = addressData?.address.find(addr => addr._id.toString() === addressId);

      if (!selectedAddress) {
        return res.status(400).json({ success: false, message: 'Address not found.' });
      }

      const orderedItems = cartItems.map(item => ({
        product: item.productId._id,
        quantity: item.quantity,
        price: item.salePrice || item.totalPrice / item.quantity,
        status: 'Pending',
        paymentStatus: 'success'
      }));

      const newOrder = new Order({
        userId,
        orderedItems,
        totalPrice: amount,
        finalAmount: amount,
        shippingAddress: selectedAddress,
        paymentMethod: 'Razorpay',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        invoiceDate: new Date(),
      });

      await newOrder.save();
      await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });

      return res.json({
        success: true,
        message: 'Payment verified. Order placed.',
        orderId: newOrder._id
      });
    }
  } catch (error) {
    console.error('verifyPayment error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};
//  Cash on delivery
const createCODOrder = async (req, res) => {
  try {
    const { amount, addressId, paymentMethod } = req.body;
    const userId = req.session.user; 
    console.log(amount, addressId, paymentMethod)

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
      paymentStatus:"success",
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
    productId,
    paymentId,
    reason
  } = req.query;
  const userData=await User.findById(userId)
  const order = await Order.findOne(
  { 'orderedItems.product': productId },

);


  } catch (error) {
    console.error("retry payement paoge is not working ")
    res.redirect("/pagenotFounderror")
  }
}

const retryPayment = async (req, res) => {
  try {
    const { orderId } = req.body; 
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in.' });
    }


    const existingOrder = await Order.findOne({ _id: orderId, userId });
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    const amount = existingOrder.finalAmount; 
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount in order.' });
    }


    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), 
      currency: 'INR',
      receipt: `receipt_${Date.now()}`,
      notes: { userId, orderId }
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
    console.error('Retry Razorpay order error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating retry payment.' });
  }
};
const walletPayment = async (req, res) => {
  try {
    const userId = req.session.user;
    const { addressId, cartItems, amount } = req.body;
console.log(addressId, cartItems, amount)
    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    // Wallet check
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Validate address
    const addressDoc = await Address.findOne(
      { userId, "address._id": addressId },
      { "address.$": 1 }
    );
    if (!addressDoc || !addressDoc.address || addressDoc.address.length === 0) {
      return res.status(400).json({ success: false, message: 'Address not found' });
    }

    const selectedAddress = addressDoc.address[0];
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

    // Validate product stock
    const orderedItems = [];
    for (const item of cartItems) {
      const product = await Product.findById(item.productId);
      if (!product || product.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Out of stock: ${product?.name || 'Unknown Product'}`
        });
      }

      product.quantity -= item.quantity;
      await product.save();

      orderedItems.push({
        product: product._id,
        quantity: item.quantity,
        price: item.price,
        status: 'Pending',
        paymentStatus: 'success',
      });
    }

    // Create order
    const newOrder = new Order({
      userId,
      orderedItems,
      totalPrice: amount,
      discount: 0,
      finalAmount: amount,
      shippingAddress,
      paymentMethod: 'Wallet',
      paymentStatus: 'success',
      invoiceDate: new Date(),
    });

    await newOrder.save();

  
    const transactionId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 900000)}`;
    wallet.balance -= amount;
    wallet.transactions.push({
      type: 'debit',
      amount,
      description: `Wallet payment for Order ${newOrder._id}`,
      transactionId,
    });
    await wallet.save();

    await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });

  
    const orderedProductIds = cartItems.map(item => item.productId);
    await Wishlist.updateOne(
      { userId },
      { $pull: { products: { productId: { $in: orderedProductIds } } } }
    );

    // Add to user's order history
    await User.findByIdAndUpdate(userId, { $push: { orderHistory: newOrder._id } });

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
  paymentFailed,
   retryPayment ,
   walletPayment
};
