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
    console.log('[applyCoupon] Endpoint called at:', new Date().toISOString());
    console.log('[applyCoupon] Request Body:', req.body);
    console.log('[applyCoupon] Session:', req.session);

    const { code, totalAmount } = req.body;
    const userId = req.session.user;

    if (!userId) {
      console.log('[applyCoupon] No user in session');
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    const coupon = await Coupon.findOne({
      couponCode: code.toUpperCase(),
      isActive: true,
      isDeleted: false,
      validFrom: { $lte: new Date() },
      validUpto: { $gte: new Date() },
      usedBy: { $nin: [userId] },
    });

    console.log('[applyCoupon] Coupon Query Result:', coupon);

    if (!coupon) {
      console.log('[applyCoupon] Coupon not found or invalid');
      return res.status(404).json({
        success: false,
        message: 'Coupon not found, invalid, or already used by you',
      });
    }

    if (totalAmount < coupon.minPurchase) {
      console.log('[applyCoupon] Minimum purchase not met:', { totalAmount, minPurchase: coupon.minPurchase });
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

    console.log('[applyCoupon] Saving session:', req.session.appliedCoupon);

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('[applyCoupon] Session save error:', err.stack);
          reject(err);
        } else {
          console.log('[applyCoupon] Session saved');
          resolve();
        }
      });
    });

    await Coupon.updateOne(
      { _id: req.session.appliedCoupon.couponId },
      { $addToSet: { usedBy: userId } }
    );
    console.log('[applyCoupon] Coupon updated with userId:', userId);

    res.json({
      success: true,
      couponId: coupon._id,
      couponCode: coupon.couponCode,
      discount: Number(discount.toFixed(2)),
      newTotal: Number((totalAmount - discount).toFixed(2)),
    });
  } catch (error) {
    console.error('[applyCoupon] Error:', error.stack);
    res.status(500).json({ success: false``, message: 'Server error: Failed to apply coupon' });
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