
const Order = require("../../models/orderSchema");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const moment = require("moment");

const getSalesReport = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    // Step 1: Aggregated orders for paginated display
    const ordersAggregate = await Order.aggregate([
      { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id",
          orderId: { $first: "$orderId" },
          createdAt: { $first: "$createdAt" },
          orderedItems: { $push: "$orderedItems" },
          totalPrice: { $first: "$totalPrice" },
          offerPrice: { $first: "$offerPrice" },
          discount: { $first: "$discount" },
          finalAmount: { $first: "$finalAmount" },
          paymentMethod: { $first: "$paymentMethod" },
          couponApplied: { $first: "$couponApplied" },
          shippingAddress: { $first: "$shippingAddress" },
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

    // Step 2: Get total order count for pagination
    const countAgg = await Order.aggregate([
      { $unwind: { path: "$orderedItems", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$_id" } },
      { $count: "total" }
    ]);
    const totalOrders = countAgg[0]?.total || 0;
    const totalPages = Math.ceil(totalOrders / limit);

    // Step 3: Sales Summary Calculation
    let grossSales = 0;
    let totalOfferDiscount = 0;
    let totalCoupons = 0;
    let totalDiscount = 0;
    let netSales = 0;
    let totalReturns = 0;

  
    const deliveredOrders = await Order.find({"orderedItems.status": ["Delivered","Returned"]}).lean();
    deliveredOrders.forEach(order => {
      const isReturned = order.orderedItems.some(item => item.status === "Returned");

      if (!isReturned) {
        grossSales += order.totalPrice || 0;
        totalOfferDiscount += order.offerPrice || 0;
        if (order.couponApplied) {
          totalCoupons += order.discount || 0;
        }
        totalDiscount += (order.offerPrice || 0) + (order.discount || 0);
        netSales += order.finalAmount || 0;
      } else {
        totalReturns += 1;
      }
    });

    res.render("salesReport", {
      orders: ordersAggregate,
      summary: {
        grossSales: grossSales.toFixed(2),
        totalOfferDiscount: totalOfferDiscount.toFixed(2),
        totalCoupons: totalCoupons.toFixed(2),
        totalDiscount: totalDiscount.toFixed(2),
        netSales: netSales.toFixed(2),
        totalOrders,
        totalReturns
      },
      totalPages,
      currentPage: page
    });

  } catch (error) {
    console.error("Error in getSalesReport:", error);
  }
};


const filterSalesReport = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate, page = 1, limit = 10 } = req.body;
        const skip = (page - 1) * limit;
        let matchQuery = {};

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
const exportSalesReportPDF = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate } = req.body;
        let matchQuery = {};

        // Build match query (same as filterSalesReport)
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

        // Fetch all filtered orders for export
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

        // Calculate comprehensive summary
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

        // Create PDF with enhanced styling
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

        // Constants for consistent styling
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

        // Helper function to draw a box with background
        function drawBox(x, y, width, height, fillColor = null, strokeColor = null) {
            if (fillColor) {
                doc.rect(x, y, width, height).fill(fillColor);
            }
            if (strokeColor) {
                doc.rect(x, y, width, height).stroke(strokeColor);
            }
        }

        // Helper function to add page header
        function addPageHeader() {
            // Company header box
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

        // Add first page header
        addPageHeader();

        // Filter information section
        doc.fillColor(colors.text);
        let filterText = "";
        let hasFilters = false;
        
        if (dateRange && dateRange !== "custom") {
            filterText += dateRange.charAt(0).toUpperCase() + dateRange.slice(1).replace(/([A-Z])/g, ' $1');
            hasFilters = true;
        } else if (startDate && endDate) {
            filterText += `${moment(startDate).format("DD MMM YYYY")} to ${moment(endDate).format("DD MMM YYYY")}`;
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

        // Sales Summary Section
        doc.moveDown(3);
        const summaryY = doc.y;
        
        // Summary header
        drawBox(40, summaryY, doc.page.width - 80, 30, colors.secondary);
        doc.font(fonts.heading)
           .fontSize(16)
           .fillColor('white')
           .text("SALES SUMMARY", 60, summaryY + 8, { align: 'center', width: doc.page.width - 120 });

        // Summary content in a grid layout
        const summaryData = [
            ["Gross Sales", `${summary.grossSales}`, "Total Orders", summary.totalOrders],
            ["Total Discount", `${summary.totalDiscount}`, "Total Returns", summary.totalReturns],
            ["Coupons Applied", `${summary.totalCoupons}`, "Avg Order Value", `${summary.avgOrderValue}`],
            ["Net Sales", `${summary.netSales}`, ]
        ];

        let currentSummaryY = summaryY + 40;
        summaryData.forEach((row, index) => {
            const rowY = currentSummaryY + (index * 25);
            
            // Alternate row background
            if (index % 2 === 0) {
                drawBox(40, rowY, doc.page.width - 80, 25, '#f8f9fa');
            }
            
            doc.font(fonts.body).fontSize(11).fillColor(colors.text);
            
            // Left side data
            doc.text(row[0], 60, rowY + 8, { width: 140 });
            doc.font(fonts.heading).text(row[1], 200, rowY + 8, { width: 100 });
            
            // Right side data
            doc.font(fonts.body).text(row[2], 320, rowY + 8, { width: 140 });
            doc.font(fonts.heading).text(row[3], 460, rowY + 8, { width: 100 });
        });

        // Orders Table Section
        doc.moveDown(4);
        const tableStartY = currentSummaryY + 120;
        
        // Table header
        drawBox(10, tableStartY, doc.page.width - 20, 25, colors.primary);
        doc.font(fonts.heading)
           .fontSize(14)
           .fillColor('white')
           .text("ORDER DETAILS", 20, tableStartY + 6, { align: 'center', width: doc.page.width - 20 });

        // Table column setup
        const tableLeft = 10;
        const tableWidth = doc.page.width - 20;
        const headers = ["Order ID", "Date", "Customer", "Amount", "Discount", "Final Amount", "Payment", "Status"];
        const colWidths = [150, 60, 80, 60, 60, 70, 70, 80];
        
        // Ensure column widths fit the page
        const totalColWidth = colWidths.reduce((a, b) => a + b, 0);
        if (totalColWidth > tableWidth) {
            const ratio = tableWidth / totalColWidth;
            colWidths.forEach((width, i) => colWidths[i] = Math.floor(width * ratio));
        }

        // Draw table headers
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

        // Draw table rows
        let currentY = headerY + 35;
        const rowHeight = 25;
        
        ordersAggregate.forEach((order, index) => {
            // Check if we need a new page
            if (currentY > doc.page.height - 100) {
                doc.addPage();
                addPageHeader();
                currentY = 150;
                
                // Redraw table header on new page
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

            // Alternate row colors
            if (index % 2 === 0) {
                drawBox(tableLeft, currentY, tableWidth, rowHeight, '#f8f9fa');
            }

            // Draw row borders
            drawBox(tableLeft, currentY, tableWidth, rowHeight, null, '#ddd');

            doc.font(fonts.body).fontSize(9).fillColor(colors.text);
            
            const rowData = [
                order.orderId || "N/A",
                moment(order.createdAt).format("DD MMM YY"),
                (order.shippingAddress?.name || "N/A").substring(0, 15),
                `Rs${(order.totalPrice || 0).toFixed(0)}`,
                `Rs${(order.discount || 0).toFixed(0)}`,
                `Rs${(order.finalAmount || 0).toFixed(0)}`,
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

        // Footer on last page
        doc.font(fonts.small)
           .fontSize(8)
           .fillColor(colors.darkGray)
           .text(`Report generated automatically on ${moment().format("DD MMMM YYYY at hh:mm A")}`, 
                  40, doc.page.height - 50, { 
                      align: 'center', 
                      width: doc.page.width - 80 
                  });

        // Add page numbers
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.font(fonts.small)
               .fontSize(8)
               .fillColor(colors.darkGray)
               .text(`Page ${i + 1} of ${pageCount}`, 
                      doc.page.width - 100, doc.page.height - 30, {
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

const exportSalesReportExcel = async (req, res) => {
    try {
        const { search, userSearch, paymentMethod, orderStatus, dateRange, startDate, endDate } = req.body;
        let matchQuery = {};

        // Build match query (same as filterSalesReport)
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

        // Fetch all filtered orders for export
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

        const summary = {
            grossSales: grossSales.toFixed(2),
            totalDiscount: totalDiscount.toFixed(2),
            totalCoupons: totalCoupons.toFixed(2),
            netSales: netSales.toFixed(2),
            totalOrders,
            totalReturns
        };

        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Admin Dashboard';
        workbook.created = new Date();
        const worksheet = workbook.addWorksheet("Sales Report", {
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true }
        });

        // Title and metadata
        worksheet.mergeCells("A1:I1");
        const titleCell = worksheet.getCell("A1");
        titleCell.value = "Sales Report";
        titleCell.font = { name: 'Helvetica', size: 16, bold: true };
        titleCell.alignment = { horizontal: "center", vertical: "middle" };
        titleCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' } };

        worksheet.mergeCells("A2:I2");
        const dateCell = worksheet.getCell("A2");
        dateCell.value = `Generated on: ${moment().format("DD MMM YYYY, hh:mm A")}`;
        dateCell.font = { name: 'Helvetica', size: 12 };
        dateCell.alignment = { horizontal: "center", vertical: "middle" };
        dateCell.border = { bottom: { style: 'thin' } };

        // Filter info
        let filterText = "Filters Applied: ";
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
            const filterCell = worksheet.getCell("A3");
            filterCell.value = filterText;
            filterCell.font = { name: 'Helvetica', size: 10 };
            filterCell.alignment = { horizontal: "center", vertical: "middle" };
            filterCell.border = { bottom: { style: 'thin' } };
        }

        worksheet.addRow([]);

        // Summary
        const summaryHeader = worksheet.addRow(["Sales Summary"]);
        summaryHeader.font = { name: 'Helvetica', size: 12, bold: true };
        summaryHeader.alignment = { horizontal: "left" };
        worksheet.addRow(["Gross Sales", `Rs.${summary.grossSales}`]).eachCell(cell => {
            cell.font = { name: 'Helvetica', size: 11 };
            cell.border = { bottom: { style: 'thin' } };
        });
        worksheet.addRow(["Total Discount", `Rs.${summary.totalDiscount}`]).eachCell(cell => {
            cell.font = { name: 'Helvetica', size: 11 };
            cell.border = { bottom: { style: 'thin' } };
        });
        worksheet.addRow(["Coupons Applied", `Rs.${summary.totalCoupons}`]).eachCell(cell => {
            cell.font = { name: 'Helvetica', size: 11 };
            cell.border = { bottom: { style: 'thin' } };
        });
        worksheet.addRow(["Net Sales", `Rs.${summary.netSales}`]).eachCell(cell => {
            cell.font = { name: 'Helvetica', size: 11 };
            cell.border = { bottom: { style: 'thin' } };
        });
        worksheet.addRow(["Total Orders", summary.totalOrders]).eachCell(cell => {
            cell.font = { name: 'Helvetica', size: 11 };
            cell.border = { bottom: { style: 'thin' } };
        });
        worksheet.addRow(["Total Returns", summary.totalReturns]).eachCell(cell => {
            cell.font = { name: 'Helvetica', size: 11 };
            cell.border = { bottom: { style: 'thin' } };
        });
        worksheet.addRow([]);

        // Table headers
        const headerRow = worksheet.addRow([
            "Order ID",
            "Date",
            "Customer",
            "Amount",
            "Discount",
            "Coupon",
            "Final Amount",
            "Payment",
            "Status"
        ]);
        headerRow.eachCell(cell => {
            cell.font = { name: 'Helvetica', size: 10, bold: true };
            cell.alignment = { horizontal: "center", vertical: "middle" };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        // Set column widths
        worksheet.columns = [
            { key: "orderId", width: 15 },
            { key: "date", width: 12 },
            { key: "customer", width: 20 },
            { key: "amount", width: 12 },
            { key: "discount", width: 12 },
            { key: "coupon", width: 12 },
            { key: "finalAmount", width: 12 },
            { key: "payment", width: 15 },
            { key: "status", width: 15 }
        ];

        // Table rows
        ordersAggregate.forEach(order => {
            const row = worksheet.addRow({
                orderId: order.orderId || "N/A",
                date: moment(order.createdAt).format("DD MMM YY"),
                customer: order.shippingAddress?.name || "N/A",
                amount: `Rs.${(order.totalPrice || 0).toFixed(2)}`,
                discount: `Rs.${(order.discount || 0).toFixed(2)}`,
                coupon: `Rs.${(order.couponApplied ? order.discount : 0).toFixed(2)}`,
                finalAmount: `Rs.${(order.finalAmount || 0).toFixed(2)}`,
                payment: order.paymentMethod || "N/A",
                status: order.orderedItems[0]?.status || "N/A"
            });
            row.eachCell(cell => {
                cell.font = { name: 'Helvetica', size: 9 };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Write to buffer and send
        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", 'attachment; filename="sales_report.xlsx"');
        res.send(buffer);
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
