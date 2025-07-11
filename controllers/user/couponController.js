const Coupon = require("../../models/couponSchema");



const availableCoupon = async (req, res) => {
  try {
    const today = new Date();
    const coupons = await Coupon.find({
      isDeleted: false,
      isActive: true,
      validFrom: { $lte: today },
      validUpto: { $gte: today },
    }).lean();


    res.json({ success: true, coupons });
  } catch (error) {
    console.error('Load coupons error:', error);
    res.status(500).json({ success: false, message: 'Failed to load coupons' });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

 
    if (req.session.appliedCoupon) {
      return res.status(400).json({
        success: false,
        message: 'A coupon is already applied. Remove it to apply a new one.',
      });
    }

    const coupon = await Coupon.findOne({
      couponCode: code.toUpperCase(),
      isActive: true,
      isDeleted: false,
      validFrom: { $lte: new Date() },
      validUpto: { $gte: new Date() },
      usedBy: { $nin: [userId] },
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon code is invalid, expired, or already used by you',
      });
    }

    if (totalAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required to use this coupon`,
      });
    }

    let discount = coupon.type === 'percentage'
      ? Math.floor((totalAmount * coupon.offerPrice) / 100)
      : coupon.offerPrice;

    if (coupon.type === 'percentage' && coupon.maxAmount && discount > coupon.maxAmount) {
      discount = coupon.maxAmount;
    }

    if (discount > totalAmount) {
      discount = totalAmount;
    }

    req.session.appliedCoupon = {
      couponId: coupon._id.toString(),
      couponCode: coupon.couponCode,
      discount,
    };

    await new Promise((resolve, reject) => {
      req.session.save(err => (err ? reject(err) : resolve()));
    });

    res.json({
      success: true,
      couponId: coupon._id,
      couponCode: coupon.couponCode,
      discount,
      newTotal: totalAmount - discount,
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error: Failed to apply coupon' });
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

const markCouponAsUsed = async (userId, couponId) => {
  try {
    if (!couponId) return;
    await Coupon.findByIdAndUpdate(couponId, {
      $addToSet: { usedBy: userId },
    });
  } catch (err) {
    console.error('Error marking coupon as used:', err);
  }
};


module.exports = {
  availableCoupon,
  applyCoupon,
  removeCoupon,
  markCouponAsUsed,
};