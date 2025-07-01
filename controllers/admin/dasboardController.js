// File: controllers/adminController.js (or wherever loadDashbard is defined)
const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");

const loadDashbard = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 4;
        const skip = (page - 1) * limit;
        const { timePeriod = "today", status = "all", startDate = "", endDate = "" } = req.query;


        const IST_OFFSET = 5.5 * 60 * 60 * 1000;
        const now = new Date();
        const nowUTC = new Date(now.getTime() - IST_OFFSET);
        let dateFilter = {};

        if (timePeriod) {
            if (timePeriod === "yesterday") {
                const yesterday = new Date(nowUTC);
                yesterday.setDate(nowUTC.getDate() - 1);
                dateFilter = {
                    createdAt: {
                        $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
                        $lte: new Date(yesterday.setHours(23, 59, 59, 999)),
                    },
                };
            } else if (timePeriod === "today") {
                dateFilter = {
                    createdAt: {
                        $gte: new Date(nowUTC.setHours(0, 0, 0, 0)),
                        $lte: new Date(nowUTC.setHours(23, 59, 59, 999)),
                    },
                };
            } else if (timePeriod === "last7days") {
                dateFilter = {
                    createdAt: {
                        $gte: new Date(nowUTC.setDate(nowUTC.getDate() - 7)),
                    },
                };
            } else if (timePeriod === "last30days") {
                dateFilter = {
                    createdAt: {
                        $gte: new Date(nowUTC.setDate(nowUTC.getDate() - 30)),
                    },
                };
            } else if (timePeriod === "thisyear") {
                dateFilter = {
                    createdAt: {
                        $gte: new Date(nowUTC.getFullYear(), 0, 1),
                    },
                };
            } else if (timePeriod === "custom" && startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                    throw new Error("Invalid date format");
                }
                if (start > end) {
                    throw new Error("Start date must be before end date");
                }
                const startUTC = new Date(start.getTime() - IST_OFFSET);
                const endUTC = new Date(end.getTime() - IST_OFFSET);
                dateFilter = {
                    createdAt: {
                        $gte: startUTC,
                        $lte: new Date(endUTC.setHours(23, 59, 59, 999)),
                    },
                };
            }
        }


        let statusFilter = {};
        if (status && status !== "all") {
            statusFilter = { "orderedItems.status": { $regex: `^${status}$`, $options: "i" } };
        }

        const query = { ...dateFilter, ...statusFilter };

      
        const orderData = await Order.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("userId", "name")
            .lean();

        const orderCount = await Order.countDocuments(query);
        const totalPages = Math.ceil(orderCount / limit);

        
        const userCount = await User.countDocuments();
        const productCount = await Product.countDocuments({ isDeleted: false });

       
        const totalRevenueResult = await Order.aggregate([
            { $match: query },
            { $unwind: "$orderedItems" },
            {
                $match: {
                    "orderedItems.isCancelled": false,
                    "orderedItems.isReturned": false,
                    $or: [
                        { paymentStatus: "success" },
                        {
                            paymentMethod: { $in: ["Cash on Delivery", "Razorpay", "Wallet"] },
                            "orderedItems.status": "Delivered",
                        },
                    ],
                },
            },
            {
                $group: {
                    _id: null,
                    revenue: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ["$orderedItems.finalPrice", 0] },
                                { $ifNull: ["$orderedItems.quantity", 0] },
                            ],
                        },
                    },
                },
            },
        ]);

        const totalRevenue = totalRevenueResult[0]?.revenue || 0;

       
const dateFormat = timePeriod === "today" || timePeriod === "yesterday" ? "%Y-%m-%d" : "%B";
const revenueData = await Order.aggregate([
    { $match: query },
    { $unwind: "$orderedItems" },
    {
        $match: {
            "orderedItems.isCancelled": false,
            "orderedItems.isReturned": false,
        },
    },
    {
        $group: {
            _id: {
                $dateToString: { format: dateFormat, date: "$createdAt" },
            },
            revenue: {
                $sum: {
                    $multiply: [
                        { $ifNull: ["$orderedItems.finalPrice", 0] },
                        { $ifNull: ["$orderedItems.quantity", 0] },
                    ],
                },
            },
            orderCount: { $sum: 1 },
        },
    },
   
    {
        $addFields: {
            monthIndex: {
                $cond: {
                    if: { $eq: [dateFormat, "%Y-%m-%d"] },
                    then: "$_id", 
                    else: {
                        $indexOfArray: [
                            [
                                "January", "February", "March", "April", "May", "June",
                                "July", "August", "September", "October", "November", "December"
                            ],
                            "$_id",
                        ],
                    },
                },
            },
        },
    },
    { $sort: { monthIndex: 1 } }, 
    { $project: { _id: 1, revenue: 1, orderCount: 1 } }, 
    { $limit: 12 }, 
]);
     
        const orderStatusData = await Order.aggregate([
            { $match: query },
            { $unwind: "$orderedItems" },
            {
                $group: {
                    _id: "$orderedItems.status",
                    count: { $sum: 1 },
                },
            },
        ]);

       
        const paymentMethodData = await Order.aggregate([
            { $match: query },
            {
                $group: {
                    _id: "$paymentMethod",
                    count: { $sum: 1 },
                },
            },
        ]);

        
        const topCategories = await Order.aggregate([
            { $match: query },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },
            {
                $group: {
                    _id: "$product.category",
                    totalSales: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ["$orderedItems.finalPrice", 0] },
                                { $ifNull: ["$orderedItems.quantity", 0] },
                            ],
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "categories",
                    localField: "_id",
                    foreignField: "_id",
                    as: "category",
                },
            },
            { $unwind: "$category" },
            {
                $project: {
                    categoryName: "$category.name",
                    totalSales: 1,
                },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 4 },
        ]);

      
        const topBrands = await Order.aggregate([
            { $match: query },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },
            {
                $group: {
                    _id: "$product.brand",
                    totalSales: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ["$orderedItems.finalPrice", 0] },
                                { $ifNull: ["$orderedItems.quantity", 0] },
                            ],
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "brands",
                    localField: "_id",
                    foreignField: "_id",
                    as: "brand",
                },
            },
            { $unwind: "$brand" },
            {
                $project: {
                    brandName: "$brand.name",
                    totalSales: 1,
                },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 4 },
        ]);

       
        const topSellingProducts = await Order.aggregate([
            { $match: query },
            { $unwind: "$orderedItems" },
            {
                $match: {
                    "orderedItems.isCancelled": false,
                    "orderedItems.isReturned": false,
                },
            },
            {
                $group: {
                    _id: "$orderedItems.product",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    totalSales: {
                        $sum: {
                            $multiply: [
                                { $ifNull: ["$orderedItems.finalPrice", 0] },
                                { $ifNull: ["$orderedItems.quantity", 0] },
                            ],
                        },
                    },
                },
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "product",
                },
            },
            { $unwind: "$product" },
            {
                $project: {
                    productName: "$product.productName",
                    totalQuantity: 1,
                    totalSales: 1,
                },
            },
            { $sort: { totalSales: -1 } },
            { $limit: 5 },
        ]);

        
        const recentOrders = await Order.find(query)
            .populate("userId", "name")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

       
        const responseData = {
            success: true,
            order: orderData,
            currentPage: page,
            totalPages,
            count: userCount,
            orderCount,
            totalRevenue,
            productCount,
            revenueData,
            orderStatusData,
            paymentMethodData,
            topCategories,
            topBrands,
            topSellingProducts,
            recentOrders,
            timePeriod,
            status,
            startDate,
            endDate,
        };

       
        if (
            !orderData.length &&
            !recentOrders.length &&
            !revenueData.length &&
            !orderStatusData.length
        ) {
            responseData.message = "No data found for the selected filters";
            responseData.orderCount = 0;
            responseData.totalRevenue = 0;
            responseData.totalPages = 0;
            responseData.revenueData = [];
            responseData.orderStatusData = [];
            responseData.paymentMethodData = [];
            responseData.topCategories = [];
            responseData.topBrands = [];
            responseData.topSellingProducts = [];
            responseData.recentOrders = [];
        }

        
        console.log("Revenue Data:", JSON.stringify(revenueData, null, 2));

        if (req.xhr || req.headers.accept.includes("json")) {
            return res.json(responseData);
        }

        res.render("dashBoard", responseData);
    } catch (error) {
        console.error("Error in loadDashbard:", error);
        if (req.xhr || req.headers.accept.includes("json")) {
            return res.status(400).json({ success: false, message: error.message || "Server error" });
        }
        res.redirect("/admin/pagenotFounderror");
    }
};

module.exports = {
    loadDashbard,
};