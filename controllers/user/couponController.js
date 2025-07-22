const mongoose = require("mongoose");
const Coupon = require("../../models/couponSchema");

// ✅ GET Available Coupons
const availableCoupon = async (req, res) => {
  try {
    // Ensure IST timezone
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const startOfDay = new Date(new Date(now).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(now).setHours(23, 59, 59, 999));

    // Fetch active, non-deleted coupons valid today
    const coupons = await Coupon.find({
      isDeleted: false,
      isActive: true,
      validFrom: { $lte: endOfDay },
      validUpto: { $gte: startOfDay },
    }).lean();

    console.log("IST Now:", now);
    console.log("Coupons available:", coupons);

    res.json({ success: true, coupons });
  } catch (error) {
    console.error("Load coupons error:", error);
    res.status(500).json({ success: false, message: "Failed to load coupons" });
  }
};

// ✅ APPLY Coupon
const applyCoupon = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    const userId = req.session.user;

    // Check if user logged in
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not logged in" });
    }

    // Prevent double apply
    if (req.session.appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: "A coupon is already applied. Remove it to apply a new one.",
      });
    }

    // Convert string userId to ObjectId for MongoDB
    const userObjectId = mongoose.Types.ObjectId(userId);

    // IST time handling
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const startOfDay = new Date(new Date(today).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(today).setHours(23, 59, 59, 999));

    // Find coupon
    const coupon = await Coupon.findOne({
      couponCode: code,
      isDeleted: false,
      isActive: true,
      validFrom: { $lte: endOfDay },
      validUpto: { $gte: startOfDay },
      usedBy: { $nin: [userObjectId] }, // ✅ FIXED: compare as ObjectId
    });

    console.log("Coupon match result:", coupon);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found or already used by you",
      });
    }

    if (totalAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required to use this coupon`,
      });
    }

    // Calculate discount
    let discount = Number(coupon.offerPrice) || 0;
    if (discount > totalAmount) discount = totalAmount;

    // Save to session
    req.session.appliedCoupon = {
      couponId: coupon._id.toString(),
      couponCode: coupon.couponCode,
      discount: discount.toFixed(2),
    };

    await new Promise((resolve, reject) => {
      req.session.save(err => (err ? reject(err) : resolve()));
    });

    // Mark coupon as used
    if (req.session.appliedCoupon) {
      await Coupon.updateOne(
        { _id: req.session.appliedCoupon.couponId },
        { $addToSet: { usedBy: userObjectId } }
      );
    }

    res.json({
      success: true,
      couponId: coupon._id,
      couponCode: coupon.couponCode,
      discount: Number(discount.toFixed(2)),
      newTotal: Number((totalAmount - discount).toFixed(2)),
    });

  } catch (error) {
    console.error("Apply coupon error:", error);
    res.status(500).json({ success: false, message: "Server error: Failed to apply coupon" });
  }
};

// ✅ REMOVE Coupon
const removeCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;

    if (!couponId || !req.session.appliedCoupon || req.session.appliedCoupon.couponId !== couponId) {
      return res.status(400).json({ success: false, message: "No coupon applied or invalid coupon ID" });
    }

    req.session.appliedCoupon = null;

    await new Promise((resolve, reject) => {
      req.session.save(err => (err ? reject(err) : resolve()));
    });

    res.json({ success: true, message: "Coupon removed successfully" });
  } catch (error) {
    console.error("Remove coupon error:", error);
    res.status(500).json({ success: false, message: "Failed to remove coupon" });
  }
};

module.exports = {
  availableCoupon,
  applyCoupon,
  removeCoupon,
};
