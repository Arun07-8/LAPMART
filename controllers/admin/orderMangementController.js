const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const razorpay = require("../../config/razorpay");
const Wallet=require("../../models/walletSchema")
const crypto = require('crypto');


function getmainOrderStatus(orderedItems) {
  if (!orderedItems || orderedItems.length === 0) return 'Pending';
  const statuses = orderedItems.map((item) => item.status);
  if (statuses.includes('Cancelled')) return 'Cancelled';
  if (statuses.includes('Pending')) return 'Pending';
  if (statuses.includes('Return Request')) return 'Return Request';
  if (statuses.includes('Returned')) return 'Returned';
  if (statuses.every((status) => status === 'Delivered')) return 'Delivered';
  return 'Processing';
}

const getOrderManagementPage = async (req, res) => {
    try {
 

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 4;
        const skip = (page - 1) * limit;

        // Build search query
        let query = {};
        
        // Search by multiple fields
        if (req.query.search && req.query.search.trim() !== '') {
            const searchTerm = req.query.search.trim();
            console.log("Search term:", searchTerm);

            try {
                // Create a regex that matches the term anywhere in the string
                const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                
                // Build the search query for multiple fields
                query.$or = [
                    { orderId: searchRegex },
                    { 'shippingAddress.name': searchRegex },
                    { 'shippingAddress.street': searchRegex },
                    { 'shippingAddress.city': searchRegex },
                    { 'shippingAddress.state': searchRegex }
                ];
            } catch (error) {
                console.error("Search regex error:", error);
                query.$or = [
                    { orderId: searchTerm },
                    { 'shippingAddress.name': searchTerm }
                ];
            }
        }

        // Filter by payment method
        if (req.query.paymentMethod && req.query.paymentMethod !== 'All') {
            query.paymentMethod = req.query.paymentMethod.toUpperCase();
        }

        // Filter by date range
        if (req.query.fromDate || req.query.toDate) {
            query.createdAt = {};
            if (req.query.fromDate) {
                const fromDate = new Date(req.query.fromDate);
                if (!isNaN(fromDate)) {
                    query.createdAt.$gte = new Date(fromDate.setHours(0, 0, 0, 0));
                }
            }
            if (req.query.toDate) {
                const toDate = new Date(req.query.toDate);
                if (!isNaN(toDate)) {
                    query.createdAt.$lte = new Date(toDate.setHours(23, 59, 59, 999));
                }
            }
        }

        // Filter by status
        if (req.query.status && req.query.status !== 'All Orders') {
            query['orderedItems.status'] = req.query.status;
        }

        console.log("Final query:", JSON.stringify(query, null, 2));

        // Get total count for pagination
        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch orders with pagination
        const orders = await Order.find(query)
            .populate({
                path: "userId",
                select: "name email address"
            })
            .populate({
                path: "orderedItems.product",
                select: "name"
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);



        // Add main status to each order
        orders.forEach(order => {
            order.mainStatus = getmainOrderStatus(order.orderedItems);
        });

        // If it's an AJAX request, send JSON response
        if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({
                orders,
                currentPage: page,
                totalPages,
                totalOrders,
                hasResults: orders.length > 0,
                searchQuery: req.query.search || ''
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
            status: req.query.status || 'All Orders',
            paymentMethod: req.query.paymentMethod || 'All'
        });

    } catch (error) {
        console.error("Error loading orders:", error);
        if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(500).json({ 
                error: 'Internal server error',
                message: 'Failed to load orders. Please try again.',
                details: error.message
            });
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
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }


    const item = order.orderedItems.find(
      (item) => item.product.toString() === productId
    );
    if (!item) {
      return res.status(404).json({ success: false, message: 'Product not found in order.' });
    }

    if (item.status === 'Returned') {
      return res.status(400).json({ success: false, message: 'Item already returned.' });
    }

    const refundAmount = item.price * item.quantity;

    const transactionId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 700000)}`;
    let wallet = await Wallet.findOne({ user: order.userId });

    if (!wallet) {
      wallet = new Wallet({
        user: order.userId,
        balance: refundAmount,
        transactions: [
          {
            amount: refundAmount,
            type: 'credit',
            description: `Refund for returned product ID in ${order.orderId}`,
            transactionId,
            status: 'success',
          },
        ],
      });
    } else {
      wallet.balance += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        description: 'Refund for returned product',
        transactionId,
        status: 'success',
      });
    }

    try {
      await wallet.save();
    } catch (err) {
      console.error('Wallet save error:', err.message);
      return res.status(500).json({ success: false, message: 'Could not process wallet refund.' });
    }
    item.status = 'Returned';
    item.isReturned = true;

    if (order.orderedItems.every((i) => i.status === 'Returned')) {
      order.status = 'Returned';
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Return accepted. Refund credited to wallet.',
    });

  } catch (error) {
    console.error('Accept return error:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
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