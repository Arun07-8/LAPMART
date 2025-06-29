const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Wallet = require("../../models/walletSchema")
const fs = require('fs');
const path = require('path');

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

    // Check if it's Razorpay order ID (starts with "order_")
    if (ordersid.startsWith("order_")) {
      order = await Order.findOne({ razorpayOrderId: ordersid }).populate("orderedItems.product");
    } else {
      order = await Order.findById(ordersid).populate("orderedItems.product");
    }

    if (!order) {
      return res.redirect("/pageNotFound");
    }

    // Offer & Coupon calculations
    let totalOriginal = 0;
    let totalFinal = 0;
    const orderedItemsWithOffers = [];

    for (const item of order.orderedItems) {
      const updatedProduct = await applyBestOffer(item.product); // Your function
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
    const { orderId, productId, reason, details } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (productId) {
      const item = order.orderedItems.find(
        (item) => item.product.toString() === productId
      );

      if (!item) {
        return res.status(404).json({ success: false, message: "Product not found in order" });
      }

      if (["Shipped", "Delivered"].includes(item.status)) {
        return res.status(400).json({
          success: false,
          message: "Cannot cancel item after it has been shipped or delivered"
        });
      }

      if (item.status === "Cancelled") {
        return res.status(400).json({ success: false, message: "Product already cancelled" });
      }

      // Cancel item
      item.status = "Cancelled";

      // Refund to wallet for Razorpay or Wallet payments
      if (["Razorpay", "Wallet"].includes(order.paymentMethod)) {
        const CancelAmount = order.totalPrice;
        const transactionId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 700000)}`;

        let wallet = await Wallet.findOne({ user: order.userId });

        if (!wallet) {
          wallet = new Wallet({
            user: order.userId,
            balance: CancelAmount,
            transactions: [
              {
                amount: CancelAmount,
                type: 'credit',
                description: `Refund for cancelled item in order ${order.orderId}`,
                transactionId,
                status: 'success',
              },
            ],
          });
        } else {
          wallet.balance += CancelAmount;
          wallet.transactions.push({
            amount: CancelAmount,
            type: 'credit',
            description: `Refund for cancelled item in order ${order.orderId}`,
            transactionId,
            status: 'success',
          });
        }

        await wallet.save();
      }

      // Check if all items are cancelled
      const allCancelled = order.orderedItems.every(i => i.status === "Cancelled");
      if (allCancelled) {
        order.isCancelled = true;
        order.cancelReason = reason || "All items cancelled";
        order.additionalNote = details || "";
      }

    } else {
      return res.status(400).json({ success: false, message: "Only item-level cancel is supported in this flow" });
    }

    await order.save();

    res.status(200).json({
      success: true,
      message: "Item cancelled successfully. Wallet credited if Razorpay or Wallet was used."
    });

  } catch (error) {
    console.error("Cancel Order Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
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
            "orderedItems.$.status": "Return Request",
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
    // Validate orderId
    if (!orderId) {
      console.error('No orderId provided');
      return res.status(400).json({ message: 'Order ID is required' });
    }

    // Fetch order with populated fields
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

    // Create invoices directory
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

    // Get file stats for proper headers
    const stats = await fs.promises.stat(outputPath);

    // Set proper headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice_${orderId}.pdf"`);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache');

    // Create read stream and pipe to response
    const readStream = fs.createReadStream(outputPath);
    
    readStream.on('error', (err) => {
      console.error('Read stream error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error reading invoice file' });
      }
    });

    readStream.on('end', async () => {
      // Clean up the file after streaming
      try {
        await fs.promises.unlink(outputPath);
      } catch (deleteErr) {
        console.error('Invoice auto-delete failed:', deleteErr.message);
      }
    });

    // Pipe the file to response
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