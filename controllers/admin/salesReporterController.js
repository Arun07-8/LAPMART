const Order = require("../../models/orderSchema");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const moment = require("moment-timezone");

const getSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        // Define match query for orders with at least one delivered item
        const matchQuery = { "orderedItems.status": "Delivered" };

        // Fetch orders with aggregation
        const ordersAggregate = await Order.aggregate([
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: matchQuery },
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

        // Count total delivered orders
        const countAgg = await Order.aggregate([
            { $match: matchQuery },
            { $group: { _id: "$_id" } },
            { $count: "total" }
        ]);
        const totalOrders = countAgg[0]?.total || 0;
        const totalPages = Math.ceil(totalOrders / limit);

        // Calculate summary metrics for delivered orders (without unwinding)
        const summaryAgg = await Order.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    grossSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: "$discount" },
                    totalCoupons: { $sum: { $cond: ["$couponApplied", "$discount", 0] } },
                    netSales: { $sum: { $subtract: ["$totalPrice", "$discount"] } }
                }
            }
        ]);

        // Count total returned items
        const returnsAgg = await Order.aggregate([
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: { "orderedItems.status": "Returned" } },
            { $count: "totalReturns" }
        ]);

        const summary = summaryAgg[0] || {
            grossSales: 0,
            totalDiscount: 0,
            totalCoupons: 0,
            netSales: 0
        };

        res.render("salesReport", {
            orders: ordersAggregate,
            summary: {
                grossSales: summary.grossSales.toFixed(2),
                totalDiscount: summary.totalDiscount.toFixed(2),
                totalCoupons: summary.totalCoupons.toFixed(2),
                netSales: summary.netSales.toFixed(2),
                totalOrders,
                totalReturns: returnsAgg[0]?.totalReturns || 0
            },
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error("Error in getSalesReport:", error);
        res.render("salesReport", {
            orders: [],
            summary: {
                grossSales: "0.00",
                totalDiscount: "0.00",
                totalCoupons: "0.00",
                netSales: "0.00",
                totalOrders: 0,
                totalReturns: 0
            },
            totalPages: 1,
            currentPage: page
        });
    }
};

const filterSalesReport = async (req, res) => {
    try {
        const {
            search,
            userSearch,
            paymentMethod,
            dateRange,
            startDate: startDateStr,
            endDate: endDateStr,
            page = 1,
            limit = 8,
        } = req.body;

        const _page = parseInt(page, 10) || 1;
        const _limit = parseInt(limit, 10) || 8;
        const skip = (_page - 1) * _limit;

        // Base: only delivered orders
        const matchQuery = { "orderedItems.status": "Delivered" };

        // Input validation
        if (search && typeof search !== "string") {
            return res.status(400).json({ success: false, error: "Invalid order ID search term" });
        }
        if (userSearch && typeof userSearch !== "string") {
            return res.status(400).json({ success: false, error: "Invalid user search term" });
        }
        const allowedMethods = ["Razorpay", "Cash on Delivery", "Wallet"];
        if (paymentMethod && !allowedMethods.includes(paymentMethod)) {
            return res.status(400).json({ success: false, error: "Invalid payment method" });
        }

        // Apply text filters
        if (search?.trim()) {
            matchQuery.orderId = { $regex: search.trim(), $options: "i" };
        }

        if (userSearch?.trim()) {
            matchQuery.$or = [
                { "shippingAddress.name": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.address": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.city": { $regex: userSearch.trim(), $options: "i" } },
            ];
        }

        if (paymentMethod) {
            matchQuery.paymentMethod = paymentMethod;
        }

        // Date filters
        const tz = "Asia/Kolkata";
        const dateFormat = "DD/MM/YYYY";

        const buildPresetRange = (range) => {
            const now = moment.tz(tz);
            switch (range) {
                case "today":
                    return { start: now.clone().startOf("day").toDate(), end: now.clone().endOf("day").toDate() };
                case "yesterday":
                    return {
                        start: now.clone().subtract(1, "day").startOf("day").toDate(),
                        end: now.clone().subtract(1, "day").endOf("day").toDate(),
                    };
                case "last7days":
                    return {
                        start: now.clone().subtract(6, "days").startOf("day").toDate(),
                        end: now.clone().endOf("day").toDate(),
                    };
                case "last30days":
                    return {
                        start: now.clone().subtract(29, "days").startOf("day").toDate(),
                        end: now.clone().endOf("day").toDate(),
                    };
                case "thismonth":
                    return { start: now.clone().startOf("month").toDate(), end: now.clone().endOf("month").toDate() };
                case "lastmonth": {
                    const prev = now.clone().subtract(1, "month");
                    return { start: prev.clone().startOf("month").toDate(), end: prev.clone().endOf("month").toDate() };
                }
                case "thisyear":
                    return { start: now.clone().startOf("year").toDate(), end: now.clone().endOf("year").toDate() };
                case "lastyear": {
                    const prev = now.clone().subtract(1, "year");
                    return { start: prev.clone().startOf("year").toDate(), end: prev.clone().endOf("year").toDate() };
                }
                default:
                    return null;
            }
        };

        if (dateRange && dateRange !== "custom") {
            const range = buildPresetRange(dateRange);
            if (range) {
                matchQuery.createdAt = { $gte: range.start, $lte: range.end };
            }
        } else if (dateRange === "custom" && (startDateStr || endDateStr)) {
            if (startDateStr && !moment(startDateStr, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid start date format. Use DD/MM/YYYY." });
            }
            if (endDateStr && !moment(endDateStr, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid end date format. Use DD/MM/YYYY." });
            }

            const start = startDateStr
                ? moment.tz(startDateStr, dateFormat, true, tz).startOf("day").toDate()
                : undefined;
            const end = endDateStr ? moment.tz(endDateStr, dateFormat, true, tz).endOf("day").toDate() : undefined;

            if (start && end && end < start) {
                return res.status(400).json({ success: false, error: "End date cannot be before start date." });
            }

            if (start || end) {
                matchQuery.createdAt = {};
                if (start) matchQuery.createdAt.$gte = start;
                if (end) matchQuery.createdAt.$lte = end;
            }
        }

        // Aggregations
        // 1) Paged data
        const ordersAggregate = await Order.aggregate([
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: false } },
            { $match: matchQuery },
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
                    shippingAddress: { $first: "$shippingAddress" },
                },
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: _limit },
        ]);

        // 2) Count orders for pagination
        const countAgg = await Order.aggregate([
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: false } },
            { $match: matchQuery },
            { $group: { _id: "$_id" } },
            { $count: "total" },
        ]);
        const totalOrders = countAgg[0]?.total || 0;
        const totalPages = Math.ceil(totalOrders / _limit);

        // 3) Summary (apply all filters)
        const summaryAgg = await Order.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    grossSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: "$discount" },
                    totalCoupons: { $sum: { $cond: ["$couponApplied", "$discount", 0] } },
                    netSales: { $sum: { $subtract: ["$totalPrice", "$discount"] } },
                },
            },
        ]);

        // 4) Returns
        const returnsAgg = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $match: {
                    ...(matchQuery.createdAt ? { createdAt: matchQuery.createdAt } : {}),
                    "orderedItems.status": "Returned",
                },
            },
            { $count: "totalReturns" },
        ]);

        const summary = summaryAgg[0] || {
            grossSales: 0,
            totalDiscount: 0,
            totalCoupons: 0,
            netSales: 0,
        };

        res.json({
            success: true,
            orders: ordersAggregate,
            summary: {
                grossSales: summary.grossSales.toFixed(2),
                totalDiscount: summary.totalDiscount.toFixed(2),
                totalCoupons: summary.totalCoupons.toFixed(2),
                netSales: summary.netSales.toFixed(2),
                totalOrders,
                totalReturns: returnsAgg[0]?.totalReturns || 0,
            },
            totalPages,
            currentPage: _page,
        });
    } catch (error) {
        console.error("Error filtering sales report:", error);
        res.status(500).json({ success: false, error: `Server error: ${error.message}` });
    }
};

const exportSalesReportPDF = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, dateRange, startDate, endDate } = req.body;
        let matchQuery = { "orderedItems.status": "Delivered" };

        // Apply filters
        if (search && search.trim()) {
            matchQuery.orderId = { $regex: search.trim(), $options: "i" };
        }
        if (userSearch && userSearch.trim()) {
            matchQuery.$or = [
                { "shippingAddress.name": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.address": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.city": { $regex: userSearch.trim(), $options: "i" } },
            ];
        }
        if (paymentMethod) {
            matchQuery.paymentMethod = paymentMethod;
        }

        const dateFormat = "DD/MM/YYYY";
        const tz = "Asia/Kolkata";
        const buildPresetRange = (range) => {
            const now = moment.tz(tz);
            switch (range) {
                case "today":
                    return { start: now.clone().startOf("day").toDate(), end: now.clone().endOf("day").toDate() };
                case "yesterday":
                    return {
                        start: now.clone().subtract(1, "day").startOf("day").toDate(),
                        end: now.clone().subtract(1, "day").endOf("day").toDate(),
                    };
                case "last7days":
                    return {
                        start: now.clone().subtract(6, "days").startOf("day").toDate(),
                        end: now.clone().endOf("day").toDate(),
                    };
                case "last30days":
                    return {
                        start: now.clone().subtract(29, "days").startOf("day").toDate(),
                        end: now.clone().endOf("day").toDate(),
                    };
                case "thismonth":
                    return { start: now.clone().startOf("month").toDate(), end: now.clone().endOf("month").toDate() };
                case "lastmonth":
                    return {
                        start: now.clone().subtract(1, "month").startOf("month").toDate(),
                        end: now.clone().subtract(1, "month").endOf("month").toDate(),
                    };
                case "thisyear":
                    return { start: now.clone().startOf("year").toDate(), end: now.clone().endOf("year").toDate() };
                case "lastyear":
                    return {
                        start: now.clone().subtract(1, "year").startOf("year").toDate(),
                        end: now.clone().subtract(1, "year").endOf("year").toDate(),
                    };
                default:
                    return null;
            }
        };

        if (dateRange && dateRange !== "custom") {
            const range = buildPresetRange(dateRange);
            if (range) {
                matchQuery.createdAt = { $gte: range.start, $lte: range.end };
            }
        } else if (dateRange === "custom" && (startDate || endDate)) {
            if (startDate && !moment(startDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid start date format. Use DD/MM/YYYY." });
            }
            if (endDate && !moment(endDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid end date format. Use DD/MM/YYYY." });
            }
            if (startDate && endDate && moment(endDate, dateFormat).isBefore(moment(startDate, dateFormat))) {
                return res.status(400).json({ success: false, error: "End date cannot be before start date." });
            }

            matchQuery.createdAt = {};
            if (startDate) {
                matchQuery.createdAt.$gte = moment.tz(startDate, dateFormat, tz).startOf("day").toDate();
            }
            if (endDate) {
                matchQuery.createdAt.$lte = moment.tz(endDate, dateFormat, tz).endOf("day").toDate();
            }
        }

        // Fetch orders
        const ordersAggregate = await Order.aggregate([
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: matchQuery },
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
                    shippingAddress: { $first: "$shippingAddress" },
                },
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        // Calculate summary metrics
        const summaryAgg = await Order.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    grossSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: "$discount" },
                    totalCoupons: { $sum: { $cond: ["$couponApplied", "$discount", 0] } },
                    netSales: { $sum: { $subtract: ["$totalPrice", "$discount"] } },
                },
            },
        ]);

        // Count returns
        const returnsAgg = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $match: {
                    ...(matchQuery.createdAt ? { createdAt: matchQuery.createdAt } : {}),
                    "orderedItems.status": "Returned",
                },
            },
            { $count: "totalReturns" },
        ]);

        const summary = summaryAgg[0] || {
            grossSales: 0,
            totalDiscount: 0,
            totalCoupons: 0,
            netSales: 0,
        };
        const totalOrders = ordersAggregate.length;
        const totalReturns = returnsAgg[0]?.totalReturns || 0;

        const doc = new PDFDocument({
            margin: 1,
            size: "A4",
            layout: "portrait",
            bufferPages: true,
        });

        let buffers = [];
        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
            const pdfData = Buffer.concat(buffers);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", 'attachment; filename="sales_report_delivered.pdf"');
            res.send(pdfData);
        });

        const colors = {
            primary: "#2c3e50",
            secondary: "#3498db",
            accent: "#e74c3c",
            text: "#2c3e50",
            lightGray: "#ecf0f1",
            darkGray: "#95a5a6",
        };

        const fonts = {
            title: "Helvetica-Bold",
            heading: "Helvetica-Bold",
            body: "Helvetica",
            small: "Helvetica",
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
                .fillColor("white")
                .text("LapMart - Delivered Sales Report", 60, 55, { align: "center", width: doc.page.width - 120 });
            doc.font(fonts.body)
                .fontSize(12)
                .text(`Generated on: ${moment().tz(tz).format("DD MMMM YYYY, hh:mm A")}`, 60, 85, {
                    align: "center",
                    width: doc.page.width - 120,
                });
        }

        addPageHeader();

        let filterText = "";
        let hasFilters = false;
        if (dateRange && dateRange !== "custom") {
            filterText += dateRange.charAt(0).toUpperCase() + dateRange.slice(1).replace(/([A-Z])/g, " $1");
            hasFilters = true;
        } else if (startDate || endDate) {
            filterText += `${startDate ? startDate : "Any"} to ${endDate ? endDate : "Any"}`;
            hasFilters = true;
        }

        const filters = [];
        if (search) filters.push(`Order ID: ${search}`);
        if (userSearch) filters.push(`Customer: ${userSearch}`);
        if (paymentMethod) filters.push(`Payment: ${paymentMethod}`);
        filters.push("Status: Delivered");

        if (hasFilters || filters.length > 0) {
            doc.moveDown(2);
            drawBox(40, doc.y, doc.page.width - 80, 40, colors.lightGray, colors.darkGray);
            doc.font(fonts.heading)
                .fontSize(12)
                .fillColor(colors.text)
                .text("REPORT FILTERS", 60, doc.y + 10);
            const allFilters = [filterText, ...filters].filter((f) => f).join(" | ");
            doc.font(fonts.body)
                .fontSize(10)
                .text(allFilters || "No filters applied", 60, doc.y + 5, {
                    width: doc.page.width - 120,
                });
        }

        doc.moveDown(3);
        const summaryY = doc.y;
        drawBox(40, summaryY, doc.page.width - 80, 30, colors.secondary);
        doc.font(fonts.heading)
            .fontSize(16)
            .fillColor("white") // Fixed: Removed the incorrect .fillColor.fillColor
            .text("DELIVERED SALES SUMMARY", 60, summaryY + 8, { align: "center", width: doc.page.width - 120 });

        const summaryData = [
            ["Gross Sales", `₹${summary.grossSales.toFixed(2)}`, "Total Orders", totalOrders],
            ["Total Discount", `₹${summary.totalDiscount.toFixed(2)}`, "Total Returns", totalReturns],
            ["Coupons Applied", `₹${summary.totalCoupons.toFixed(2)}`, "Net Sales", `₹${summary.netSales.toFixed(2)}`],
        ];

        let currentSummaryY = summaryY + 40;
        summaryData.forEach((row, index) => {
            const rowY = currentSummaryY + index * 25;
            if (index % 2 === 0) {
                drawBox(40, rowY, doc.page.width - 80, 25, "#f8f9fa");
            }
            doc.font(fonts.body).fontSize(11).fillColor(colors.text);
            doc.text(row[0], 60, rowY + 8, { width: 140 });
            doc.font(fonts.heading).text(row[1], 200, rowY + 8, { width: 100 });
            doc.font(fonts.body).text(row[2], 320, rowY + 8, { width: 140 });
            doc.font(fonts.heading).text(row[3], 460, rowY + 8, { width: 100 });
        });

        doc.moveDown(4);
        const tableStartY = currentSummaryY + 100;
        drawBox(10, tableStartY, doc.page.width - 20, 25, colors.primary);
        doc.font(fonts.heading)
            .fontSize(14)
            .fillColor("white")
            .text("DELIVERED ORDER DETAILS", 20, tableStartY + 6, { align: "center", width: doc.page.width - 20 });

        const tableLeft = 10;
        const tableWidth = doc.page.width - 20;
        const headers = ["Order ID", "Date", "Customer", "Amount", "Discount", "Final Amount", "Payment", "Status"];
        const colWidths = [150, 60, 80, 60, 60, 70, 70, 80];

        const totalColWidth = colWidths.reduce((a, b) => a + b, 0);
        if (totalColWidth > tableWidth) {
            const ratio = tableWidth / totalColWidth;
            colWidths.forEach((width, i) => (colWidths[i] = Math.floor(width * ratio)));
        }

        let headerY = tableStartY + 30;
        drawBox(tableLeft, headerY, tableWidth, 30, colors.lightGray, colors.darkGray);
        doc.font(fonts.heading).fontSize(10).fillColor(colors.text);
        headers.forEach((header, i) => {
            const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
            doc.text(header, x + 5, headerY + 10, {
                width: colWidths[i] - 10,
                align: "center",
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
                        align: "center",
                    });
                });
                currentY += 35;
            }

            if (index % 2 === 0) {
                drawBox(tableLeft, currentY, tableWidth, rowHeight, "#f8f9fa");
            }

            drawBox(tableLeft, currentY, tableWidth, rowHeight, null, "#ddd");
            doc.font(fonts.body).fontSize(9).fillColor(colors.text);

            const status = order.orderedItems.some((item) => item.status === "Returned")
                ? "Partially Returned"
                : order.orderedItems[0]?.status || "Delivered";

            const rowData = [
                order.orderId || "N/A",
                moment(order.createdAt).tz(tz).format("DD MMM YYYY"),
                (order.shippingAddress?.name || "N/A").substring(0, 15),
                `₹${(order.totalPrice || 0).toFixed(0)}`,
                `₹${(order.discount || 0).toFixed(0)}`,
                `₹${(order.finalAmount || 0).toFixed(0)}`,
                (order.paymentMethod || "N/A").substring(0, 10),
                status,
            ];

            rowData.forEach((data, i) => {
                const x = tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
                doc.text(data, x + 5, currentY + 8, {
                    width: colWidths[i] - 10,
                    align: "center",
                    ellipsis: true,
                });
            });

            currentY += rowHeight;
        });

        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.font(fonts.small)
                .fontSize(8)
                .fillColor(colors.darkGray)
                .text(`Page ${i + 1} of ${pageCount}`, doc.page.width - 100, doc.page.height - 30, {
                    align: "right",
                });
        }

        doc.end();
    } catch (error) {
        console.error("Error exporting PDF:", error);
        res.status(500).json({
            success: false,
            error: `Failed to generate PDF: ${error.message}`,
        });
    }
};
const exportSalesReportExcel = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, dateRange, startDate, endDate } = req.body;
        let matchQuery = { "orderedItems.status": "Delivered" };

        // Apply filters
        if (search && search.trim()) {
            matchQuery.orderId = { $regex: search.trim(), $options: "i" };
        }
        if (userSearch && userSearch.trim()) {
            matchQuery.$or = [
                { "shippingAddress.name": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.address": { $regex: userSearch.trim(), $options: "i" } },
                { "shippingAddress.city": { $regex: userSearch.trim(), $options: "i" } },
            ];
        }
        if (paymentMethod) {
            matchQuery.paymentMethod = paymentMethod;
        }

        const dateFormat = "DD/MM/YYYY";
        const tz = "Asia/Kolkata";
        const buildPresetRange = (range) => {
            const now = moment.tz(tz);
            switch (range) {
                case "today":
                    return { start: now.clone().startOf("day").toDate(), end: now.clone().endOf("day").toDate() };
                case "yesterday":
                    return {
                        start: now.clone().subtract(1, "day").startOf("day").toDate(),
                        end: now.clone().subtract(1, "day").endOf("day").toDate(),
                    };
                case "last7days":
                    return {
                        start: now.clone().subtract(6, "days").startOf("day").toDate(),
                        end: now.clone().endOf("day").toDate(),
                    };
                case "last30days":
                    return {
                        start: now.clone().subtract(29, "days").startOf("day").toDate(),
                        end: now.clone().endOf("day").toDate(),
                    };
                case "thismonth":
                    return { start: now.clone().startOf("month").toDate(), end: now.clone().endOf("month").toDate() };
                case "lastmonth":
                    return {
                        start: now.clone().subtract(1, "month").startOf("month").toDate(),
                        end: now.clone().subtract(1, "month").endOf("month").toDate(),
                    };
                case "thisyear":
                    return { start: now.clone().startOf("year").toDate(), end: now.clone().endOf("year").toDate() };
                case "lastyear":
                    return {
                        start: now.clone().subtract(1, "year").startOf("year").toDate(),
                        end: now.clone().subtract(1, "year").endOf("year").toDate(),
                    };
                default:
                    return null;
            }
        };

        if (dateRange && dateRange !== "custom") {
            const range = buildPresetRange(dateRange);
            if (range) {
                matchQuery.createdAt = { $gte: range.start, $lte: range.end };
            }
        } else if (dateRange === "custom" && (startDate || endDate)) {
            if (startDate && !moment(startDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid start date format. Use DD/MM/YYYY." });
            }
            if (endDate && !moment(endDate, dateFormat, true).isValid()) {
                return res.status(400).json({ success: false, error: "Invalid end date format. Use DD/MM/YYYY." });
            }
            if (startDate && endDate && moment(endDate, dateFormat).isBefore(moment(startDate, dateFormat))) {
                return res.status(400).json({ success: false, error: "End date cannot be before start date." });
            }

            matchQuery.createdAt = {};
            if (startDate) {
                matchQuery.createdAt.$gte = moment.tz(startDate, dateFormat, tz).startOf("day").toDate();
            }
            if (endDate) {
                matchQuery.createdAt.$lte = moment.tz(endDate, dateFormat, tz).endOf("day").toDate();
            }
        }

        // Fetch orders
        const ordersAggregate = await Order.aggregate([
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: matchQuery },
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
                    shippingAddress: { $first: "$shippingAddress" },
                },
            },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.product",
                    foreignField: "_id",
                    as: "productDetails",
                },
            },
            { $sort: { createdAt: -1 } },
        ]);

        // Calculate summary metrics
        const summaryAgg = await Order.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    grossSales: { $sum: "$totalPrice" },
                    totalDiscount: { $sum: "$discount" },
                    totalCoupons: { $sum: { $cond: ["$couponApplied", "$discount", 0] } },
                    netSales: { $sum: { $subtract: ["$totalPrice", "$discount"] } },
                },
            },
        ]);

        // Count returns
        const returnsAgg = await Order.aggregate([
            { $unwind: "$orderedItems" },
            {
                $match: {
                    ...(matchQuery.createdAt ? { createdAt: matchQuery.createdAt } : {}),
                    "orderedItems.status": "Returned",
                },
            },
            { $count: "totalReturns" },
        ]);

        const summary = summaryAgg[0] || {
            grossSales: 0,
            totalDiscount: 0,
            totalCoupons: 0,
            netSales: 0,
        };
        const totalOrders = ordersAggregate.length;
        const totalReturns = returnsAgg[0]?.totalReturns || 0;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Delivered Sales Report");

        worksheet.addRow(["Delivered Sales Report"]).font = { size: 16, bold: true };
        worksheet.addRow([`Generated on: ${moment().tz(tz).format("DD/MM/YYYY HH:mm")}`]).font = { size: 12 };
        worksheet.addRow([]);

        let filterText = dateRange && dateRange !== "custom" ? dateRange.charAt(0).toUpperCase() + dateRange.slice(1).replace(/([A-Z])/g, " $1") : "";
        if (startDate || endDate) filterText = `${startDate ? startDate : "Any"} to ${endDate ? endDate : "Any"}`;
        const filters = [];
        if (search) filters.push(`Order ID: ${search}`);
        if (userSearch) filters.push(`Customer: ${userSearch}`);
        if (paymentMethod) filters.push(`Payment: ${paymentMethod}`);
        filters.push("Status: Delivered");
        const allFilters = [filterText, ...filters].filter((f) => f).join(" | ");
        worksheet.addRow(["Filters:", allFilters || "No filters applied"]).font = { size: 12, bold: true };
        worksheet.addRow([]);

        worksheet.addRow(["Summary"]).font = { size: 14, bold: true };
        worksheet.addRow(["Gross Sales", `₹${summary.grossSales.toFixed(2)}`, "Total Orders", totalOrders]);
        worksheet.addRow(["Total Discount", `₹${summary.totalDiscount.toFixed(2)}`, "Total Returns", totalReturns]);
        worksheet.addRow(["Coupons Applied", `₹${summary.totalCoupons.toFixed(2)}`, "Net Sales", `₹${summary.netSales.toFixed(2)}`]);
        worksheet.addRow([]);

        worksheet.addRow(["Order ID", "Date", "Customer", "Amount", "Discount", "Final Amount", "Payment Method", "Status"]).font = {
            bold: true,
        };
        worksheet.getRow(worksheet.lastRow.number).eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D3D3D3" } };
        });

        ordersAggregate.forEach((order) => {
            const status = order.orderedItems.some((item) => item.status === "Returned")
                ? "Partially Returned"
                : order.orderedItems[0]?.status || "Delivered";
            worksheet.addRow([
                order.orderId || "N/A",
                moment(order.createdAt).tz(tz).format("DD/MM/YYYY"),
                order.shippingAddress?.name || "N/A",
                `₹${(order.totalPrice || 0).toFixed(2)}`,
                `₹${(order.discount || 0).toFixed(2)}`,
                `₹${(order.finalAmount || 0).toFixed(2)}`,
                order.paymentMethod || "N/A",
                status,
            ]);
        });

        worksheet.columns.forEach((column) => {
            let maxLength = 0;
            column.eachCell({ includeEmpty: true }, (cell) => {
                const length = cell.value ? String(cell.value).length : 10;
                maxLength = Math.max(maxLength, length);
            });
            column.width = maxLength + 2;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="sales_report_delivered.xlsx"');
        res.send(buffer);
    } catch (error) {
        console.error("Error exporting Excel:", error);
        res.status(500).json({
            success: false,
            error: `Failed to generate Excel: ${error.message}`,
        });
    }
};

module.exports = {
    getSalesReport,
    filterSalesReport,
    exportSalesReportPDF,
    exportSalesReportExcel,
};