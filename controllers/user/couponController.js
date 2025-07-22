const Coupon = require('../models/couponSchema');

const availableCoupon = async (req, res) => {
  try {
    const today = new Date();
    console.log('Server Date Now:', today);

    const coupons = await Coupon.find({
      isDeleted: false,
      isActive: true,
      validFrom: { $lte: today },
      validUpto: { $gte: today },
    }).lean();

    console.log('Coupons:', coupons);
    res.json({ success: true, coupons });
  } catch (error) {
    console.error('Load coupons error:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to load coupons' });
  }
};

const applyCoupon = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    const userId = req.session.user;

    console.log('Apply Coupon Input:', { code, totalAmount, userId });

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
        message: 'Coupon not found, invalid, or already used by you',
      });
    }

    if (totalAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required`,
      });
    }

    let discount = Number(coupon.offerPrice) || 0;
    if (discount > totalAmount) {
      discount = totalAmount;
    }

    req.session.appliedCoupon = {
      couponId: coupon._id.toString(),
      couponCode: coupon.couponCode,
      discount: discount.toFixed(2),
    };

    await new Promise((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    if (req.session.appliedCoupon) {
      await Coupon.updateOne(
        { _id: req.session.appliedCoupon.couponId },
        { $addToSet: { usedBy: userId } }
      );
      console.log('Coupon applied and updated:', req.session.appliedCoupon);
    }

    res.json({
      success: true,
      couponId: coupon._id,
      couponCode: coupon.couponCode,
      discount: Number(discount.toFixed(2)),
      newTotal: Number((totalAmount - discount).toFixed(2)),
    });
  } catch (error) {
    console.error('Apply coupon error:', error.stack);
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
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    res.json({ success: true, message: 'Coupon removed successfully' });
  } catch (error) {
    console.error('Remove coupon error:', error.stack);
    res.status(500).json({ success: false, message: 'Failed to remove coupon' });
  }
};

module.exports = {
  availableCoupon,
  applyCoupon,
  removeCoupon,
};