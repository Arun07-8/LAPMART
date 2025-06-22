
const Coupon = require('../models/couponSchema');

const validateCoupon = async (code, userId, totalAmount) => {
    try {

        const coupon = await Coupon.findOne({ couponCode: code.trim().toUpperCase(), isActive: true, isDeleted: false });

        if (!coupon) {
            return { success: false, message: "Invalid or inactive coupon code" };
        }

        const currentDate = new Date();

        if (currentDate < coupon.validFrom) {
            return { success: false, message: "Coupon is not active yet" };
        }

        if (currentDate > coupon.validUpto) {
            return { success: false, message: "Coupon has expired" };
        }


        if (coupon.usedBy.includes(userId)) {
            return { success: false, message: "You have already used this coupon" };
        }

        if (totalAmount < coupon.minPurchase) {
            return {
                success: false,
                message: `Minimum purchase of ₹${coupon.minPurchase} is required to use this coupon`
            };
        }


        if (coupon.offerPrice <= 0) {
            return {
                success: false,
                message: "Coupon offer value is invalid"
            };
        }

        if (coupon.offerPrice >= totalAmount) {
            return {
                success: false,
                message: "Coupon discount cannot exceed or equal the total purchase amount"
            };
        }


        const discount = coupon.offerPrice;
        const finalAmount = totalAmount - discount;

        return {
            success: true,
            message: "Coupon applied successfully",
            discount,
            finalAmount,
            couponId: coupon._id
        };

    } catch (error) {
        console.error("Coupon validation error:", error);
        return { success: false, message: "Something went wrong while validating coupon" };
    }
};

module.exports = validateCoupon;
