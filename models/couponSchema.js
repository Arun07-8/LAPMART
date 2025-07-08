const mongoose = require("mongoose");
const { Schema } = mongoose;

const couponSchema = new Schema({
  couponName: {
    type: String,
    required: true,
    trim: true
  },
  couponCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    default: "",
    trim: true
  },
  minPurchase: {
    type: Number,
    required: true,
    min: 0
  },
  offerPrice: {
    type: Number,
    required: true,
    min: 0
  },
   validFrom: {
    type: Date,
    required: true
  },
  validUpto: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isExpired:{
    type:Boolean,
    default:false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  usedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }]
});
const Coupon = mongoose.model("Coupon", couponSchema);
module.exports = Coupon;
