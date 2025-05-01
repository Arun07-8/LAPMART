// models/productSchema.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    brand: {
        type: Schema.Types.ObjectId,
        ref:"Brand",
        required: true,
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category",
        required: true,
    },
    regularPrice: {
        type: Number,
        required: true,
    },
    salePrice: {
        type: Number,
        required: true,
    },
    quantity: {
        type: Number,
        default: 0,
    },
    productImage: {
        type: [String],
        required: true,
    },
    isListed: {
        type: Boolean,
        default: true,
    },
    status: {
        type: String,
        enum: ["Available", "out of stock", "Discontinued"],
        required: true,
        default: "Available",
    },
    processor: {
        type: String,
        required: true,
    },
    graphicsCard: {
        type: String,
        required: true,
    },
    ram: {
        type: String,
        required: true,
    },
    Storage: {
        type: String,
        required: true,
    },
    display: {
        type: String,
        required: true,
    },
    operatingSystem: {
        type: String,
        required: true,
    },
    Battery: {
        type: String,
        required: true,
    },
    Weight: {
        type: String,
        required: true,
    },
    Warranty: {
        type: String,
        required:true,
    },
    additionalFeatures:{
        type:String,
        required:true
    },
    isDeleted:{
        type:Boolean,
        default:true,
    }
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);  