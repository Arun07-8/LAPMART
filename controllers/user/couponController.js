const Coupon = require("../../models/couponSchema");
const { ObjectId } = require("mongoose").Types;

// 1. Get available coupons
const availableCoupon = async (req, res) => {
  try {
    const today = new Date();

    const coupons = await Coupon.find({
      isDeleted: false,
      isActive: true,
      isExpired: false,
    
    }).lean();

    console.log("Available coupons:", coupons);

    res.json({ success: true, coupons });
  } catch (error) {
    console.error("Load coupons error:", error);
    res.status(500).json({ success: false, message: "Failed to load coupons" });
  }
};

// 2. Apply a coupon
const applyCoupon = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    const userId = req.session.user;

    // Validate inputs
    if (!code || !totalAmount) {
      return res.status(400).json({ success: false, message: "Coupon code and total amount are required" });
    }

    // Validate user login
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

    // Check if a coupon is already applied
    if (req.session.appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: "A coupon is already applied. Remove it to apply a new one.",
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({
      couponCode: code.toUpperCase(), // Schema enforces uppercase
      isActive: true,
      isDeleted: false,
      isExpired: false,
      validFrom: { $lte: new Date() },
      validUpto: { $gte: new Date() },
      usedBy: { $nin: userId }, // Ensure userId is ObjectId
    });

    // Validate coupon
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found, expired, or already used by you",
      });
    }

    // Validate minimum purchase
    if (totalAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required to use this coupon`,
      });
    }

    // Calculate discount
    let discount = Number(coupon.offerPrice) || 0;
    if (discount > totalAmount) {
      discount = totalAmount; // Cap discount to total amount
    }

    // Store coupon in session
    req.session.appliedCoupon = {
      couponId: coupon._id.toString(),
      couponCode: coupon.couponCode,
      discount: discount.toFixed(2),
    };

    // Save session
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          reject(err);
        } else {
          console.log("Session saved:", req.session.appliedCoupon);
          resolve();
        }
      });
    });

    // Mark coupon as used
    await Coupon.updateOne(
      { _id: new ObjectId(coupon._id) },
      { $addToSet: { usedBy: new ObjectId(userId) } }
    );

    // Return response
    res.json({
      success: true,
      couponId: coupon._id.toString(),
      couponCode: coupon.couponCode,
      discount: Number(discount.toFixed(2)),
      newTotal: Number((totalAmount - discount).toFixed(2)),
      couponName: coupon.couponName,
      description: coupon.description,
    });
  } catch (error) {
    console.error("Apply coupon error:", error);
    res.status(500).json({ success: false, message: "Server error: Failed to apply coupon" });
  }
};

// 3. Remove applied coupon
const removeCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;

    // Validate coupon ID and session
    if (
      !couponId ||
      !req.session.appliedCoupon ||
      req.session.appliedCoupon.couponId !== couponId
    ) {
      return res.status(400).json({
        success: false,
        message: "No coupon applied or invalid coupon ID",
      });
    }

    // Clear applied coupon
    req.session.appliedCoupon = null;

    // Save session
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    res.json({ success: true, message: "Coupon removed successfully" });
  } catch (error) {
    console.error("Remove coupon error:", error);
    res.status(500).json({ success: false, message: "Failed to remove coupon" });
  }
};

// Export all functions
module.exports = {
  availableCoupon,
  applyCoupon,
  removeCoupon,
};