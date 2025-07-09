const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const generateInvoice = async (order, user, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
      // Enhanced validation
      const missingFields = [];
      if (!order) missingFields.push('order');
      if (!order?.orderedItems?.length) missingFields.push('orderedItems');
      if (!user?.name) missingFields.push('user.name');
      if (!order?.shippingAddress) missingFields.push('shippingAddress');
      if (!order?.finalAmount) missingFields.push('finalAmount');
      if (!order?.paymentMethod) missingFields.push('paymentMethod');

      if (missingFields.length) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // Validate output path
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Create PDF document
      const doc = new PDFDocument({ 
        margin: 40,
        size: 'A4'
      });
      
      const writeStream = fs.createWriteStream(outputPath);
      
      writeStream.on('error', (err) => {
        console.error('PDF write stream error:', err.message);
        reject(err);
      });

      writeStream.on('finish', () => {
      
        resolve();
      });

      doc.pipe(writeStream);

      // Constants and colors (unchanged)
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - (margin * 2);
      const maxPageY = pageHeight - 80;
      
      const colors = {
        primary: '#1e40af',
        secondary: '#3b82f6',
        accent: '#10b981',
        danger: '#ef4444',
        dark: '#111827',
        medium: '#4b5563',
        light: '#6b7280',
        lighter: '#9ca3af',
        background: '#f8fafc',
        border: '#e5e7eb',
        white: '#ffffff'
      };

      let currentY = 50;

      // HEADER SECTION (unchanged)
      doc
        .fontSize(28)
        .fillColor(colors.primary)
        .font('Helvetica-Bold')
        .text('LapKart Ltd.', margin, currentY);

      doc
        .fontSize(10)
        .fillColor(colors.medium)
        .font('Helvetica')
        .text('Your Trusted Technology Partner', margin, currentY + 32);

      doc
        .fontSize(32)
        .fillColor(colors.dark)
        .font('Helvetica-Bold')
        .text('INVOICE', pageWidth - margin - 140, currentY, { 
          width: 140, 
          align: 'right' 
        });

      currentY += 70;

      // COMPANY & INVOICE INFO SECTION (unchanged)
      const companyDetailsY = currentY;
      doc
        .fontSize(12)
        .fillColor(colors.primary)
        .font('Helvetica-Bold')
        .text('COMPANY INFORMATION', margin, companyDetailsY);

      currentY += 20;

      const companyDetails = [
        '123 Business Street, Techno District',
        'Malappuram, Kerala 672397, India',
        'Phone: +91 7306205956',
        'Email: support@lapkart.com',
        'Website: www.lapkart.com',
        'GST: 32XXXXX1234X1ZX | PAN: ABCDE1234F'
      ];

      companyDetails.forEach(detail => {
        doc
          .fontSize(10)
          .fillColor(colors.medium)
          .font('Helvetica')
          .text(detail, margin, currentY);
        currentY += 12;
      });

      const invoiceDetailsY = companyDetailsY;
      const rightColX = pageWidth - margin - 200;
      
      doc
        .fontSize(12)
        .fillColor(colors.primary)
        .font('Helvetica-Bold')
        .text('INVOICE DETAILS', rightColX, invoiceDetailsY);

      let invoiceDetailY = invoiceDetailsY + 20;

      const invoiceDate = order.invoiceDate || order.createdAt || new Date();
      const invoiceDetails = [
        { label: 'Invoice Number:', value: `#INV-${order.orderId || Math.random().toString(36).substr(2, 9).toUpperCase()}` },
        { label: 'Invoice Date:', value: invoiceDate.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) },
        { label: 'Due Date:', value: new Date(invoiceDate.getTime() + 30*24*60*60*1000).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }) },
        { label: 'Terms:', value: 'Net 30 Days' }
      ];

      invoiceDetails.forEach(detail => {
        doc
          .fontSize(10)
          .fillColor(colors.medium)
          .font('Helvetica-Bold')
          .text(detail.label, rightColX, invoiceDetailY, { width: 80 });
        
        doc
          .font('Helvetica')
          .fillColor(colors.dark)
          .text(detail.value, rightColX + 85, invoiceDetailY, { width: 115, align: 'right' });
        
        invoiceDetailY += 14;
      });

      currentY = Math.max(currentY, invoiceDetailY) + 30;

      doc
        .strokeColor(colors.border)
        .lineWidth(2)
        .moveTo(margin, currentY)
        .lineTo(pageWidth - margin, currentY)
        .stroke();

      currentY += 30;

      // BILLING SECTION (unchanged)
      const sectionY = currentY;
      const leftColWidth = (contentWidth - 40) / 2;
      const rightColStart = margin + leftColWidth + 40;

      doc
        .rect(margin - 10, sectionY - 5, leftColWidth + 20, 5)
        .fillAndStroke(colors.primary, colors.primary);

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(colors.primary)
        .text('BILL TO', margin, sectionY + 10);

      let billToY = sectionY + 35;

      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor(colors.dark)
        .text(user?.name || 'Customer', margin, billToY);

      billToY += 18;

      if (user?.email) {
        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor(colors.medium)
          .text(`Email: ${user.email}`, margin, billToY);
        billToY += 12;
      }

      if (order.shippingAddress?.phone) {
        doc
          .text(`Phone: ${order.shippingAddress.phone}`, margin, billToY);
        billToY += 12;
      }

      if (order.shippingAddress) {
        billToY += 5;
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(colors.medium)
          .text('SHIPPING ADDRESS:', margin, billToY);
        billToY += 15;

        const addressLines = [];
        if (order.shippingAddress.fullAddress) addressLines.push(order.shippingAddress.fullAddress);
        const cityState = [order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(', ');
        if (cityState) addressLines.push(cityState);
        if (order.shippingAddress.pincode) addressLines.push(`PIN: ${order.shippingAddress.pincode}`);

        addressLines.forEach(line => {
          doc
            .fontSize(10)
            .font('Helvetica')
            .fillColor(colors.dark)
            .text(line, margin, billToY, { width: leftColWidth - 20 });
          billToY += 12;
        });
      }

      doc
        .rect(rightColStart - 10, sectionY - 5, leftColWidth + 20, 5)
        .fillAndStroke(colors.accent, colors.accent);

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(colors.accent)
        .text('ORDER DETAILS', rightColStart, sectionY + 10);

      let orderDetailY = sectionY + 35;

      const orderDetails = [
        { label: 'Order ID:', value: order.orderId || 'N/A' },
        { label: 'Order Date:', value: invoiceDate.toLocaleDateString("en-IN") },
        { label: 'Payment Method:', value: order.paymentMethod || 'Not Specified' },
        { label: 'Status:', value: order.status || 'DELIVERED', isStatus: true }
      ];

      orderDetails.forEach(detail => {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(colors.medium)
          .text(detail.label, rightColStart, orderDetailY, { width: 90 });
        
        if (detail.isStatus) {
          const statusColor = detail.value === 'DELIVERED' ? colors.accent : colors.primary;
          doc
            .rect(rightColStart + 95, orderDetailY - 2, 75, 14)
            .fillAndStroke(statusColor, statusColor);
          
          doc
            .fontSize(8)
            .font('Helvetica-Bold')
            .fillColor(colors.white)
            .text(detail.value, rightColStart + 95, orderDetailY + 2, { 
              width: 75,
              align: 'center'
            });
        } else {
          doc
            .font('Helvetica')
            .fillColor(colors.dark)
            .text(detail.value, rightColStart + 95, orderDetailY, { width: 105, align: 'right' });
        }
        
        orderDetailY += 18;
      });

      currentY = Math.max(billToY, orderDetailY) + 40;

      // ITEMS TABLE SECTION
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .fillColor(colors.dark)
        .text('ORDER ITEMS', margin, currentY);

      currentY += 25;

      const tableY = currentY;
      const rowHeight = 45;
      const headerHeight = 40;
      
      const columns = [
        { x: margin + 5, width: Math.floor(contentWidth * 0.45), align: 'left', label: 'PRODUCT DESCRIPTION' },
        { x: margin + Math.floor(contentWidth * 0.45) + 10, width: Math.floor(contentWidth * 0.12), align: 'center', label: 'QTY' },
        { x: margin + Math.floor(contentWidth * 0.57) + 15, width: Math.floor(contentWidth * 0.21), align: 'right', label: 'UNIT PRICE' },
        { x: margin + Math.floor(contentWidth * 0.78) + 20, width: Math.floor(contentWidth * 0.22), align: 'right', label: 'TOTAL' }
      ];

      doc
        .rect(margin, currentY, contentWidth, headerHeight)
        .fillAndStroke(colors.primary, colors.primary);

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(colors.white);

      columns.forEach(col => {
        doc.text(col.label, col.x + 8, currentY + 15, { 
          width: col.width - 16, 
          align: col.align 
        });
      });

      currentY += headerHeight;

      const checkNewPage = () => {
        if (currentY > maxPageY) {
          doc.addPage();
          currentY = 50;
          
          doc
            .rect(margin, currentY, contentWidth, headerHeight)
            .fillAndStroke(colors.primary, colors.primary);

          doc
            .fontSize(11)
            .font('Helvetica-Bold')
            .fillColor(colors.white);

          columns.forEach(col => {
            doc.text(col.label, col.x + 8, currentY + 15, { 
              width: col.width - 16, 
              align: col.align 
            });
          });

          currentY += headerHeight;
        }
      };

      let subtotal = 0;
      const items = order.orderedItems || [];

      items.forEach((item, index) => {
        const product = item.product || {};
        const name = product.productName || `Product Item ${index + 1}`;
        const description = product.description || '';
        const quantity = item.quantity || 1;
        const price = item.finalPrice || 0; // Use finalPrice instead of price
        const total = price * quantity;
        subtotal += total;

        checkNewPage();

        const rowColor = index % 2 === 0 ? colors.white : colors.background;
        doc
          .rect(margin, currentY, contentWidth, rowHeight)
          .fillAndStroke(rowColor, colors.border);

        columns.slice(1).forEach(col => {
          doc
            .strokeColor(colors.border)
            .lineWidth(1)
            .moveTo(col.x, currentY)
            .lineTo(col.x, currentY + rowHeight)
            .stroke();
        });

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(colors.dark)
          .text(name, columns[0].x + 10, currentY + 10, { 
            width: columns[0].width - 20,
            lineBreak: true,
            height: 15
          });

        if (description) {
          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor(colors.light)
            .text(description.substring(0, 80) + (description.length > 80 ? '...' : ''), 
                  columns[0].x + 10, currentY + 26, { 
                width: columns[0].width - 20,
                height: 12
              });
        }

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(colors.dark)
          .text(quantity.toString(), columns[1].x + 10, currentY + 18, { 
            width: columns[1].width - 20, 
            align: 'center' 
          });

        doc
          .fontSize(10)
          .font('Helvetica')
          .fillColor(colors.dark)
          .text(`${price.toLocaleString('en-IN', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
          })}`, columns[2].x + 10, currentY + 18, { 
            width: columns[2].width - 20, 
            align: 'right' 
          });

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(colors.primary)
          .text(`${total.toLocaleString('en-IN', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
          })}`, columns[3].x + 10, currentY + 18, { 
            width: columns[3].width - 20, 
            align: 'right' 
          });

        currentY += rowHeight;
      });

      doc
        .rect(margin, currentY, contentWidth, 35)
        .fillAndStroke(colors.background, colors.border);

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(colors.primary)
        .text(`Total Items: ${items.length}`, margin + 15, currentY + 12)
        .text(`Subtotal: ${subtotal.toLocaleString('en-IN', { 
          minimumFractionDigits: 2 
        })}`, margin + 15, currentY + 12, { 
          width: contentWidth - 30, 
          align: 'right' 
        });

      currentY += 65;

      // TOTALS SECTION
      const totalsWidth = 300;
      const totalsX = pageWidth - margin - totalsWidth;
      
      const discount = order?.discount || 0;
      const shipping = order?.shippingCharges || 0;
      const taxableAmount = subtotal - discount + shipping;
      const gstRate = 0.18; // Consider making this configurable
      const gstAmount = taxableAmount * gstRate;
      const finalAmount = order?.finalAmount || (taxableAmount + gstAmount);

      doc
        .rect(totalsX - 15, currentY - 15, totalsWidth + 30, 180)
        .fillAndStroke(colors.background, colors.border);

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(colors.primary)
        .text('INVOICE SUMMARY', totalsX, currentY);

      currentY += 25;

      const totalsData = [
        { label: 'Subtotal:', value: subtotal, color: colors.dark },
        { label: 'Discount:', value: -discount, color: colors.danger },
        { label: 'Shipping & Handling:', value: shipping, color: colors.dark },
        { label: 'Taxable Amount:', value: taxableAmount, color: colors.dark },
        { label: 'GST (18%):', value: gstAmount, color: colors.medium }
      ];

      totalsData.forEach(item => {
        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor(colors.medium)
          .text(item.label, totalsX + 5, currentY, { width: 170 });
        
        doc
          .font('Helvetica')
          .fillColor(item.color)
          .text(`${Math.abs(item.value).toLocaleString('en-IN', { 
            minimumFractionDigits: 2 
          })}`, totalsX + 180, currentY, { 
            width: 115, 
            align: 'right' 
          });
        
        currentY += 20;
      });

      currentY += 10;
      doc
        .strokeColor(colors.border)
        .lineWidth(1)
        .moveTo(totalsX, currentY)
        .lineTo(totalsX + totalsWidth, currentY)
        .stroke();

      currentY += 15;
      doc
        .rect(totalsX - 5, currentY - 5, totalsWidth + 10, 35)
        .fillAndStroke(colors.primary, colors.primary);
      
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(colors.white)
        .text('TOTAL AMOUNT:', totalsX + 10, currentY + 8, { width: 180 })
        .text(`${finalAmount.toLocaleString('en-IN', { 
          minimumFractionDigits: 2 
        })}`, totalsX + 10, currentY + 8, { 
          width: totalsWidth - 20, 
          align: 'right' 
        });

      currentY += 60;

      // FOOTER SECTION (unchanged)
      doc
        .rect(margin, currentY, contentWidth, 100)
        .fillAndStroke(colors.background, colors.border);

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(colors.primary)
        .text('TERMS & CONDITIONS', margin + 20, currentY + 15);

      const terms = [
        '• Payment is due within 30 days from the invoice date',
        '• Late payments may incur additional charges of 2% per month',
        '• All returns must be made within 7 days of delivery',
        '• Goods remain the property of LapKart Ltd. until payment is received in full'
      ];

      let termY = currentY + 35;
      terms.forEach(term => {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor(colors.medium)
          .text(term, margin + 20, termY, { width: contentWidth - 40 });
        termY += 14;
      });

      currentY += 110;
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(colors.primary)
        .text('THANK YOU FOR YOUR BUSINESS!', margin + 20, currentY, { 
          width: contentWidth - 40, 
          align: 'center' 
        });

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(colors.medium)
        .text('For any queries, please contact us at support@lapkart.com or call +91 7306205956', 
             margin + 20, currentY + 25, { 
               width: contentWidth - 40, 
               align: 'center' 
             });

      doc.end();

    } catch (error) {
      console.error('Error in generateInvoice:', error.message);
      reject(error);
    }
  });
};

module.exports = generateInvoice;