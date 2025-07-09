const Order = require("../../models/orderSchema")
const User = require("../../models/userSchema")
const Product=require("../../models/productSchema")
const { applyBestOffer } = require("../../helpers/offerHelper")
const Wallet=require("../../models/walletSchema")



function getmainOrderStatus(orderedItems) {
  if (!orderedItems || orderedItems.length === 0) return 'Pending';
  const statuses = orderedItems.map(item => item.status);
  if (statuses.every(status => status === 'Cancelled')) return 'Cancelled';
  if (statuses.includes('Return Request')) return 'Return Request';
  if (statuses.includes('Returned')) return 'Returned';
  if (statuses.includes('Shipped')) return 'Shipped';
  if (statuses.includes('Processing')) return 'Processing';
  if (statuses.includes('Pending')) return 'Pending';
  if (statuses.includes('Payment Failed')) return 'Payment Failed';
  if (statuses.every(status => status === 'Delivered')) return 'Delivered';
  return 'Processing'; 
}

const getOrderManagementPage = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 4;
        const skip = (page - 1) * limit;
        let query = {};
       
        if (req.query.search && req.query.search.trim() !== '') {
            const searchTerm = req.query.search.trim();
            try {
                const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
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


        if (req.query.paymentMethod && req.query.paymentMethod !== 'All') {
         
            query.paymentMethod = { $regex: `^${req.query.paymentMethod}$`, $options: 'i' };
        }

    
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


        if (req.query.status && req.query.status !== 'All Orders') {
            query['orderedItems.status'] = req.query.status;
        }


        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);


        const orders = await Order.find(query)
            .populate({
                path: "userId",
                select: "name email address"
            })
            .populate({
                path: "orderedItems.product",
                select: "name salePrice"
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Enrich orders with additional data
        const enrichedOrders = [];
        for (const order of orders) {
            order.mainStatus = getmainOrderStatus(order.orderedItems);
            let totalOriginal = 0;
            let totalFinal = 0;
            const orderedItemsWithOffers = [];

            for (const item of order.orderedItems) {
                const updatedProduct = await applyBestOffer(item.product);
                const quantity = item.quantity;
                const originalPrice = item.product.salePrice;
                const offerPrice = updatedProduct.finalPrice || originalPrice;

                const itemTotal = offerPrice * quantity;
                totalOriginal += originalPrice * quantity;
                totalFinal += itemTotal;

                orderedItemsWithOffers.push({
                    ...item.toObject(),
                    product: updatedProduct,
                    finalPrice: offerPrice,
                    totalPrice: itemTotal
                });
            }

            const discountAmount = order.discount || 0;
            const grandTotal = Math.max(totalFinal - discountAmount, 0);
            const totalSavings = totalOriginal - totalFinal;
            const orderObj = order.toObject();
            orderObj._id = order._id;
            orderObj.mainStatus = order.mainStatus;
            orderObj.orderedItems = orderedItemsWithOffers;
            orderObj.totalOriginal = totalOriginal;
            orderObj.totalFinal = totalFinal;
            orderObj.totalSavings = totalSavings;
            orderObj.discountAmount = discountAmount;
            orderObj.grandTotal = grandTotal;

            enrichedOrders.push(orderObj);
        }

        // Handle AJAX requests
        if (req.xhr || req.headers.accept?.includes('json') || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({
                orders: enrichedOrders,
                currentPage: page,
                totalPages,
                totalOrders,
                hasResults: enrichedOrders.length > 0,
                searchQuery: req.query.search || ''
            });
        }


        res.render("orderMangement", {
            orders: enrichedOrders,
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
};
const getOrderDetailspage = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId)
      .populate('orderedItems.product')
      .populate('userId');

    if (!order) return res.redirect('/admin/order-management');

    let totalOriginal = 0;
    let totalFinal = 0;
    const orderedItemsWithOffers = [];
    const returnRequestProduct = [];

    for (const item of order.orderedItems) {
      const updatedProduct = await applyBestOffer(item.product);
      const quantity = item.quantity;
      const originalPrice = item.product.salePrice;
      const offerPrice = updatedProduct.finalPrice || originalPrice;
      const itemTotal = offerPrice * quantity;

      totalOriginal += originalPrice * quantity;
      totalFinal += itemTotal;

      orderedItemsWithOffers.push({
        ...item.toObject(),
        product: updatedProduct,
        finalPrice: offerPrice,
        totalPrice: itemTotal
      });
    }

    const discountAmount = order.discount || 0;
    const totalOfferDiscount = totalOriginal - totalFinal;
    const grandTotal = Math.max(totalFinal - discountAmount, 0);


    for (const item of order.orderedItems) {
      if (item.status?.trim().toLowerCase() === 'return request') {
        const updatedProduct = await applyBestOffer(item.product); 
        const quantity = item.quantity;
        const offerPrice = updatedProduct.finalPrice || item.product.salePrice;
        const itemTotal = offerPrice * quantity;

        const proportionalDiscount = totalFinal > 0
          ? (itemTotal / totalFinal) * discountAmount
          : 0;

        const refundAmount = Math.max(itemTotal - proportionalDiscount, 0);

        returnRequestProduct.push({
          name: updatedProduct.productName,
          productImage: updatedProduct.productImage?.[0],
          productId: updatedProduct._id,
          quantity,
          refundAmount,
          returnReason: item.returnReason
        });
      }
    }

    const mainStatus = getmainOrderStatus(order.orderedItems);

    const orderData = order.toObject();
    orderData.orderedItems = orderedItemsWithOffers;
    orderData.totalOriginal = totalOriginal;
    orderData.totalOfferDiscount = totalOfferDiscount;
    orderData.discountAmount = discountAmount;
    orderData.grandTotal = grandTotal;
    orderData.mainStatus = mainStatus;

    res.render('orderViewpage', {
      order: orderData,
      returnRequestProduct: returnRequestProduct.length > 0 ? returnRequestProduct : null
    });

  } catch (error) {
    console.error('Error loading admin order details:', error);
    res.redirect('/admin/pagenotFounderror');
  }
};


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

    if(order.paymentStatus !== 'success' && order.paymentMethod !== 'Cash on Delivery'){
      return res.status(404).json({ success: false, message: 'Payment is not completed!' });
    }

    order.orderedItems.forEach(item => {
      item.status = newStatus;
    });
if (newStatus === 'Delivered' && order.paymentMethod === 'Cash on Delivery') {
      order.paymentStatus = 'success';
    }
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
    const userId = req.session.user;

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

    const product = await Product.findById(item.product);
    const offerAppliedProduct = await applyBestOffer(product);
    const finalPrice = offerAppliedProduct.finalPrice

    const quantity = item.quantity || 1;
    const itemTotal = finalPrice * quantity;

    const orderLevelDiscount = order.discount || 0;
    const refundAmount = Number(Math.max(itemTotal - orderLevelDiscount, 0).toFixed(2));



    const transactionId = `TXN_${Date.now()}_${Math.floor(100000 + Math.random() * 700000)}`;

    // Wallet handling
    let wallet = await Wallet.findOne({ user: order.userId });

    if (!wallet) {
      wallet = new Wallet({
        user: order.userId,
        balance: refundAmount,
        transactions: [
          {
            amount: refundAmount,
            type: 'credit',
            description: `Refund for returned product in order ${order.orderId}`,
            transactionId,
            status: 'success',
          },
        ],
      });
    } else {
      wallet.balance = Number(wallet.balance || 0) + refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
        type: 'credit',
        description: `Refund for returned product in order ${order.orderId}`,
        transactionId,
        status: 'success',
      });
    }

    try {
      await wallet.save();
      await User.findByIdAndUpdate(userId, { wallet: wallet._id });
    } catch (err) {
      console.error(' Wallet save error:', err.message);
      return res.status(500).json({ success: false, message: 'Could not process wallet refund.' });
    }


    item.status = 'Returned';
    item.isReturned = true;


    await Product.findByIdAndUpdate(item.product, {
      $inc: { quantity: item.quantity },
    });

   
    if (order.orderedItems.every((i) => i.status === 'Returned')) {
      order.status = 'Returned';
    }

    await order.save();

    return res.status(200).json({
      success: true,
      message: 'Return accepted. Refund credited to wallet and product restocked.',
    });

  } catch (error) {
    console.error(' Accept return error:', error.message);
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
    item.returnRejectNote = reason || 'No reason provided';
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