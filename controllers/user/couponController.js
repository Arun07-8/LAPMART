const Coupon = require("../../models/couponSchema");

const applyCoupon = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    const userId = req.session.user;

    if (!code) {
      return res.status(400).json({ success: false, message: "No coupon code provided" });
    }

    const now = new Date(); // Use server time in UTC

    const coupon = await Coupon.findOne({
      couponCode: code,
      isDeleted: false,
      isActive: true,
      validFrom: { $lte: now },
      validUpto: { $gte: now },
    });

    if (!coupon) {
      return res.status(400).json({ success: false, message: "Invalid or expired coupon" });
    }

    if (totalAmount < coupon.minPurchase) {
      return res.status(400).json({ success: false, message: `Minimum purchase should be ₹${coupon.minPurchase}` });
    }

    const userUsed = coupon.usedBy.includes(userId);
    if (userUsed) {
      return res.status(400).json({ success: false, message: "You already used this coupon" });
    }

    // Success: return discount
    res.status(200).json({
      success: true,
      discount: coupon.offerPrice,
      message: "Coupon applied successfully",
    });

  } catch (err) {
    console.error("Apply coupon error:", err);
    res.status(500).json({ success: false, message: "Server error while applying coupon" });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;

    if (!couponId || !req.session.appliedCoupon || req.session.appliedCoupon.couponId !== couponId) {
      return res.status(400).json({ success: false, message: 'No coupon applied or invalid coupon ID' });
    }

    req.session.appliedCoupon = null;

    await new Promise((resolve, reject) => {
      req.session.save(err => (err ? reject(err) : resolve()));
    });

    res.json({ success: true, message: 'Coupon removed successfully' });
  } catch (error) {
    console.error('Remove coupon error:', error);
    res.status(500).json({ success: false, message: 'Failed to remove coupon' });
  }
};


module.exports = {
  availableCoupon,
  applyCoupon,
  removeCoupon,
};