const Coupon = require("../../models/couponSchema");

const availableCoupon = async (req, res) => {
try {
  const today = new Date();

  const coupons = await Coupon.find({
    isActive: true,
    isExpired: false,
    isDeleted: false,
    validFrom: { $lte: today },
    validUpto: { $gte: today }
  }).sort({ _id: -1 });; 

 

  res.json({ coupons: coupons });

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
      usedBy: { $nin: [userId] },
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found or already used by you',
      });
    }

    if (totalAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required to use this coupon`,
      });
    }

    let discount = Number(coupon.offerPrice) || 0;
    if (discount > totalAmount) {
      discount = totalAmount;
    }

    // Apply coupon in session
    req.session.appliedCoupon = {
      couponId: coupon._id.toString(),
      couponCode: coupon.couponCode,
      discount: discount.toFixed(2),
    };

    await new Promise((resolve, reject) => {
      req.session.save(err => (err ? reject(err) : resolve()));
    });


    if (!Array.isArray(coupon.usedBy)) {
      coupon.usedBy = [];
    }

  
    await Coupon.updateOne(
      { _id: coupon._id },
      { $set: { usedBy: userId } }
    );

    res.json({
      success: true,
      couponId: coupon._id,
      couponCode: coupon.couponCode,
      discount: Number(discount.toFixed(2)),
      newTotal: Number((totalAmount - discount).toFixed(2)),
    });

  } catch (error) {
    console.error('Apply coupon error:', error);
    res.status(500).json({ success: false, message: 'Server error: Failed to apply coupon' });
  }
};

const removeCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;
    const userId = req.session.user?._id;

    if (!couponId || !req.session.appliedCoupon || req.session.appliedCoupon.couponId !== couponId) {
      return res.status(400).json({ success: false, message: 'No coupon applied or invalid coupon ID' });
    }

    req.session.appliedCoupon = null;

    await new Promise((resolve, reject) => {
      req.session.save(err => (err ? reject(err) : resolve()));
    });


    await Coupon.updateOne(
      { _id: couponId },
      { $pull: { usedBy: userId } }
    );

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