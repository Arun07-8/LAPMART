const Order=require("../../models/orderSchema")
const User=require("../../models/userSchema")
const Wallet=require("../../models/walletSchema")

const getOrderPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderid=req.params.orderId
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/login");
        }
        const order = await Order.findById(orderid).populate("orderedItems.product")
        res.render("Orderpage", {
            userData,
            order
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

        res.render("ordersDetails", {
        user,
        orders,
        currentPage:page,
        totalPages,
        });
    } catch (error) {
        console.error("page rendering error", error);
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

    res.render("orderDetailpage", {
      user: userData,
      currentPage: "orderDetailpage",
      order,
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
        console.log(CancelAmount,"a")
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



module.exports={
    getOrderPage,
    // placeOrder,
    getViewOrderpage,
    getOrderViewPage,
    cancelOrder,
    orderReturn
}