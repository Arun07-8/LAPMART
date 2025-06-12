const mongoose = require("mongoose");
const { Schema } = mongoose;

const addressSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    address: [
      {
        addressType: {
          type: String,
          enum: ["Home", "Work", "Other"],
          required: true,
        },
        name: {
          type: String,
          required: true,
        },
        phone: {
          type: String,
          required: true,
        },
        altPhone: {
          type: String,
          required: false,
        },
        city: {
          type: String,
          required: true,
        },
        state: {
          type: String,
          required: true,
        },
        landmark: {
          type: String,
          required: true,
        },
        pincode: {
          type: String,
          required: true,
        },
        fullAddress:{
            type:String,
            required:true,
        },
         isDefault: { 
            type: Boolean, 
            default: false
         }
      },
    ],
  },
  {
    timestamps: true, 
  }
);

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;