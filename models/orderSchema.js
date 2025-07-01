const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
  userId: {                        
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderId: {
    type: String,
    default: () => `ORD_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`,
    unique: true,
  },
  orderedItems: [{
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    originalPrice: {           
      type: Number,
      required: true,
    },
    finalPrice: {              
      type: Number,
      required: true,
    },
    offerDiscount: {           
      type: Number,
      default: 0
    },
    subtotal: {                
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: [
        "Pending", "Shipped", "Delivered",
        "Cancelled", "Return Requested", "Returned", "Return Rejected","Payment Failed"
      ],
      default: "Pending",
      required: true
    },
    isCancelled: {
      type: Boolean,
      default: false,
    },
    cancelReason: {
      type: String,
      default: '',
    },
    additionalNote: {
      type: String,
      default: '', 
    },
    isReturned: {
      type: Boolean,
      default: false,
    },
    returnReason: {
      type: String,
      default: '', 
    },
  }],
  totalPrice: {
    type: Number,
    required: true,
  },
  offerPrice: {               
    type: Number,
    default: 0,
  },
  discount: {                  
    type: Number,
    default: 0,
  },
  finalAmount: {               
    type: Number,
    required: true,
  },
  paymentStatus: {                   
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  shippingAddress: {
    addressType: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    altPhone: { type: String },
    city: { type: String, required: true },
    state: { type: String, required: true },
    landmark: { type: String, required: true },
    pincode: { type: String, required: true },
    fullAddress: { type: String, required: true },
    isDefault: { type: Boolean, default: false } 
  },
  invoiceDate: {
    type: Date,
  },
  paymentMethod: {
    type: String,
    enum: ["Cash on Delivery", "Razorpay", "Wallet"],
    required: true
  },
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  couponApplied: {
    type: Boolean,
    default: false,
  },
  isCancelled: {
    type: Boolean,
    default: false,
  },
  cancelReason: {
    type: String,
    default: '', 
  },
  additionalNote: {
    type: String,
    default: '', 
  },
}, {
  timestamps: true 
});

const Order = mongoose.model("Order", orderSchema);
module.exports = Order;
