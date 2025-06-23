const Coupon=require("../../models/couponSchema")

const availableCoupon= async (req, res) => {
  try {
    const userId = req.session.user;
    const today = new Date();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Login required to view coupons.' });
    }

    const coupons = await Coupon.find({
      isActive: true,
      isDeleted: false,
      validFrom: { $lte: today },
      validUpto: { $gte: today },
      usedBy: { $ne: userId } 
    }).select('couponCode couponName description offerPrice minPurchase validUpto');

    res.json({ success: true, coupons });

  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch coupons.' });
  }
}


const applyCoupon = async (req, res) => {
  try {
    const { code, totalAmount } = req.body;
    const userId = req.session.user;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Please login to apply a coupon.' });
    }


    if (req.session.appliedCoupon) {
      return res.status(400).json({ success: false, message: 'A coupon is already applied. Remove it to apply a new one.' });
    }

    const coupon = await Coupon.findOne({
      couponCode: code.toUpperCase(),
      isActive: true,
      isDeleted: false
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon.' });
    }

    const today = new Date();

    if (coupon.validFrom > today || coupon.validUpto < today) {
      return res.status(400).json({ success: false, message: 'Coupon is not valid today.' });
    }

    if (coupon.usedBy.includes(userId)) {
      return res.status(400).json({ success: false, message: 'You have already used this coupon.' });
    }

    if (totalAmount < coupon.minPurchase) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required.`
      });
    }

    req.session.appliedCoupon = {
      code: coupon.couponCode,
      type: coupon.type, 
      value: coupon.offerPrice,
      minPurchase: coupon.minPurchase,
      couponId: coupon._id
    };

    const discount = coupon.type === 'percentage'
      ? Math.floor((totalAmount * coupon.offerPrice) / 100)
      : coupon.offerPrice;

    const finalAmount = totalAmount - discount;

    return res.json({
      success: true,
      message: `Coupon applied successfully! ₹${discount} discount.`,
      discount,
      finalAmount,
      couponId: coupon._id
    });
  } catch (error) {
    console.error('Error in applyCoupon:', error);
    res.status(500).json({ success: false, message: 'Server error applying coupon.' });
  }
};



const removeCoupon= async (req, res) => {
  const { couponId } = req.body;
  try {

    if (!couponId) {
      return res.status(400).json({ success: false, message: 'Coupon ID required' });
    }

    req.session.appliedCoupon = null;
    res.json({ success: true, message: 'Coupon removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}


module.exports={availableCoupon, applyCoupon,removeCoupon}