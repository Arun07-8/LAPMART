const Order = require("../../models/orderSchema");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const moment = require("moment");

const getSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        console.log("Fetching sales report: page", page, "limit", limit);

        // Aggregation pipeline to fetch orders
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

        // Calculate total count for pagination
        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        // Calculate summary
        let grossSales = 0;
        let totalDiscount = 0;
        let totalCoupons = 0;
        let netSales = 0;

        ordersAggregate.forEach(order => {
            grossSales += parseFloat(order.totalPrice) || 0;
            totalDiscount += parseFloat(order.discount) || 0;
            totalCoupons += order.couponApplied ? parseFloat(order.discount) || 0 : 0;
            netSales += parseFloat(order.finalAmount) || 0;
        });

        console.log("Sales report fetched:", ordersAggregate.length, "orders, total pages:", totalPages);

        res.render("salesReport", {
            orders: ordersAggregate,
            summary: {
                grossSales: grossSales.toFixed(2),
                totalDiscount: totalDiscount.toFixed(2),
                totalCoupons: totalCoupons.toFixed(2),
                netSales: netSales.toFixed(2),
                totalOrders
            },
            totalPages,
            currentPage: page
        });
    } catch (error) {
        console.error("Error in getSalesReport:", error);
        res.status(500).render("error", {
            message: "Failed to generate sales report",
            error: process.env.NODE_ENV === 'development' ? error.message : {}
        });
    }
};

const filterSalesReport = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate, page = 1, limit = 10 } = req.body;
        const skip = (page - 1) * limit;
        let matchQuery = {};

        console.log("FilterSalesReport params:", { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate, page, limit });

        // Validate inputs
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

        if (dateRange && dateRange !== "custom") {
            let start, end;
            const now = moment();
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
                default:
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
            }
            matchQuery.createdAt = { $gte: start, $lte: end };
        } else if (startDate && endDate && dateRange === "custom") {
            const start = moment(startDate);
            const end = moment(endDate);
            if (!start.isValid() || !end.isValid()) {
                return res.status(400).json({ success: false, error: "Invalid date format" });
            }
            if (start.isAfter(end)) {
                return res.status(400).json({ success: false, error: "Start date cannot be after end date" });
            }
            matchQuery.createdAt = {
                $gte: start.startOf("day").toDate(),
                $lte: end.endOf("day").toDate()
            };
        }

        // Aggregation pipeline
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

        // Calculate total count
        const totalOrders = await Order.aggregate([
            { $match: matchQuery },
            { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
            { $match: orderStatus ? { "orderedItems.status": orderStatus } : {} },
            { $group: { _id: "$_id" } },
            { $count: "total" }
        ]);

        const totalCount = totalOrders.length > 0 ? totalOrders[0].total : 0;
        const totalPages = Math.ceil(totalCount / limit);

        // Calculate summary
        let grossSales = 0;
        let totalDiscount = 0;
        let totalCoupons = 0;
        let netSales = 0;

        ordersAggregate.forEach(order => {
            grossSales += parseFloat(order.totalPrice) || 0;
            totalDiscount += parseFloat(order.discount) || 0;
            totalCoupons += order.couponApplied ? parseFloat(order.discount) || 0 : 0;
            netSales += parseFloat(order.finalAmount) || 0;
        });

        console.log("Returning orders:", ordersAggregate.length, "Total count:", totalCount);

        res.json({
            success: true,
            orders: ordersAggregate,
            summary: {
                grossSales: grossSales.toFixed(2),
                totalDiscount: totalDiscount.toFixed(2),
                totalCoupons: totalCoupons.toFixed(2),
                netSales: netSales.toFixed(2),
                totalOrders: totalCount
            },
            totalPages,
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error("Error filtering sales report:", error);
        res.status(500).json({ success: false, error: `Server error while filtering sales report: ${error.message}` });
    }
};

const exportSalesReportPDF = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate } = req.body;
        let matchQuery = {};

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

        if (dateRange && dateRange !== "custom") {
            let start, end;
            const now = moment();
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
                default:
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
            }
            matchQuery.createdAt = { $gte: start, $lte: end };
        } else if (startDate && endDate) {
            const start = moment(startDate);
            const end = moment(endDate);
            if (!start.isValid() || !end.isValid()) {
                return res.status(400).json({ success: false, error: "Invalid date format" });
            }
            if (start.isAfter(end)) {
                return res.status(400).json({ success: false, error: "Start date cannot be after end date" });
            }
            matchQuery.createdAt = {
                $gte: start.startOf("day").toDate(),
                $lte: end.endOf("day").toDate()
            };
        }

        // Fetch all matching orders
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
        let totalOrders = ordersAggregate.length;

        ordersAggregate.forEach(order => {
            grossSales += parseFloat(order.totalPrice) || 0;
            totalDiscount += parseFloat(order.discount) || 0;
            totalCoupons += order.couponApplied ? parseFloat(order.discount) || 0 : 0;
            netSales += parseFloat(order.finalAmount) || 0;
        });

        const summary = {
            grossSales: grossSales.toFixed(2),
            totalDiscount: totalDiscount.toFixed(2),
            totalCoupons: totalCoupons.toFixed(2),
            netSales: netSales.toFixed(2),
            totalOrders
        };

        // Create PDF
        const doc = new PDFDocument({ margin: 50 });
        let buffers = [];
        doc.on("data", buffers.push.bind(buffers));
        doc.on("end", () => {
            const pdfData = Buffer.concat(buffers);
            res.setHeader("Content-Type", "application/pdf");
            res.setHeader("Content-Disposition", 'attachment; filename="sales_report.pdf"');
            res.send(pdfData);
        });

        // PDF Content
        doc.fontSize(20).text("Sales Report", { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(`Generated on: ${moment().format("DD MMM YYYY, hh:mm A")}`, { align: "center" });

        // Filter info
        let filterText = "Filter: ";
        let hasFilters = false;
        if (dateRange && dateRange !== "custom") {
            filterText += dateRange.charAt(0).toUpperCase() + dateRange.slice(1).replace(/([A-Z])/g, ' $1');
            hasFilters = true;
        } else if (startDate && endDate) {
            filterText += `${moment(startDate).format("DD MMM YYYY")} to ${moment(endDate).format("DD MMM YYYY")}`;
            hasFilters = true;
        }
        if (search) {
            filterText += `${hasFilters ? " | " : ""}Order ID: ${search}`;
            hasFilters = true;
        }
        if (userSearch) {
            filterText += `${hasFilters ? " | " : ""}User: ${userSearch}`;
            hasFilters = true;
        }
        if (paymentMethod) {
            filterText += `${hasFilters ? " | " : ""}Payment: ${paymentMethod}`;
            hasFilters = true;
        }
        if (orderStatus) {
            filterText += `${hasFilters ? " | " : ""}Status: ${orderStatus}`;
            hasFilters = true;
        }
        if (hasFilters) {
            doc.moveDown();
            doc.fontSize(10).text(filterText, { align: "center" });
        }

        doc.moveDown(2);

        // Summary
        doc.fontSize(16).text("Sales Summary", { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12)
            .text(`Gross Sales: ₹${summary.grossSales}`)
            .text(`Total Discount: ₹${summary.totalDiscount}`)
            .text(`Coupons Applied: ₹${summary.totalCoupons}`)
            .text(`Net Sales: ₹${summary.netSales}`)
            .text(`Total Orders: ${summary.totalOrders}`);
        doc.moveDown(2);

        // Table
        doc.fontSize(14).text("Order Details", { underline: true });
        doc.moveDown(0.5);
        const tableTop = doc.y;
        const headers = ["Order ID", "Date", "Customer", "Amount", "Discount", "Coupon", "Final Amount", "Payment", "Status"];
        const colWidths = [80, 60, 80, 60, 60, 60, 70, 70, 60];
        const tableLeft = 50;

        // Draw headers
        doc.font("Helvetica-Bold").fontSize(10);
        headers.forEach((header, i) => {
            doc.text(header, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop, { width: colWidths[i], align: "center" });
        });

        // Draw header underline
        doc.moveTo(tableLeft, tableTop + 15)
           .lineTo(tableLeft + colWidths.reduce((a, b) => a + b, 0), tableTop + 15)
           .stroke();

        // Draw rows
        let currentY = tableTop + 25;
        ordersAggregate.forEach((order, index) => {
            if (currentY > doc.page.height - 100) {
                doc.addPage();
                currentY = 50;
            }
            doc.font("Helvetica").fontSize(9);
            const rowData = [
                order.orderId || "N/A",
                moment(order.createdAt).format("DD MMM YY"),
                order.shippingAddress?.name || "N/A",
                `₹${(order.totalPrice || 0).toFixed(2)}`,
                `₹${(order.discount || 0).toFixed(2)}`,
                `₹${(order.couponApplied ? order.discount : 0).toFixed(2)}`,
                `₹${(order.finalAmount || 0).toFixed(2)}`,
                order.paymentMethod || "N/A",
                order.orderedItems[0]?.status || "N/A"
            ];
            rowData.forEach((data, i) => {
                doc.text(data, tableLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), currentY, { width: colWidths[i], align: "center" });
            });
            currentY += 20;
        });

        doc.end();
    } catch (error) {
        console.error("Error exporting PDF:", error);
        res.status(500).json({ success: false, error: `Failed to generate PDF: ${error.message}` });
    }
};

const exportSalesReportExcel = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate } = req.body;
        let matchQuery = {};

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

        if (dateRange && dateRange !== "custom") {
            let start, end;
            const now = moment();
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
                default:
                    start = now.clone().subtract(29, "days").startOf("day").toDate();
                    end = now.clone().endOf("day").toDate();
            }
            matchQuery.createdAt = { $gte: start, $lte: end };
        } else if (startDate && endDate) {
            const start = moment(startDate);
            const end = moment(endDate);
            if (!start.isValid() || !end.isValid()) {
                return res.status(400).json({ success: false, error: "Invalid date format" });
            }
            if (start.isAfter(end)) {
                return res.status(400).json({ success: false, error: "Start date cannot be after end date" });
            }
            matchQuery.createdAt = {
                $gte: start.startOf("day").toDate(),
                $lte: end.endOf("day").toDate()
            };
        }

        // Fetch all matching orders
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
        let totalOrders = ordersAggregate.length;

        ordersAggregate.forEach(order => {
            grossSales += parseFloat(order.totalPrice) || 0;
            totalDiscount += parseFloat(order.discount) || 0;
            totalCoupons += order.couponApplied ? parseFloat(order.discount) || 0 : 0;
            netSales += parseFloat(order.finalAmount) || 0;
        });

        const summary = {
            grossSales: grossSales.toFixed(2),
            totalDiscount: totalDiscount.toFixed(2),
            totalCoupons: totalCoupons.toFixed(2),
            netSales: netSales.toFixed(2),
            totalOrders
        };

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Sales Report");

        // Title and metadata
        worksheet.mergeCells("A1:I1");
        worksheet.getCell("A1").value = "Sales Report";
        worksheet.getCell("A1").font = { size: 16, bold: true };
        worksheet.getCell("A1").alignment = { horizontal: "center" };

        worksheet.mergeCells("A2:I2");
        worksheet.getCell("A2").value = `Generated on: ${moment().format("DD MMM YYYY, hh:mm A")}`;
        worksheet.getCell("A2").alignment = { horizontal: "center" };

        // Filter info
        let filterText = "Filter: ";
        let hasFilters = false;
        if (dateRange && dateRange !== "custom") {
            filterText += dateRange.charAt(0).toUpperCase() + dateRange.slice(1).replace(/([A-Z])/g, ' $1');
            hasFilters = true;
        } else if (startDate && endDate) {
            filterText += `${moment(startDate).format("DD MMM YYYY")} to ${moment(endDate).format("DD MMM YYYY")}`;
            hasFilters = true;
        }
        if (search) {
            filterText += `${hasFilters ? " | " : ""}Order ID: ${search}`;
            hasFilters = true;
        }
        if (userSearch) {
            filterText += `${hasFilters ? " | " : ""}User: ${userSearch}`;
            hasFilters = true;
        }
        if (paymentMethod) {
            filterText += `${hasFilters ? " | " : ""}Payment: ${paymentMethod}`;
            hasFilters = true;
        }
        if (orderStatus) {
            filterText += `${hasFilters ? " | " : ""}Status: ${orderStatus}`;
            hasFilters = true;
        }
        if (hasFilters) {
            worksheet.mergeCells("A3:I3");
            worksheet.getCell("A3").value = filterText;
            worksheet.getCell("A3").alignment = { horizontal: "center" };
        }

        worksheet.addRow([]);

        // Summary
        worksheet.addRow(["Sales Summary"]).font = { bold: true };
        worksheet.addRow(["Gross Sales", `₹${summary.grossSales}`]);
        worksheet.addRow(["Total Discount", `₹${summary.totalDiscount}`]);
        worksheet.addRow(["Coupons Applied", `₹${summary.totalCoupons}`]);
        worksheet.addRow(["Net Sales", `₹${summary.netSales}`]);
        worksheet.addRow(["Total Orders", summary.totalOrders]);
        worksheet.addRow([]);

        // Table
        const headerRow = worksheet.addRow([
            "Order ID",
            "Date",
            "Customer",
            "Amount",
            "Discount",
            "Coupon",
            "Final Amount",
            "Payment Method",
            "Status"
        ]);
        headerRow.font = { bold: true };
        headerRow.eachCell(cell => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6E6" } };
        });

        // Add data
        ordersAggregate.forEach(order => {
            worksheet.addRow([
                order.orderId || "N/A",
                moment(order.createdAt).format("DD MMM YYYY"),
                order.shippingAddress?.name || "N/A",
                `₹${(order.totalPrice || 0).toFixed(2)}`,
                `₹${(order.discount || 0).toFixed(2)}`,
                `₹${(order.couponApplied ? order.discount : 0).toFixed(2)}`,
                `₹${(order.finalAmount || 0).toFixed(2)}`,
                order.paymentMethod || "N/A",
                order.orderedItems[0]?.status || "N/A"
            ]);
        });

        // Auto-size columns
        worksheet.columns.forEach(column => {
            let maxLength = 10;
            column.eachCell({ includeEmpty: true }, cell => {
                const length = cell.value ? cell.value.toString().length : 0;
                maxLength = Math.max(maxLength, length);
            });
            column.width = Math.min(maxLength + 2, 30);
        });

        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="sales_report.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting Excel:", error);
        res.status(500).json({ success: false, error: `Failed to generate Excel: ${error.message}` });
    }
};

module.exports = {
    getSalesReport,
    filterSalesReport,
    exportSalesReportPDF,
    exportSalesReportExcel
};