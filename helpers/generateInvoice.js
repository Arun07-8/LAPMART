
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const generateInvoice = async (order, user, outputPath) => {
  return new Promise((resolve, reject) => {
    try {
    
      
      // Validation
      const missingFields = [];
      if (!order) missingFields.push('order');
      if (!order?.orderedItems?.length) missingFields.push('orderedItems');
      if (!user?.name) missingFields.push('user.name');
      if (!order?.shippingAddress) missingFields.push('shippingAddress');

      if (missingFields.length) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      const doc = new PDFDocument({ 
        margin: 50,
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

      // PAGE CONSTANTS
      const pageWidth = 598.280; 
      const pageHeight = 841.89; 
      const margin = 50;
      const contentWidth = pageWidth - (margin * 2);
      
      // COLORS
      const primaryColor = '#2563eb';
      const textDark = '#1f2937';
      const textMedium = '#4b5563';
      const textLight = '#6b7280';
      const bgLight = '#f8fafc';
      const borderColor = '#e5e7eb';

  
      let currentY = 60;
      

      doc
        .fontSize(32)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text('LapKart Ltd.', margin, currentY);


      const invoiceDate = order.createdAt || new Date();
      doc
        .fontSize(24)
        .fillColor(textDark)
        .font('Helvetica-Bold')
        .text('INVOICE', pageWidth - margin - 120, currentY, { 
          width: 120, 
          align: 'right' 
        });

      currentY += 45;

      // Company Details - Left side
      doc
        .fontSize(10)
        .fillColor(textMedium)
        .font('Helvetica')
        .text('123 Business Street, Techno District', margin, currentY)
        .text('Malappuram, Kerala 672397', margin, currentY + 12)
        .text('Phone: +91 7306205956', margin, currentY + 24)
        .text('Email: lapkart@yourcompany.com', margin, currentY + 36)
        .text('GST: 27XXXXX1234X1ZX | PAN: ABCDE1234F', margin, currentY + 48);

      // Invoice Details - Right side
      const rightColX = pageWidth - margin - 180;
      doc
        .fontSize(11)
        .fillColor(textDark)
        .font('Helvetica-Bold')
        .text('Invoice Number:', rightColX, currentY, { width: 90 })
        .font('Helvetica')
        .text(`#INV-${order.orderId || 'N/A'}`, rightColX + 49, currentY, { 
          width: 200, 
          align: 'right' 
        });

      doc
        .font('Helvetica-Bold')
        .text('Invoice Date:', rightColX, currentY + 15, { width: 100 })
        .font('Helvetica')
        .text(new Date(invoiceDate).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short", 
          day: "numeric"
        }), rightColX + 100, currentY + 15, { 
          width: 80, 
          align: 'right' 
        });

      const dueDate = new Date(new Date(invoiceDate).getTime() + 30*24*60*60*1000);
      doc
        .font('Helvetica-Bold')
        .text('Due Date:', rightColX, currentY + 30, { width: 100 })
        .font('Helvetica')
        .text(dueDate.toLocaleDateString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric"
        }), rightColX + 100, currentY + 30, { 
          width: 80, 
          align: 'right' 
        });

      currentY += 90;

      // Divider line
      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(margin, currentY)
        .lineTo(pageWidth - margin, currentY)
        .stroke();

      currentY += 30;

      const leftColWidth = (contentWidth - 40) / 2;
      const rightColStart = margin + leftColWidth + 40;

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('BILL TO', margin, currentY);

      currentY += 20;

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text(user?.name || 'Customer', margin, currentY);

      currentY += 15;

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(textMedium)
        .text(user?.email || 'N/A', margin, currentY);

      currentY += 12;

      if (order.shippingAddress?.phone) {
        doc.text(order.shippingAddress.phone, margin, currentY);
        currentY += 12;
      }

      // Shipping Address
      if (order.shippingAddress) {
        if (order.shippingAddress.address) {
          doc.text(order.shippingAddress.address, margin, currentY, { 
            width: leftColWidth - 20 
          });
          currentY += 15;
        }
        
        const cityStateText = [
          order.shippingAddress.city,
          order.shippingAddress.state
        ].filter(Boolean).join(', ');
        
        if (cityStateText) {
          doc.text(cityStateText, margin, currentY);
          currentY += 12;
        }
        
        if (order.shippingAddress.pincode) {
          doc.text(`PIN: ${order.shippingAddress.pincode}`, margin, currentY);
        }
      }


      const detailsStartY = currentY - 80; 
      
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('ORDER DETAILS', rightColStart, detailsStartY);

      let detailY = detailsStartY + 25;

      const orderDetails = [
        { label: 'Order ID:', value: order.orderId || 'N/A' },
        { label: 'Order Date:', value: new Date(invoiceDate).toLocaleDateString("en-IN") },
        { label: 'Payment Method:', value: order.paymentMethod || 'Not Specified' },
        { label: 'Order Status:', value: 'DELIVERED', isStatus: true }
      ];

      orderDetails.forEach(detail => {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor(textMedium)
          .text(detail.label, rightColStart, detailY, { width: 100 });
        
        // Special styling for status
        if (detail.isStatus) {
          // Add status badge background
          const statusWidth = 80;
          doc
            .rect(rightColStart + 100, detailY - 3, statusWidth, 16)
            .fillAndStroke('#dcfce7', '#16a34a');
          
          doc
            .fontSize(9)
            .font('Helvetica-Bold')
            .fillColor('#16a34a')
            .text(detail.value, rightColStart + 100, detailY + 2, { 
              width: statusWidth,
              align: 'center'
            });
        } else {
          doc
            .font('Helvetica')
            .fillColor(textDark)
            .text(detail.value, rightColStart + 100, detailY, { 
              width: leftColWidth - 100 
            });
        }
        
        detailY += 18;
      });

      currentY = Math.max(currentY, detailY) + 40;


      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text('ORDER ITEMS', margin, currentY);

      currentY += 30;

      const tableStartY = currentY;
      const minRowHeight = 50;
      const headerHeight = 50;
      

      const tableMargin = margin + 10;
      const availableWidth = contentWidth - 20;
      
      const col1X = tableMargin;                           
      const col1Width = Math.floor(availableWidth * 0.50); 
      const col2X = col1X + col1Width;                     
      const col2Width = Math.floor(availableWidth * 0.15);
      const col3X = col2X + col2Width;                     
      const col3Width = Math.floor(availableWidth * 0.175);
      const col4X = col3X + col3Width;                    
      const col4Width = availableWidth - col1Width - col2Width - col3Width; 


      doc
        .rect(margin, currentY, contentWidth, headerHeight)
        .fillAndStroke(primaryColor, primaryColor);

    
      doc
        .rect(margin + 2, currentY + 2, contentWidth, headerHeight)
        .fillAndStroke('#1e40af', '#1e40af');
      
      doc
        .rect(margin, currentY, contentWidth, headerHeight)
        .fillAndStroke(primaryColor, primaryColor);

      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor('white');

     
      doc.text('PRODUCT DESCRIPTION', col1X + 8, currentY + 18, { 
        width: col1Width - 16, 
        align: 'left' 
      });
      
      doc.text('QTY', col2X + 8, currentY + 18, { 
        width: col2Width - 16, 
        align: 'center' 
      });
      
      doc.text('UNIT PRICE', col3X + 8, currentY + 18, { 
        width: col3Width - 16, 
        align: 'center' 
      });
      
      doc.text('TOTAL AMOUNT', col4X + 8, currentY + 18, { 
        width: col4Width - 16, 
        align: 'center' 
      });

      currentY += headerHeight;

    
      let subtotal = 0;
      const items = order.orderedItems || [];

      items.forEach((item, index) => {
        const product = item.product || {};
        const name = product.productName || `Product Item ${index + 1}`;
        const description = product.description || '';
        const quantity = item.quantity || 1;
        const price = item.price || 0;
        const total = price * quantity;
        subtotal += total;

        const maxNameLength = Math.floor(col1Width / 6); 
        const nameLines = Math.ceil(name.length / maxNameLength);
        const dynamicRowHeight = Math.max(minRowHeight, nameLines * 15 + 20);

  
        const rowColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
        const borderColor2 = index % 2 === 0 ? '#e5e7eb' : '#d1d5db';
        
        doc
          .rect(margin, currentY, contentWidth, dynamicRowHeight)
          .fillAndStroke(rowColor, borderColor2);

      
        doc
          .strokeColor('#d1d5db')
          .lineWidth(1)
          .moveTo(col2X, currentY)
          .lineTo(col2X, currentY + dynamicRowHeight)
          .stroke()
          .moveTo(col3X, currentY)
          .lineTo(col3X, currentY + dynamicRowHeight)
          .stroke()
          .moveTo(col4X, currentY)
          .lineTo(col4X, currentY + dynamicRowHeight)
          .stroke();


        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor(textDark);

       
        const productY = currentY + 10;
        doc.text(name, col1X + 8, productY, { 
          width: col1Width - 16,
          align: 'left',
          lineBreak: true,
          height: dynamicRowHeight - 20
        });

        if (description && description.length > 0) {
          doc
            .fontSize(9)
            .font('Helvetica')
            .fillColor(textLight)
            .text(description.substring(0, 100) + (description.length > 100 ? '...' : ''), 
                  col1X + 8, productY + 15, { 
              width: col1Width - 16,
              align: 'left'
            });
        }

        
        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor(textDark)
          .text(quantity.toString(), col2X + 8, currentY + Math.floor(dynamicRowHeight/2) - 6, { 
            width: col2Width - 16, 
            align: 'center' 
          });

        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor(textDark)
          .text(`${price.toLocaleString('en-IN', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
          })}`, col3X + 8, currentY + Math.floor(dynamicRowHeight/2) - 6, { 
            width: col3Width - 16, 
            align: 'right' 
          });

        doc
          .fontSize(12)
          .font('Helvetica-Bold')
          .fillColor(primaryColor)
          .text(`${total.toLocaleString('en-IN', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
          })}`, col4X + 8, currentY + Math.floor(dynamicRowHeight/2) - 6, { 
            width: col4Width - 16, 
            align: 'right' 
          });

        currentY += dynamicRowHeight;
      });

      // Enhanced empty state
      if (items.length === 0) {
        const emptyRowHeight = 60;
        doc
          .rect(margin, currentY, contentWidth, emptyRowHeight)
          .fillAndStroke('#f9fafb', borderColor);
        
        doc
          .fontSize(14)
          .font('Helvetica')
          .fillColor(textLight)
          .text('📦 No items found in this order', margin, currentY + 20, { 
            width: contentWidth, 
            align: 'center' 
          });
        
        currentY += emptyRowHeight;
      }

      // Professional table footer with summary
      doc
        .rect(margin, currentY, contentWidth, 35)
        .fillAndStroke('#f1f5f9', primaryColor);

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text(`Total Items: ${items.length}`, col1X + 8, currentY + 12, { 
          width: col1Width + col2Width - 16, 
          align: 'left' 
        })
        .text(`Subtotal: ${subtotal.toLocaleString('en-IN', { 
          minimumFractionDigits: 2 
        })}`, col3X + 8, currentY + 12, { 
          width: col3Width + col4Width - 16, 
          align: 'right' 
        });

      currentY += 35;

      currentY += 30;

      // =================
      // TOTALS SECTION
      // =================
      const totalsWidth = 280;
      const totalsX = pageWidth - margin - totalsWidth;
      
      // Calculate totals
      const discount = order?.discount || 0;
      const shipping = 0;
      const finalAmount = order?.finalAmount || subtotal;
      const gstRate = 0.18;
      const gstAmount = (finalAmount * gstRate / (1 + gstRate));

      // Totals background with border
      doc
        .rect(totalsX - 20, currentY - 15, totalsWidth + 40, 160)
        .fillAndStroke('#f8fafc', borderColor);

      const totalsData = [
        { label: 'Subtotal:', value: `${subtotal.toFixed(2)}`, bold: false },
        { label: 'Shipping & Handling:', value: `${shipping.toFixed(2)}`, bold: false },
        { label: 'Discount Applied:', value: `-${discount.toFixed(2)}`, bold: false },
        { label: 'GST (18%):', value: `${gstAmount.toFixed(2)}`, bold: false }
      ];

      let totalY = currentY;
      
      totalsData.forEach(item => {
        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor(textMedium)
          .text(item.label, totalsX, totalY, { width: 180, align: 'left' });
        
        doc
          .font(item.bold ? 'Helvetica-Bold' : 'Helvetica')
          .fillColor(textDark)
          .text(item.value, totalsX + 180, totalY, { 
            width: 100, 
            align: 'right' 
          });
        
        totalY += 20;
      });

      // Divider line
      totalY += 10;
      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(totalsX, totalY)
        .lineTo(totalsX + totalsWidth, totalY)
        .stroke();

      // Final total with emphasis
      totalY += 15;
      doc
        .rect(totalsX - 10, totalY - 8, totalsWidth + 20, 35)
        .fillAndStroke('#e3f2fd', primaryColor);
      
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor(primaryColor)
        .text('TOTAL AMOUNT DUE:', totalsX, totalY + 5, { width: 180, align: 'left' });
      
      doc
        .fontSize(16)
        .fillColor(primaryColor)
        .text(`${finalAmount.toFixed(2)}`, totalsX + 180, totalY + 5, { 
          width: 100, 
          align: 'right' 
        });

      currentY = totalY + 60;

      // =================
      // FOOTER SECTION
      // =================
      doc
        .rect(margin, currentY, contentWidth, 80)
        .fillAndStroke(bgLight, borderColor);

      currentY += 15;

      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text('PAYMENT TERMS:', margin + 15, currentY);
      
      doc
        .font('Helvetica')
        .fillColor(textMedium)
        .text('Payment due within 30 days from invoice date. Late payments may incur additional charges.', 
             margin + 15, currentY + 15, { 
               width: contentWidth - 30 
             });

      currentY += 35;

      doc
        .font('Helvetica-Bold')
        .fillColor(textDark)
        .text('THANK YOU FOR YOUR BUSINESS!', margin + 15, currentY);
      
      doc
        .font('Helvetica')
        .fillColor(textMedium)
        .text('For any queries, please contact us at support@lapkart.com or call +91 7306205956', 
             margin + 15, currentY + 12, { 
               width: contentWidth - 30 
             });

      // Finalize PDF
      doc.end();

    } catch (error) {
      console.error('Error in generateInvoice:', error.message);
      reject(error);
    }
  });
};

module.exports = generateInvoice;