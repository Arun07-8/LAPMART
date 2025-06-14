const Order=require("../../models/orderSchema")


function getmainOrderStatus(orderedItems) {
  const statuses = orderedItems.map(item => item.status);

  if (statuses.every(status => status === "Cancelled")) {
    return "Cancelled";
  } else if (statuses.every(status => status === "Delivered")) {
    return "Delivered";
  } else if (statuses.includes("Pending")) {
    return "Pending";
  } else if (statuses.includes("Return Request")) {
    return "Return Request";
  } else if (statuses.includes("Returned")) {
    return "Returned";
  } else {
    return "Processing";
  }
}

const getOrderManagementPage = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 4;
        const skip = (page - 1) * limit;

        // Build search query
        let query = {};
        
        // Search by order ID or customer name
        if (req.query.search) {
            query.$or = [
                { orderId: { $regex: req.query.search, $options: 'i' } },
                { 'userId.name': { $regex: req.query.search, $options: 'i' } }
            ];
        }

        // Filter by date range
        if (req.query.fromDate && req.query.toDate) {
            query.createdAt = {
                $gte: new Date(req.query.fromDate),
                $lte: new Date(req.query.toDate + 'T23:59:59.999Z')
            };
        }

        // Filter by status
        if (req.query.status && req.query.status !== 'All Orders') {
            query['orderedItems.status'] = req.query.status;
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
            .populate("userId", "name email")
            .populate("orderedItems.product")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        orders.forEach(order => {
            order.mainStatus = getmainOrderStatus(order.orderedItems);
        });

        // If it's an AJAX request, send JSON response
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json({
                orders,
                currentPage: page,
                totalPages,
                totalOrders
            });
        }

        // For regular page load, render the view
        res.render("orderMangement", {
            orders,
            currentPage: page,
            totalPages,
            search: req.query.search || '',
            fromDate: req.query.fromDate || '',
            toDate: req.query.toDate || '',
            status: req.query.status || 'All Orders'
        });

    } catch (error) {
        console.error("Error loading orders:", error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Internal server error' });
        }
        res.redirect("/admin/pagenotFounderror");
    }
}

const getOrderDetailspage=async (req,res) => {
    try {
        const orderId=req.params.orderId
        const order=await Order.findById(orderId).populate("userId", "name").populate("orderedItems.product");
        if (!order) {
        return res.status(404).send("Order not found");
        }

        res.render("orderViewpage",{order})
    } catch (error) {
         console.error("Order detail load error:", error);
         res.redirect("/admin/pagenotFounderror");
    }
}

const updateStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { newStatus } = req.body;

    if (!newStatus) {
      return res.status(400).json({ success: false, message: 'New status is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }


    order.orderedItems.forEach(item => {
      item.status = newStatus;
    });

    await order.save();
  console.log("or",order)
    res.status(200).json({
      success: true,
      message: `Order status updated to "${newStatus}"`,
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

 const acceptReturn = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
  console.log(orderId,productId)
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = order.orderedItems.find(i => i.product.toString() === productId);
    if (!item) return res.status(404).json({ success: false, message: 'Product not found in order' });

    item.status = 'Returned';
    item.isReturned = true;

    await order.save();

    res.status(200).json({ success: true, message: 'Return accepted and updated in order' });

  } catch (err) {
    console.error("Return Accept Error:", err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};


const rejectReturn = async (req, res) => {
  try {
    const { orderId, productId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = order.orderedItems.find(i => i.product.toString() === productId);
    if (!item) return res.status(404).json({ success: false, message: 'Product not found in order' });

    item.status = 'Return Rejected';
    item.returnNote = reason || 'No reason provided';
    item.isReturned = false;

    await order.save();

    res.status(200).json({ success: true, message: 'Return rejected successfully' });
  } catch (err) {
    console.error("Reject Return Error:", err);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};
module.exports={
    getOrderManagementPage,
    getOrderDetailspage,
    updateStatus,
    acceptReturn,
     rejectReturn,
}