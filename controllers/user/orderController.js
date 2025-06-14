const Order=require("../../models/orderSchema")
const User=require("../../models/userSchema")
const Address=require("../../models/addressSchema")
const Cart=require("../../models/cartSchema")
const Wishlist=require("../../models/wishlistSchema")
const Product=require("../../models/productSchema")

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
  const placeOrder = async (req, res) => {
      try {
          const userId = req.session.user;
          const { addressId, paymentMethod } = req.body;
          if (!addressId || !paymentMethod) {
              console.error("Missing addressId or paymentMethod:", { addressId, paymentMethod });
              return res.status(400).json({
                  success: false,
                  message: { title: "Invalid Input", text: "Please select an address and payment method.", icon: "warning" },
              });
          }

          const validPaymentMethods = ["Cash on Delivery"];
          if (!validPaymentMethods.includes(paymentMethod)) {
              console.error("Invalid payment method:", paymentMethod);
              return res.status(400).json({
                  success: false,
                  message: { title: "Invalid Payment Method", text: "Selected payment method is not supported.", icon: "warning" },
              });
          }

          const cart = await Cart.findOne({ userId }).populate("items.productId");
          if (!cart || cart.items.length === 0) {
              console.error("Cart is empty or not found for userId:", userId);
              return res.status(400).json({
                  success: false,
                  message: { title: "Empty Cart", text: "Your cart is empty.", icon: "warning" },
              });
          }

     
          const totalPrice = cart.items.reduce((sum, item) => sum + item.productId.salePrice * item.quantity, 0);

      const selectedAddress= await Address.findOne(
    { userId, "address._id":addressId },
    { "address.$": 1 } 
  );

          if (!selectedAddress) {
              console.error("Address not found for addressId:", addressId);
              return res.status(400).json({
                  success: false,
                  message: { title: "Invalid Address", text: "The selected address does not exist.", icon: "warning" },
              });
          }
 

      
          const orderItems = cart.items.map((item) => ({
              product: item.productId._id,
              quantity: item.quantity,
              price: item.productId.salePrice,
          }));

          const discount = 0;
          const finalAmount = totalPrice - discount;
          const addr = selectedAddress.address[0]; 


          
          const order = new Order({
              userId,
              orderedItems: orderItems,
              totalPrice,
              discount,
              finalAmount,
              shippingAddress: addr,
              paymentMethod,
              invoiceDate: new Date(),
              status: "Pending",
          });

          const savedOrder = await order.save();

          await Cart.updateOne({ userId }, { $set: { items: [] } });

          // Clear wishlist (if applicable)
          const wishlist = await Wishlist.findOne({ userId });
          console.log("wishlist",wishlist)
          if (wishlist) {
              await Wishlist.updateOne({ userId }, { $set: { items: [] } });
              console.log("Wishlist cleared for userId:", userId);
          }

          res.status(200).json({
              success: true,
              orderId: savedOrder._id,
              message: { title: "Success", text: "Order placed successfully!", icon: "success" },
          });
      } catch (error) {
          console.error("Place order error:", error.stack);
          res.status(500).json({
              success: false,
              message: { title: "Error", text: "Failed to place order. Please try again.", icon: "error" },
          });
      }
  };

    const getViewOrderpage = async (req, res) => {
    try {
        const userId = req.session.user;

        const page = parseInt(req.query.page) || 1; // current page
        const limit = 3; // number of orders per page
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ userId })
        .populate("orderedItems.product")
        .sort({ createdAt: -1 }) // recent first
        .skip(skip)
        .limit(limit);
        
        console.log(orders)
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

const getOrderViewPage=async (req,res) => {
    try {
        const userId=req.session.user
        const ordersid = req.params.orderId.trim();
        const userData = await User.findById(userId);
        const order = await Order.findById(ordersid ).populate("orderedItems.product");
        res.render("orderDetailpage",{user:userData,currentPage:"orderDetailpage",order})
    } catch (error) {
        console.error("page rendering error", error);
    res.redirect("/pageNotFound");
    }
}

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

      item.status = "Cancelled";

      const allCancelled = order.orderedItems.every(i => i.status === "Cancelled");
      if (allCancelled) {
        order.isCancelled = true;
        order.cancelReason = reason || "All items cancelled";
        order.additionalNote = details || "";
      }

    } else {
      const hasShippedOrDelivered = order.orderedItems.some(item =>
        ["Shipped", "Delivered"].includes(item.status)
      );

      if (hasShippedOrDelivered) {
        return res.status(400).json({
          success: false,
          message: "Cannot cancel full order — one or more items are already shipped or delivered"
        });
      }
      order.orderedItems.forEach(item => {
        item.status = "Cancelled";
      });

      order.isCancelled = true;
      order.cancelReason = reason;
      order.additionalNote = details;
    }

    await order.save();
    res.status(200).json({
      success: true,
      message: productId ? "Item cancelled successfully" : "Order cancelled successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const orderReturn = async (req, res) => {
  try {
    const { orderId, productId, reason, note } = req.body;
    console.log("ordersss",orderId,productId,reason,note)

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
    console.log("Return submit error", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};



module.exports={
    getOrderPage,
    placeOrder,
    getViewOrderpage,
    getOrderViewPage,
    cancelOrder,
    orderReturn
}