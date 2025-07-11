const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Wallet = require("../../models/walletSchema")
const fs = require('fs');
const path = require('path');
const Cart= require("../../models/cartSchema")

const { applyBestOffer } = require("../../helpers/offerHelper")
const generateInvoice=require("../../helpers/generateInvoice")

const getOrderPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const orderId = req.params.orderId;

    if (!userId) return res.redirect("/login");

    const userData = await User.findById(userId);
    if (!userData) return res.redirect("/login");

    const order = await Order.findById(orderId).populate("orderedItems.product");
    if (!order) return res.redirect("/pageNotFound");

    let totalOriginal = 0;
    let totalFinal = 0;

    const orderedItemsWithOffers = await Promise.all(
      order.orderedItems.map(async (item) => {
        const updatedProduct = await applyBestOffer(item.product);
        const quantity = item.quantity;

        const originalPrice = item.product.salePrice;
        const offerPrice = updatedProduct.finalPrice || originalPrice;

        const hasOffer = updatedProduct.offerLabel && offerPrice < originalPrice;

        const itemTotal = offerPrice * quantity;
        const savings = hasOffer ? (originalPrice - offerPrice) * quantity : 0;

        totalOriginal += originalPrice * quantity;
        totalFinal += itemTotal;

        return {
          product: updatedProduct,
          quantity,
          originalPrice,
          finalPrice: offerPrice,
          totalPrice: itemTotal,
          offerApplied: hasOffer ? updatedProduct.offerLabel : null,
          discountPercentage: hasOffer ? updatedProduct.offerPercentage : 0,
          displayPrice: offerPrice,
          displayTotal: itemTotal,
          displaySavings: hasOffer ? savings : "N/A",
          savings,
          hasOffer
        };
      })
    );

    const hasAnyOffer = orderedItemsWithOffers.some(item => item.hasOffer);

    const couponCode = order.couponCode || null;
    const discountAmount = order.discount || 0;


    const grandTotal = Math.max(totalFinal - discountAmount, 0);

    const totalSavings = totalOriginal - totalFinal;
    await Cart.findOneAndUpdate({ userId }, { items: [], totalPrice: 0 });

    res.render("Orderpage", {
      user: userData,
      order,
      orderedItems: orderedItemsWithOffers,
      totalOriginal,      
      totalFinal,         
      totalSavings,       
      hasAnyOffer,
      discountAmount,    
      couponCode,
      grandTotal          
    });

  } catch (error) {
    console.error("Order page error:", error);
    res.redirect("/pageNotFound");
  }
};


const getViewOrderpage = async (req, res) => {
  try {
    const userId = req.session.user;

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await Order.find({ userId })
      .populate("orderedItems.product")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const user = await User.findById(userId);

    const ordersWithOffers = [];

    for (const order of orders) {
      let totalOriginal = 0;
      let totalFinal = 0;
      const orderedItemsWithOffers = [];

      for (const item of order.orderedItems) {
        const updatedProduct = await applyBestOffer(item.product);
        const quantity = item.quantity;
        const originalPrice = item.product.salePrice;
        const offerPrice = updatedProduct.finalPrice || originalPrice;
        const hasOffer = updatedProduct.offerLabel && offerPrice < originalPrice;

        const itemTotal = offerPrice * quantity;
        const savings = hasOffer ? (originalPrice - offerPrice) * quantity : 0;

        totalOriginal += originalPrice * quantity;
        totalFinal += itemTotal;

        orderedItemsWithOffers.push({
          product: updatedProduct,
          quantity,
          originalPrice,
          finalPrice: offerPrice,
          totalPrice: itemTotal,
          offerApplied: hasOffer ? updatedProduct.offerLabel : null,
          discountPercentage: hasOffer ? updatedProduct.offerPercentage : 0,
          displayPrice: offerPrice,
          displayTotal: itemTotal,
          displaySavings: hasOffer ? savings : "N/A",
          savings,
          hasOffer,
          status: item.status,
          paymentStatus: item.paymentStatus || order.paymentStatus || 'pending',
        });
      }

      const couponCode = order.couponCode || null;
      const discountAmount = order.discount || 0;
      const grandTotal = Math.max(totalFinal - discountAmount, 0);
      const totalSavings = totalOriginal - totalFinal;

      ordersWithOffers.push({
        ...order.toObject(),
        orderedItems: orderedItemsWithOffers,
        totalOriginal,
        totalFinal,
        totalSavings,
        couponCode,
        discountAmount,
        grandTotal,
      });
    }

    res.render("ordersDetails", {
      user,
      orders: ordersWithOffers,
      currentPage: page,
      totalPages,
    });

  } catch (error) {
    console.error("Page rendering error:", error);
    res.redirect("/pageNotFound");
  }
};

const getOrderViewPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const ordersid = req.params.orderId.trim();
    const isRetry = req.query.retry === 'true';

    const userData = await User.findById(userId);

    let order;

    if (ordersid.startsWith("order_")) {
      order = await Order.findOne({ razorpayOrderId: ordersid }).populate("orderedItems.product");
    } else {
      order = await Order.findById(ordersid).populate("orderedItems.product");
    }

    if (!order) {
      return res.redirect("/pageNotFound");
    }

    let totalOriginal = 0;
    let totalFinal = 0;
    const orderedItemsWithOffers = [];

    for (const item of order.orderedItems) {

      const returnRejectNote=item.returnRejectNote

      const updatedProduct = await applyBestOffer(item.product);
      const quantity = item.quantity;
      const originalPrice = item.product.salePrice;
      const offerPrice = updatedProduct.finalPrice || originalPrice;
      const hasOffer = updatedProduct.offerLabel && offerPrice < originalPrice;

      const itemTotal = offerPrice * quantity;
      const savings = hasOffer ? (originalPrice - offerPrice) * quantity : 0;

      totalOriginal += originalPrice * quantity;
      totalFinal += itemTotal;

      orderedItemsWithOffers.push({
        product: updatedProduct,
        quantity,
        originalPrice,
        finalPrice: offerPrice,
        totalPrice: itemTotal,
        offerApplied: hasOffer ? updatedProduct.offerLabel : null,
        discountPercentage: hasOffer ? updatedProduct.offerPercentage : 0,
        displayPrice: offerPrice,
        displayTotal: itemTotal,
        displaySavings: hasOffer ? savings : "N/A",
        savings,
        hasOffer,
        status: item.status,
        paymentStatus: item.paymentStatus || order.paymentStatus || 'pending',
        returnRejectNote
      });
    }

    const couponCode = order.couponCode || null;
    const discountAmount = order.discount || 0;
    const grandTotal = Math.max(totalFinal - discountAmount, 0);
    const totalSavings = totalOriginal - totalFinal;

    res.render("orderDetailpage", {
      user: userData,
      currentPage: "orderDetailpage",
      order: {
        ...order.toObject(),
        orderedItems: orderedItemsWithOffers,
        totalOriginal,
        totalFinal,
        totalSavings,
        couponCode,
        discountAmount,
        grandTotal,
      },
      isRetry
    });

  } catch (error) {
    console.error("page rendering error", error);
    res.redirect("/pageNotFound");
  }
};



const cancelOrder = async (req, res) => {
  try {
    const { orderId, productIds, reason, details } = req.body;
  
    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" });
    }

    const order = await Order.findById(orderId).populate("orderedItems.product");
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (!order.orderedItems || order.orderedItems.length === 0) {
      return res.status(400).json({ success: false, message: "No items in the order" });
    }


   let productIdsArray = [];

if (Array.isArray(productIds)) {
  productIdsArray = productIds;
} else if (typeof productIds === "string") {
  productIdsArray = [productIds];
}


const isFullCancellation = productIdsArray.length === 0 || 
  (productIdsArray.length === order.orderedItems.length && 
   productIdsArray.every(id => order.orderedItems.some(item => item.product._id.toString() === id)));

if (isFullCancellation) {
  productIdsArray = order.orderedItems.map(item => item.product._id.toString());
}


    if (productIdsArray.length === 0) {
      return res.status(400).json({ success: false, message: "No products selected for cancellation" });
    }

   let totalRefundAmount = 0;
    const failedItems = [];
    let cancelledCount = 0;



    for (const productId of productIdsArray) {
      const item = order.orderedItems.find( item => item.product && item.product._id.toString() === productId);  
      if (!item) {
        failedItems.push({ productId, reason: "Product not found in order" });
        continue;
      }

      if (["Shipped", "Delivered", "Return Request", "Returned", "Return Rejected"].includes(item.status)) {
        failedItems.push({ productId, reason: `Cannot cancel: Item is ${item.status}` });
        continue;
      }

      if (item.status === "Cancelled") {
        failedItems.push({ productId, reason: "Already cancelled" });
        continue;
      }

let itemRefund=0
const itemSubtotal = item.originalPrice || 0;
const itemOfferDiscount = item.offerDiscount || 0;
const itemCouponDiscount = item.couponDiscount || 0;
if(!isFullCancellation){
   itemRefund = Math.max(0, itemSubtotal - itemOfferDiscount - itemCouponDiscount);
}else{
   itemRefund=order.finalAmount
}

      
      item.status = "Cancelled";
      item.cancelReason = reason || "No reason provided";
      item.additionalNote = details || "";
      if(!isFullCancellation){
      totalRefundAmount += itemRefund > 0 ? itemRefund : 0;
       cancelledCount++;
      }else{
        totalRefundAmount = itemRefund > 0 ? itemRefund : 0;
        cancelledCount++;
      }
    }

    if (["Razorpay", "Wallet"].includes(order.paymentMethod) && totalRefundAmount > 0 && order.paymentStatus === "success") {
      const transactionId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 700000)}`;
      let wallet = await Wallet.findOne({ user: order.userId });

      const transaction = {
        amount: totalRefundAmount,
        type: "credit",
        description: `Refund for cancelled items in order ${order.orderId}`,
        transactionId,
        status: "success",
      };

      if (!wallet) {
        wallet = new Wallet({
          user: order.userId,
          balance: totalRefundAmount,
          transactions: [transaction],
        });
      } else {
        wallet.balance += totalRefundAmount;
        wallet.transactions.push(transaction);
      }

      await wallet.save();
    }

 const allCancelled = order.orderedItems.every(item => item.status === "Cancelled");
if (allCancelled) {
  order.isCancelled = true;
  order.cancelReason = reason || "All items cancelled";
  order.additionalNote = details || "";
}


    await order.save()

    res.status(200).json({
      success: true,
      message: `Cancelled ${cancelledCount} product(s). Refund: ₹${totalRefundAmount.toFixed(2)}`,
      failedItems,
    });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};




const orderReturn = async (req, res) => {
  try {
    const { orderId, productId, reason, note } = req.body;


    if (productId) {
      await Order.updateOne(
        { _id: orderId, "orderedItems.product": productId },
        {
          $set: {
            "orderedItems.$.status": "Return Requested",
            "orderedItems.$.isReturned": true,
            "orderedItems.$.returnReason": reason,
            "orderedItems.$.returnNote": note
          }
        }

      );
    } else {
      await Order.findByIdAndUpdate(orderId, {
        isReturned: true,
        returnReason: reason,
        returnNote: note,
        "orderedItems.$[].status": "Return Request",
        "orderedItems.$[].isReturned": true,
      });
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.error("Return submit error", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



const downloadInvoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    if (!orderId) {
      console.error('No orderId provided');
      return res.status(400).json({ message: 'Order ID is required' });
    }


    const order = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('userId');

    if (!order) {
      console.error(`Order not found for ID: ${orderId}`);
      return res.status(404).json({ message: 'Order not found' });
    }

    if (!order.userId) {
      console.error(`User not found for order ID: ${orderId}`);
      return res.status(404).json({ message: 'User associated with order not found' });
    }

  
    const invoiceDir = path.join(__dirname, '../../public/invoices'); // Adjust path as needed
    await fs.promises.mkdir(invoiceDir, { recursive: true });

    const outputPath = path.join(invoiceDir, `invoice_${orderId}.pdf`);


    // Check if generateInvoice is a function
    if (typeof generateInvoice !== 'function') {
      console.error('generateInvoice is not a function. Type:', typeof generateInvoice);
      return res.status(500).json({ message: 'Invoice generation function not available' });
    }

    // Generate the invoice
    await generateInvoice(order, order.userId, outputPath);

    // Verify file exists
    try {
      await fs.promises.access(outputPath);
    } catch (err) {
      console.error('Invoice file access error:', err.message);
      return res.status(500).json({ message: 'Invoice file was not created properly' });
    }

  
    const stats = await fs.promises.stat(outputPath);

    // Set proper headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${orderId}.pdf"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache');

   
    const readStream = fs.createReadStream(outputPath);
    
    readStream.on('error', (err) => {
      console.error('Read stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error reading invoice file' });
      }
    });

    readStream.on('end', async () => {
      
      try {
        await fs.promises.unlink(outputPath);
      } catch (deleteErr) {
        console.error('Invoice auto-delete failed:', deleteErr.message);
      }
    });
    readStream.pipe(res);

  } catch (err) {
    console.error('Invoice download error:', err.message, err.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Could not generate invoice', 
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
      });
    }
  }
};



module.exports = {
  getOrderPage,
  getViewOrderpage,
  getOrderViewPage,
  cancelOrder,
  orderReturn,
  downloadInvoice
}