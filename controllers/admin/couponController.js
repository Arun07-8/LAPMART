const Coupon = require("../../models/couponSchema");
const moment = require('moment');
const { distance } = require('fastest-levenshtein');



const couponManagementpage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;

    const searchQuery = req.query.search ? req.query.search.trim() : '';
    const fromDate = req.query.fromDate ? moment(req.query.fromDate, 'DD/MM/YY', true) : null;
    const toDate = req.query.toDate ? moment(req.query.toDate, 'DD/MM/YY', true) : null;

 


    if (fromDate && !fromDate.isValid()) {
      return res.render('couponManagement', {
        coupons: [],
        currentPage: page,
        totalPages: 0,
        searchQuery,
        fromDate: req.query.fromDate || '',
        toDate: req.query.toDate || '',
        sortType: req.query.sort || 'date-new-to-old',
        errorMessage: 'Invalid From Date format. Please use DD/MM/YY.',
      });
    }
    if (toDate && !toDate.isValid()) {
      return res.render('couponManagement', {
        coupons: [],
        currentPage: page,
        totalPages: 0,
        searchQuery,
        fromDate: req.query.fromDate || '',
        toDate: req.query.toDate || '',
        sortType: req.query.sort || 'date-new-to-old',
        errorMessage: 'Invalid To Date format. Please use DD/MM/YY.',
      });
    }

    let query = { isDeleted: false };

    if (searchQuery) {
      query.$or = [
        { couponName: { $regex: searchQuery, $options: 'i' } },
        { couponCode: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    if (fromDate && toDate) {
      const start = moment.min(fromDate, toDate).startOf('day');
      const end = moment.max(fromDate, toDate).endOf('day');

      query.$and = [
        { validFrom: { $lte: end.toDate() } },    
        { validUpto: { $gte: start.toDate() } },  
      ];
    } else if (fromDate) {
      const start = fromDate.startOf('day');
      query.validUpto = { $gte: start.toDate() }; 
    } else if (toDate) {
      const end = toDate.endOf('day');
      query.validFrom = { $lte: end.toDate() };  
    }

    let sortQuery = {};
    switch (req.query.sort) {
      case 'date-old-to-new': sortQuery = { validFrom: 1 }; break;
      case 'date-new-to-old': sortQuery = { validFrom: -1 }; break;
      case 'name-a-to-z': sortQuery = { couponName: 1 }; break;
      case 'name-z-to-a': sortQuery = { couponName: -1 }; break;
      case 'price-high-to-low': sortQuery = { offerPrice: -1 }; break;
      case 'price-low-to-high': sortQuery = { offerPrice: 1 }; break;
      default: sortQuery = { validFrom: -1 };
    }


    const coupons = await Coupon.find(query).sort(sortQuery).skip(skip).limit(limit).lean();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    coupons.forEach(coupon => {
      const endDate = new Date(coupon.validUpto);
      endDate.setHours(0, 0, 0, 0);
      coupon.isExpired = endDate < todayDate;
    });

    // Pagination
    const totalCoupons = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(totalCoupons / limit);

    // Render response
    res.render('couponManagement', {
      coupons,
      currentPage: page,
      totalPages,
      searchQuery,
      fromDate: req.query.fromDate || '',
      toDate: req.query.toDate || '',
      sortType: req.query.sort || 'date-new-to-old',
      errorMessage:
        totalCoupons === 0 && (searchQuery || fromDate || toDate)
          ? 'No coupons found for the selected filters'
          : null,
    });

  } catch (err) {
    console.error('Coupon Management Error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};

const addCouponpage = async (req, res) => {
  try {
    res.render("addCoupon");
  } catch (error) {
    console.error("Add Coupon Page Error:", error);
    res.redirect("/admin/pagenotFounderror");
  }
};


const normalize = (str) => str.trim().toLowerCase().replace(/\s+/g, ' ');
const addnewCoupon = async (req, res) => {
  try {
    const { couponName, couponCode, description, createdDate, expiryDate, offerPrice, minPurchase } = req.body;

    if (!couponName || !couponCode || !description || !createdDate || !expiryDate || !offerPrice || !minPurchase) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    if (couponName.toUpperCase() === couponCode.toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Coupon name and code cannot be same' });
    }

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(expiryDate)) {
      return res.status(400).json({ message: "Expiry date must be in dd/mm/yyyy format" });
    }

    const parseDate = (str) => {
      const [d, m, y] = str.split('/').map(Number);
      return new Date(y, m - 1, d);
    };

    const validFrom = parseDate(createdDate);
    const validUpto = parseDate(expiryDate);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (validFrom < today) {
      return res.status(400).json({ success: false, message: 'Created date cannot be in the past' });
    }

    if (validUpto <= validFrom) {
      return res.status(400).json({ success: false, message: 'Expiry date must be after created date' });
    }

    if (offerPrice <= 1000 || isNaN(offerPrice)) {
      return res.status(400).json({ success: false, message: 'Discount must be greater than ₹1000' });
    }

    const allCoupons = await Coupon.find({ isDeleted: false });
    const inputName = normalize(couponName);
    const inputCode = normalize(couponCode);

    const similarCoupon = allCoupons.find(c => {
      const nameDist = distance(inputName, normalize(c.couponName));
      const codeDist = distance(inputCode, normalize(c.couponCode));
      const nameSim = 1 - nameDist / Math.max(inputName.length, normalize(c.couponName).length);
      const codeSim = 1 - codeDist / Math.max(inputCode.length, normalize(c.couponCode).length);
      return nameSim > 0.8 || codeSim > 0.9;
    });

    if (similarCoupon) {
      return res.status(400).json({
        success: false,
        message: `A similar coupon exists: "${similarCoupon.couponName}" (${similarCoupon.couponCode})`
      });
    }

    if (parseFloat(offerPrice) > parseFloat(minPurchase) * 0.3) {
      return res.status(400).json({
        success: false,
        message: `Coupon cannot exceed 30% of min purchase (₹${(minPurchase * 0.3).toFixed(2)})`
      });
    }

    const newCoupon = new Coupon({
      couponName: couponName.trim(),
      couponCode: couponCode.trim().toUpperCase(),
      description: description.trim(),
      validFrom,
      validUpto,
      offerPrice: parseFloat(offerPrice),
      minPurchase: parseFloat(minPurchase),
      isDeleted: false,
      status: 'active',
      isActive: true,
      createdOn: new Date()
    });

    await newCoupon.save();
    return res.status(201).json({ success: true, message: "Coupon created successfully" });

  } catch (error) {
    console.error("Coupon Add Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const activeCoupon = async (req, res) => {
  try {
    await Coupon.updateOne({ _id: req.params.id }, { $set: { isActive: true } });
    res.status(200).json({ success: true, message: "Coupon activated" });
  } catch (error) {
    console.error("Activate Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
};
const inactiveCoupon = async (req, res) => {
  try {
    await Coupon.updateOne({ _id: req.params.id }, { $set: { isActive: false } });
    res.status(200).json({ success: true, message: "Coupon deactivated" });
  } catch (error) {
    console.error("Deactivate Error:", error);
    res.status(500).json({ error: 'Server error' });
  }
};


const editCoupon = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.couponId).lean();
    res.render("editCoupon", { coupon });
  } catch (error) {
    console.error("Edit Load Error:", error);
    res.redirect("/admin/pagenotFounderror");
  }
};
const editpageCoupon = async (req, res) => {
  try {
    const {
      couponName,
      couponCode,
      description,
      validFrom, 
      validUpto,  
      offerPrice,
      minPurchase
    } = req.body;

    const couponID = req.params.couponId;


    if (!couponName || !couponCode || !description || !validFrom || !validUpto || !offerPrice || !minPurchase) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }


    function parseDMY(dateStr) {
      if (!dateStr) return new Date('Invalid');
      const [day, month, year] = dateStr.split('/');
      return new Date(`${year}-${month}-${day}`);
    }

    const createdDate = parseDMY(validFrom);
    const expiryDate = parseDMY(validUpto);


    if (isNaN(createdDate.getTime()) || isNaN(expiryDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use DD/MM/YYYY." });
    }

    if (expiryDate <= createdDate) {
      return res.status(400).json({ success: false, message: "Expiry date must be after created date." });
    }

    const couponExists = await Coupon.findById(couponID);
    if (!couponExists) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

  
    const existing = await Coupon.findOne({ couponCode, _id: { $ne: couponID } });
    if (existing) {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }

 
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponID,
      {
        couponName,
        couponCode,
        description,
        validFrom: createdDate,
        validUpto: expiryDate,
        offerPrice: parseFloat(offerPrice),
        minPurchase: parseFloat(minPurchase),
        updatedAt: new Date()
      },
      { new: true }
    );

    return res.status(200).json({ success: true, message: "Coupon updated", data: updatedCoupon });

  } catch (error) {
    console.error("Coupon Update Error:", error);
    return res.status(500).json({ success: false, message: "Error updating coupon" });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
    if (!deleted) return res.status(404).json({ message: "Coupon not found" });
    return res.status(200).json({ message: "Coupon deleted" });
  } catch (error) {
    console.error("Coupon Delete Error:", error);
    return res.status(500).json({ message: "Error deleting coupon" });
  }
};

module.exports = {
  couponManagementpage,
  addCouponpage,
  addnewCoupon,
  activeCoupon,
  inactiveCoupon,
  editCoupon,
  editpageCoupon,
  deleteCoupon,
  
};
