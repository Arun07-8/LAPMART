    const mongoose = require('mongoose');

    const offerSchema = new mongoose.Schema({
        offerName: {
            type: String,
            required: true
        },
        offerType: {
            type: String,
            enum: ['Product', 'Category', 'Brand'],
            required: true
        },

        applicableId: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'offerType'
        },
        discountType: {
            type: String,
            default: 'percentage',
            enum: ['percentage']
        }
        ,
        offerAmount: {
            type: Number,
            required: true
        },
        validFrom: {
            type: Date,
            required: true
        },
        validUpto: {
            type: Date,
            required: true
        },
        status: {
            type: String,
            enum: ['active', 'inactive'],
            default: 'active'
        },
        description: {
            type: String,
            required: true,
        },
        isActive:{
            type:Boolean,
            default:true,
        },

        isDeleted: {
            type: Boolean,
            default: false
        },
    }, { timestamps: true });

    module.exports = mongoose.model('Offer', offerSchema);
