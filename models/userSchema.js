    const mongoose = require("mongoose");
    const { Schema } = mongoose;

    const userSchema = new Schema({
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
         
        },
        profileImage: {
            type: [String],
            required: true,
        },
        phoneNumber: {
            type: String,
            default: null
        },
        googleid: {
            type: String,
            sparse: true
        },
        password: {
            type: String,
            required: false,
        },
        isBlocked: {
            type: Boolean,
            default: false
        },
        isadmin: {
            type: Boolean,
            default: false
        },
        cart: [{
            type: Schema.Types.ObjectId,
            ref: "Cart",
        }],
        wallet: {
            type: Schema.Types.ObjectId,
            ref: 'Wallet'
        },
        wishlist: [{
            type: Schema.Types.ObjectId,
            ref: "Wishlist"
        }],
        referralCode: { // Fixed typo from 'referalCode'
            type: String,
            
        },
        redeemed: {
            type: Boolean,
            default: false
        }
        ,
        redeemedUsers: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
        referredBy: { 
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null
        },
        referralStatus: [{ 
            userId: { type: Schema.Types.ObjectId, ref: "User" },
            status: { type: String, enum: ["Pending", "Completed", "Cancelled"], default: "Pending" },
        }],
        firstOrder: { type: Boolean, default: true },
        // searchHistory: [{
        //     category: {
        //         type: Schema.Types.ObjectId,
        //         ref: "Category",
        //     },
        //     brand: {
        //         type: String
        //     },
        //     searchOn: {
        //         type: Date,
        //         default: Date.now
        //     }
        // }]
    }, { timestamps: true });

    const User = mongoose.model("User", userSchema);
    module.exports = User;