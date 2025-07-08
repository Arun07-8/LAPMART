const Order = require("../../models/orderSchema"); // Adjust path to your Order schema
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const moment = require("moment");

    
const getSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;


        const ordersAggregate = await Order.aggregate([
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: "$_id",
                    orderId: { $first: "$orderId" },
                    createdAt: { $first: "$createdAt" },
                    orderedItems: { $push: "$orderedItems" },
                    totalPrice: { $first: "$totalPrice" },
                    discount: { $first: "$discount" },
                    finalAmount: { $first: "$finalAmount" },
                    paymentMethod: { $first: "$paymentMethod" },
                    couponApplied: { $first: "$couponApplied" },
                    shippingAddress: { $first: "$shippingAddress" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        // Count total orders
        const countAgg = await Order.aggregate([
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$_id" } },
            { $count: "total" }
        ]);
        const totalOrders = countAgg[0]?.total || 0;
        const totalPages = Math.ceil(totalOrders / limit);

        // Calculate summary
        let grossSales = 0;
        let totalDiscount = 0;
        let totalCoupons = 0;
        let netSales = 0;
        let totalReturns = 0;

        const deliveredOrders = await Order.find({ "orderedItems.status": { $in: ["Delivered", "Returned"] } }).lean();
        deliveredOrders.forEach(order => {
            const isReturned = order.orderedItems.some(item => item.status === "Returned");
            grossSales += parseFloat(order.totalPrice) || 0;
            totalDiscount += parseFloat(order.discount) || 0;
            totalCoupons += order.couponApplied ? parseFloat(order.discount) || 0 : 0;
            netSales += isReturned ? 0 : parseFloat(order.finalAmount) || 0;
            totalReturns += isReturned ? 1 : 0;
        });

        res.render("salesReport", {
            orders: ordersAggregate,
            summary: {
                grossSales: grossSales.toFixed(2),
                totalDiscount: totalDiscount.toFixed(2),
                totalCoupons: totalCoupons.toFixed(2),
                netSales: netSales.toFixed(2),
                totalOrders,
                totalReturns
            },
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error("Error in getSalesReport:", error);
        res.status(500).json({ success: false, error: `Server error: ${error.message}` });
    }
};

// Filter Sales Report
const filterSalesReport = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate, page = 1, limit = 10 } = req.body;
        const skip = (page - 1) * limit;
        let matchQuery = {};

        // Input validation
        if (search && typeof search !== "string") {
            return res.status(400).json({ success: false, error: "Invalid order ID search term" });
        }
        if (userSearch && typeof userSearch !== "string") {
            return res.status(400).json({ success: false, error: "Invalid user search term" });
        }
        if (paymentMethod && !["Razorpay", "Cash on Delivery", "Wallet"].includes(paymentMethod)) {
            return res.status(400).json({ success: false, error: "Invalid payment method" });
        }
        if (orderStatus && !["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Request", "Returned", "Return Rejected"].includes(orderStatus)) {
            return res.status(400).json({ success: false, error: "Invalid order status" });
        }

        // Build match query
        if (search && search.trim()) {
            matchQuery.orderId = { $regex: search.trim(), $options: "i" };
        }

        if (userSearch && userSearch.trim()) {
            matchQuery.$or = [
                { "shippingAddress.name": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.address": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.city": { $regex: userSearch.trim(), $options: "i" } }
            ];
        }

        if (paymentMethod) {
            matchQuery.paymentMethod = paymentMethod;
        }

        // Handle date filtering
        if (dateRange && dateRange !== "custom") {
            let start, end;
            const now = moment().utc(); // Use UTC to avoid timezone issues
            switch (dateRange) {
                case "today":
                    start = now.clone().startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "yesterday":
                    start = now.clone().subtract(1, "days").startOf("day").toDate();
                    end = now.clone().subtract(1, "days").endOf("day").toDate();
                    break;
                case "last7days":
                    start = now.clone().subtract(6, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "last30days":
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "thismonth":
                    start = now.clone().startOf("month").toDate();
                    end = now.clone().endOf("month").toDate();
                    break;
                case "lastmonth":
                    start = now.clone().subtract(1, "month").startOf("month").toDate();
                    end = now.clone().subtract(1, "month").endOf("month").toDate();
                    break;
                case "thisyear":
                    start = now.clone().startOf("year").toDate();
                    end = now.clone().endOf("year").toDate();
                    break;
                case "lastyear":
                    start = now.clone().subtract(1, "year").startOf("year").toDate();
                    end = now.clone().subtract(1, "year").endOf("year").toDate();
                    break;
                default:
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
            }
            matchQuery.createdAt = { $gte: start, $lte: end };
        } else if (dateRange === "custom" && (startDate || endDate)) {
            const dateFormat = "DD/MM/YYYY";
            if (startDate && !moment(startDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid start date format. Use DD/MM/YYYY." });
            }
            if (endDate && !moment(endDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid end date format. Use DD/MM/YYYY." });
            }

            if (startDate) {
                matchQuery.createdAt = matchQuery.createdAt || {};
                matchQuery.createdAt.$gte = moment(startDate, dateFormat).utc().startOf("day").toDate();
            }
            if (endDate) {
                matchQuery.createdAt = matchQuery.createdAt || {};
                matchQuery.createdAt.$lte = moment(endDate, dateFormat).utc().endOf("day").toDate();
            }
        }

        // Aggregate filtered orders
        const ordersAggregate = await Order.aggregate([
            { $match: matchQuery },
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: orderStatus ? { "orderedItems.status": orderStatus } : {} },
            {
                $group: {
                    _id: "$_id",
                    orderId: { $first: "$orderId" },
                    createdAt: { $first: "$createdAt" },
                    orderedItems: { $push: "$orderedItems" },
                    totalPrice: { $first: "$totalPrice" },
                    discount: { $first: "$discount" },
                    finalAmount: { $first: "$finalAmount" },
                    paymentMethod: { $first: "$paymentMethod" },
                    couponApplied: { $first: "$couponApplied" },
                    shippingAddress: { $first: "$shippingAddress" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);

        // Count total filtered orders
        const totalOrdersCount = await Order.aggregate([
            { $match: matchQuery },
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: orderStatus ? { "orderedItems.status": orderStatus } : {} },
            { $group: { _id: "$_id" } },
            { $count: "total" }
        ]);

        const totalCount = totalOrdersCount.length > 0 ? totalOrdersCount[0].total : 0;
        const totalPages = Math.ceil(totalCount / limit);

        // Calculate summary for filtered data
        let grossSales = 0;
        let totalDiscount = 0;
        let totalCoupons = 0;
        let netSales = 0;
        let totalReturns = 0;

        const filteredOrders = await Order.aggregate([
            { $match: matchQuery },
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: orderStatus ? { "orderedItems.status": orderStatus } : {} },
            {
                $group: {
                    _id: "$_id",
                    orderId: { $first: "$orderId" },
                    totalPrice: { $first: "$totalPrice" },
                    discount: { $first: "$discount" },
                    finalAmount: { $first: "$finalAmount" },
                    couponApplied: { $first: "$couponApplied" },
                    orderedItems: { $push: "$orderedItems" }
                }
            }
        ]);

        filteredOrders.forEach(order => {
            const isReturned = order.orderedItems.some(item => item.status === "Returned");
            grossSales += parseFloat(order.totalPrice) || 0;
            totalDiscount += parseFloat(order.discount) || 0;
            totalCoupons += order.couponApplied ? parseFloat(order.discount) || 0 : 0;
            netSales += isReturned ? 0 : parseFloat(order.finalAmount) || 0;
            totalReturns += isReturned ? 1 : 0;
        });

        res.json({
            success: true,
            orders: ordersAggregate,
            summary: {
                grossSales: grossSales.toFixed(2),
                totalDiscount: totalDiscount.toFixed(2),
                totalCoupons: totalCoupons.toFixed(2),
                netSales: netSales.toFixed(2),
                totalOrders: totalCount,
                totalReturns
            },
            totalPages,
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error("Error filtering sales report:", error);
        res.status(500).json({ success: false, error: `Server error while filtering sales report: ${error.message}` });
    }
};

// Export Sales Report as PDF
const exportSalesReportPDF = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate } = req.body;
        let matchQuery = {};

        // Build match query
        if (search && search.trim()) {
            matchQuery.orderId = { $regex: search.trim(), $options: "i" };
        }

        if (userSearch && userSearch.trim()) {
            matchQuery.$or = [
                { "shippingAddress.name": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.address": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.city": { $regex: userSearch.trim(), $options: "i" } }
            ];
        }

        if (paymentMethod) {
            matchQuery.paymentMethod = paymentMethod;
        }

        // Handle date filtering
        if (dateRange && dateRange !== "custom") {
            let start, end;
            const now = moment().utc(); // Use UTC to avoid timezone issues
            switch (dateRange) {
                case "today":
                    start = now.clone().startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "yesterday":
                    start = now.clone().subtract(1, "days").startOf("day").toDate();
                    end = now.clone().subtract(1, "days").endOf("day").toDate();
                    break;
                case "last7days":
                    start = now.clone().subtract(6, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "last30days":
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "thismonth":
                    start = now.clone().startOf("month").toDate();
                    end = now.clone().endOf("month").toDate();
                    break;
                case "lastmonth":
                    start = now.clone().subtract(1, "month").startOf("month").toDate();
                    end = now.clone().subtract(1, "month").endOf("month").toDate();
                    break;
                case "thisyear":
                    start = now.clone().startOf("year").toDate();
                    end = now.clone().endOf("year").toDate();
                    break;
                case "lastyear":
                    start = now.clone().subtract(1, "year").startOf("year").toDate();
                    end = now.clone().subtract(1, "year").endOf("year").toDate();
                    break;
                default:
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
            }
            matchQuery.createdAt = { $gte: start, $lte: end };
        } else if (dateRange === "custom" && (startDate || endDate)) {
            const dateFormat = "DD/MM/YYYY";
            if (startDate && !moment(startDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid start date format. Use DD/MM/YYYY." });
            }
            if (endDate && !moment(endDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid end date format. Use DD/MM/YYYY." });
            }

            if (startDate) {
                matchQuery.createdAt = matchQuery.createdAt || {};
                matchQuery.createdAt.$gte = moment(startDate, dateFormat).utc().startOf("day").toDate();
            }
            if (endDate) {
                matchQuery.createdAt = matchQuery.createdAt || {};
                matchQuery.createdAt.$lte = moment(endDate, dateFormat).utc().endOf("day").toDate();
            }
        }

        // Aggregate orders for export
        const ordersAggregate = await Order.aggregate([
            { $match: matchQuery },
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: orderStatus ? { "orderedItems.status": orderStatus } : {} },
            {
                $group: {
                    _id: "$_id",
                    orderId: { $first: "$orderId" },
                    createdAt: { $first: "$createdAt" },
                    orderedItems: { $push: "$orderedItems" },
                    totalPrice: { $first: "$totalPrice" },
                    discount: { $first: "$discount" },
                    finalAmount: { $first: "$finalAmount" },
                    paymentMethod: { $first: "$paymentMethod" },
                    couponApplied: { $first: "$couponApplied" },
                    shippingAddress: { $first: "$shippingAddress" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // Calculate summary
        let grossSales = 0;
        let totalDiscount = 0;
        let totalCoupons = 0;
        let netSales = 0;
        let totalReturns = 0;
        let totalOrders = ordersAggregate.length;
        let totalRefunds = 0;
        let avgOrderValue = 0;

        ordersAggregate.forEach(order => {
            const isReturned = order.orderedItems.some(item => item.status === "Returned");
            const isCancelled = order.orderedItems.some(item => item.status === "Cancelled");
            grossSales += parseFloat(order.totalPrice) || 0;
            totalDiscount += parseFloat(order.discount) || 0;
            totalCoupons += order.couponApplied ? parseFloat(order.discount) || 0 : 0;
            if (!isReturned && !isCancelled) {
                netSales += parseFloat(order.finalAmount) || 0;
            }
            if (isReturned) {
                totalReturns += 1;
                totalRefunds += parseFloat(order.finalAmount) || 0;
            }
        });

        avgOrderValue = totalOrders > 0 ? (netSales / totalOrders) : 0;

        const summary = {
            grossSales: grossSales.toFixed(2),
            totalDiscount: totalDiscount.toFixed(2),
            totalCoupons: totalCoupons.toFixed(2),
            netSales: netSales.toFixed(2),
            totalOrders,
            totalReturns,
            totalRefunds: totalRefunds.toFixed(2),
            avgOrderValue: avgOrderValue.toFixed(2),
            conversionRate: totalOrders > 0 ? ((totalOrders - totalReturns) / totalOrders * 100).toFixed(2) : 0
        };

        // Create PDF
        const doc = new PDFDocument({
            margin: 1,
            size: 'A4',
            layout: 'portrait',
            bufferPages: true
        });

        let buffers = [];
        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
            const pdfData = Buffer.concat(buffers);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", 'attachment; filename="sales_report.pdf"');
            res.send(pdfData);
        });

        const colors = {
            primary: '#2c3e50',
            secondary: '#3498db',
            accent: '#e74c3c',
            text: '#2c3e50',
            lightGray: '#ecf0f1',
            darkGray: '#95a5a6'
        };

        const fonts = {
            title: 'Helvetica-Bold',
            heading: 'Helvetica-Bold',
            body: 'Helvetica',
            small: 'Helvetica'
        };

        function drawBox(x, y, width, height, fillColor = null, strokeColor = null) {
            if (fillColor) {
                doc.rect(x, y, width, height).fill(fillColor);
            }
            if (strokeColor) {
                doc.rect(x, y, width, height).stroke(strokeColor);
            }
        }

        function addPageHeader() {
            drawBox(40, 40, doc.page.width - 80, 80, colors.primary);
            doc.font(fonts.title)
               .fontSize(24)
               .fillColor('white')
               .text("SALES REPORT", 60, 65, { align: 'center', width: doc.page.width - 120 });
            doc.font(fonts.body)
               .fontSize(12)
               .text(`Generated on: ${moment().format("DD MMMM YYYY, hh:mm A")}`, 60, 90, {
                   align: 'center',
                   width: doc.page.width - 120
               });
        }

        addPageHeader();

        // Add filters section
        let filterText = "";
        let hasFilters = false;
        if (dateRange && dateRange !== "custom") {
            filterText += dateRange.charAt(0).toUpperCase() + dateRange.slice(1).replace(/([A-Z])/g, ' $1');
            hasFilters = true;
        } else if (startDate || endDate) {
            filterText += `${startDate ? startDate : 'Any'} to ${endDate ? endDate : 'Any'}`;
            hasFilters = true;
        }

        const filters = [];
        if (search) filters.push(`Order ID: ${search}`);
        if (userSearch) filters.push(`Customer: ${userSearch}`);
        if (paymentMethod) filters.push(`Payment: ${paymentMethod}`);
        if (orderStatus) filters.push(`Status: ${orderStatus}`);

        if (hasFilters || filters.length > 0) {
            doc.moveDown(2);
            drawBox(40, doc.y, doc.page.width - 80, 40, colors.lightGray, colors.darkGray);
            doc.font(fonts.heading)
               .fontSize(12)
               .fillColor(colors.text)
               .text("REPORT FILTERS", 60, doc.y + 10);
            const allFilters = [filterText, ...filters].filter(f => f).join(" | ");
            doc.font(fonts.body)
               .fontSize(10)
               .text(allFilters || "No filters applied", 60, doc.y + 5, {
                   width: doc.page.width - 120
               });
        }

        // Add summary section
        doc.moveDown(3);
        const summaryY = doc.y;
        drawBox(40, summaryY, doc.page.width - 80, 30, colors.secondary);
        doc.font(fonts.heading)
           .fontSize(16)
           .fillColor('white')
           .text("SALES SUMMARY", 60, summaryY + 8, { align: 'center', width: doc.page.width - 120 });

        const summaryData = [
            ["Gross Sales", `₹${summary.grossSales}`, "Total Orders", summary.totalOrders],
            ["Total Discount", `₹${summary.totalDiscount}`, "Total Returns", summary.totalReturns],
            ["Coupons Applied", `₹${summary.totalCoupons}`, "Avg Order Value", `₹${summary.avgOrderValue}`],
            ["Net Sales", `₹${summary.netSales}`, "Conversion Rate", `${summary.conversionRate}%`]
        ];

        let currentSummaryY = summaryY + 40;
        summaryData.forEach((row, index) => {
            const rowY = currentSummaryY + (index * 25);
            if (index % 2 === 0) {
                drawBox(40, rowY, doc.page.width - 80, 25, '#f8f9fa');
            }
            doc.font(fonts.body).fontSize(11).fillColor(colors.text);
            doc.text(row[0], 60, rowY + 8, { width: 140 });
            doc.font(fonts.heading).text(row[1], 200, rowY + 8, { width: 100 });
            doc.font(fonts.body).text(row[2], 320, rowY + 8, { width: 140 });
            doc.font(fonts.heading).text(row[3], 460, rowY + 8, { width: 100 });
        });

        // Add order details table
        doc.moveDown(4);
        const tableStartY = currentSummaryY + 120;
        drawBox(10, tableStartY, doc.page.width - 20, 25, colors.primary);
        doc.font(fonts.heading)
           .fontSize(14)
           .fillColor('white')
           .text("ORDER DETAILS", 20, tableStartY + 6, { align: 'center', width: doc.page.width - 20 });

        const tableLeft = 10;
        const tableWidth = doc.page.width - 20;
        const headers = ["Order ID", "Date", "Customer", "Amount", "Discount", "Final Amount", "Payment", "Status"];
        const colWidths = [150, 60, 80, 60, 60, 70, 70, 80];

        const totalColWidth = colWidths.reduce((a, b) => a + b, 0);
        if (totalColWidth > tableWidth) {
            const ratio = tableWidth / totalColWidth;
            colWidths.forEach((width, i) => colWidths[i] = Math.floor(width * ratio));
        }

        let headerY = tableStartY + 30;
        drawBox(tableLeft, headerY, tableWidth, 30, colors.lightGray, colors.darkGray);
        doc.font(fonts.heading)
           .fontSize(10)
           .fillColor(colors.text);
        headers.forEach((header, i) => {
            const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.text(header, x + 5, headerY + 10, {
                width: colWidths[i] - 10,
                align: "center"
            });
        });

        let currentY = headerY + 35;
        const rowHeight = 25;

        ordersAggregate.forEach((order, index) => {
            if (currentY > doc.page.height - 100) {
                doc.addPage();
                addPageHeader();
                currentY = 150;
                drawBox(tableLeft, currentY, tableWidth, 30, colors.lightGray, colors.darkGray);
                doc.font(fonts.heading).fontSize(10).fillColor(colors.text);
                headers.forEach((header, i) => {
                    const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
                    doc.text(header, x + 5, currentY + 10, {
                        width: colWidths[i] - 10,
                        align: "center"
                    });
                });
                currentY += 35;
            }

            if (index % 2 === 0) {
                drawBox(tableLeft, currentY, tableWidth, rowHeight, '#f8f9fa');
            }

            drawBox(tableLeft, currentY, tableWidth, rowHeight, null, '#ddd');
            doc.font(fonts.body).fontSize(9).fillColor(colors.text);

            const rowData = [
                order.orderId || "N/A",
                moment(order.createdAt).format("DD MMM YY"),
                (order.shippingAddress?.name || "N/A").substring(0, 15),
                `₹${(order.totalPrice || 0).toFixed(0)}`,
                `₹${(order.discount || 0).toFixed(0)}`,
                `₹${(order.finalAmount || 0).toFixed(0)}`,
                (order.paymentMethod || "N/A").substring(0, 10),
                order.orderedItems[0]?.status || "N/A"
            ];

            rowData.forEach((data, i) => {
                const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
                doc.text(data, x + 5, currentY + 8, {
                    width: colWidths[i] - 10,
                    align: "center",
                    ellipsis: true
                });
            });

            currentY += rowHeight;
        });

        // Add page numbers
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.font(fonts.small)
               .fontSize(8)
               .fillColor(colors.darkGray)
               .text(`Page ${i + 1} of ${pageCount}`, doc.page.width - 100, doc.page.height - 30, {
                   align: 'right'
               });
        }

        doc.end();
    } catch (error) {
        console.error("Error exporting PDF:", error);
        res.status(500).json({
            success: false,
            error: `Failed to generate PDF: ${error.message}`
        });
    }
};

// Export Sales Report as Excel
const exportSalesReportExcel = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate } = req.body;
        let matchQuery = {};

        // Build match query
        if (search && search.trim()) {
            matchQuery.orderId = { $regex: search.trim(), $options: "i" };
        }

        if (userSearch && userSearch.trim()) {
            matchQuery.$or = [
                { "shippingAddress.name": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.address": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.city": { $regex: userSearch.trim(), $options: "i" } }
            ];
        }

        if (paymentMethod) {
            matchQuery.paymentMethod = paymentMethod;
        }

        // Handle date filtering
        if (dateRange && dateRange !== "custom") {
            let start, end;
            const now = moment().utc(); // Use UTC to avoid timezone issues
            switch (dateRange) {
                case "today":
                    start = now.clone().startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "yesterday":
                    start = now.clone().subtract(1, "days").startOf("day").toDate();
                    end = now.clone().subtract(1, "days").endOf("day").toDate();
                    break;
                case "last7days":
                    start = now.clone().subtract(6, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "last30days":
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
                    break;
                case "thismonth":
                    start = now.clone().startOf("month").toDate();
                    end = now.clone().endOf("month").toDate();
                    break;
                case "lastmonth":
                    start = now.clone().subtract(1, "month").startOf("month").toDate();
                    end = now.clone().subtract(1, "month").endOf("month").toDate();
                    break;
                case "thisyear":
                    start = now.clone().startOf("year").toDate();
                    end = now.clone().endOf("year").toDate();
                    break;
                case "lastyear":
                    start = now.clone().subtract(1, "year").startOf("year").toDate();
                    end = now.clone().subtract(1, "year").endOf("year").toDate();
                    break;
                default:
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
            }
            matchQuery.createdAt = { $gte: start, $lte: end };
        } else if (dateRange === "custom" && (startDate || endDate)) {
            const dateFormat = "DD/MM/YYYY";
            if (startDate && !moment(startDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid start date format. Use DD/MM/YYYY." });
            }
            if (endDate && !moment(endDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid end date format. Use DD/MM/YYYY." });
            }

            if (startDate) {
                matchQuery.createdAt = matchQuery.createdAt || {};
                matchQuery.createdAt.$gte = moment(startDate, dateFormat).utc().startOf("day").toDate();
            }
            if (endDate) {
                matchQuery.createdAt = matchQuery.createdAt || {};
                matchQuery.createdAt.$lte = moment(endDate, dateFormat).utc().endOf("day").toDate();
            }
        }

        // Aggregate orders for export
        const ordersAggregate = await Order.aggregate([
            { $match: matchQuery },
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: orderStatus ? { "orderedItems.status": orderStatus } : {} },
            {
                $group: {
                    _id: "$_id",
                    orderId: { $first: "$orderId" },
                    createdAt: { $first: "$createdAt" },
                    orderedItems: { $push: "$orderedItems" },
                    totalPrice: { $first: "$totalPrice" },
                    discount: { $first: "$discount" },
                    finalAmount: { $first: "$finalAmount" },
                    paymentMethod: { $first: "$paymentMethod" },
                    couponApplied: { $first: "$couponApplied" },
                    shippingAddress: { $first: "$shippingAddress" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $sort: { createdAt: -1 } }
        ]);

        // Calculate summary
        let grossSales = 0;
        let totalDiscount = 0;
        let totalCoupons = 0;
        let netSales = 0;
        let totalReturns = 0;
        let totalOrders = ordersAggregate.length;

        ordersAggregate.forEach(order => {
            const isReturned = order.orderedItems.some(item => item.status === "Returned");
            grossSales += parseFloat(order.totalPrice) || 0;
            totalDiscount += parseFloat(order.discount) || 0;
            totalCoupons += order.couponApplied ? parseFloat(order.discount) || 0 : 0;
            netSales += isReturned ? 0 : parseFloat(order.finalAmount) || 0;
            totalReturns += isReturned ? 1 : 0;
        });

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sales Report");

        // Add summary section
        worksheet.addRow(["Sales Report"]).font = { size: 16, bold: true };
        worksheet.addRow([`Generated on: ${moment().format("DD/MM/YYYY HH:mm")}`]).font = { size: 12 };
        worksheet.addRow([]);

        // Add filters
        let filterText = dateRange && dateRange !== "custom" ? dateRange.charAt(0).toUpperCase() + dateRange.slice(1).replace(/([A-Z])/g, ' $1') : "";
        if (startDate || endDate) filterText = `${startDate ? startDate : 'Any'} to ${endDate ? endDate : 'Any'}`;
        const filters = [];
        if (search) filters.push(`Order ID: ${search}`);
        if (userSearch) filters.push(`Customer: ${userSearch}`);
        if (paymentMethod) filters.push(`Payment: ${paymentMethod}`);
        if (orderStatus) filters.push(`Status: ${orderStatus}`);
        const allFilters = [filterText, ...filters].filter(f => f).join(" | ");
        worksheet.addRow(["Filters:", allFilters || "No filters applied"]).font = { size: 12, bold: true };
        worksheet.addRow([]);

        // Add summary data
        worksheet.addRow(["Summary"]).font = { size: 14, bold: true };
        worksheet.addRow(["Gross Sales", `₹${grossSales.toFixed(2)}`, "Total Orders", totalOrders]);
        worksheet.addRow(["Total Discount", `₹${totalDiscount.toFixed(2)}`, "Total Returns", totalReturns]);
        worksheet.addRow(["Coupons Applied", `₹${totalCoupons.toFixed(2)}`, "Net Sales", `₹${netSales.toFixed(2)}`]);
        worksheet.addRow([]);

        // Add table headers
        worksheet.addRow(["Order ID", "Date", "Customer", "Amount", "Discount", "Final Amount", "Payment Method", "Status"]).font = { bold: true };
        worksheet.getRow(worksheet.lastRow.number).eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D3D3D3' } };
        });

        // Add table data
        ordersAggregate.forEach(order => {
            worksheet.addRow([
                order.orderId || "N/A",
                moment(order.createdAt).format("DD/MM/YYYY"),
                order.shippingAddress?.name || "N/A",
                `₹${(order.totalPrice || 0).toFixed(2)}`,
                `₹${(order.discount || 0).toFixed(2)}`,
                `₹${(order.finalAmount || 0).toFixed(2)}`,
                order.paymentMethod || "N/A",
                order.orderedItems[0]?.status || "N/A"
            ]);
        });

        // Auto-size columns
        worksheet.columns.forEach(column => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, cell => {
                const length = cell.value ? String(cell.value).length : 10;
                maxLength = Math.max(maxLength, length);
            });
            column.width = maxLength + 2;
        });

        // Write to buffer and send response
        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="sales_report.xlsx"');
        res.send(buffer);
    } catch (error) {
        console.error("Error exporting Excel:", error);
        res.status(500).json({
            success: false,
            error: `Failed to generate Excel: ${error.message}`
        });
    }
};

module.exports = {
    getSalesReport,
    filterSalesReport,
    exportSalesReportPDF,
    exportSalesReportExcel
};