const Coupon=require("../../models/couponSchema")
const couponManagementpage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const coupons = await Coupon.find({isDeleted:false})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    coupons.forEach(coupon => {
      const endDate = new Date(coupon.endDate);
      endDate.setHours(0, 0, 0, 0); // Remove time part
      coupon.isExpired = endDate < today;
    });

    const totalCoupons = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalCoupons / limit);

    res.render("couponManagement", {
      coupons,
      currentPage: page,
      totalPages
    });

  } catch (err) {
    console.error("Pagination Error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch coupons" });
  }
};

const addCouponpage=async (req,res) => {
    try {
        res.render("addCoupon")
    } catch (error) {
        console.error("add coupon page canot loading an errror",error)
        res.redirect("/admin/pagenotFounderror")
    }
}

// add new coupon 
const addnewCoupon=async (req,res) => {
    try {
        const {
            couponName,
            couponCode,
            description,
            createdDate,
            expiryDate,
            offerPrice,
            minPurchase
        } = req.body;
        
        if (!couponName || !couponCode || !description || !createdDate || !expiryDate || !offerPrice || !minPurchase) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
        if (couponName.toUpperCase() === couponCode.toUpperCase()) {
            return res.status(400).json({
                success: false,
                message: 'Coupon name and coupon code cannot be the same'
            });
        }
         const existing = await Coupon.findOne({ couponName,couponCode});
          if (existing) {
          return res.status(400).json({ success: false, message: "Coupon code already exists" });
         }
        
        if (!offerPrice || offerPrice <= 1000 || isNaN(offerPrice)) {
         return res.status(400).json({ success: false, message:'Discount amount must be greater than ₹1000'})
        }
       if (!/^\d{2}\/\d{2}\/\d{4}$/.test(expiryDate)) {
         return res.status(400).json({ message: "Expiry date must be in dd/mm/yyyy format" });
        }
       
const parseDate = (dateStr) => {
            const [day, month, year] = dateStr.split('/').map(Number);
            return new Date(year, month - 1, day);
        };

const couponData = {
            couponName: couponName.trim(),
            couponCode: couponCode.trim().toUpperCase(),
            description: description.trim(),
            validFrom: parseDate(createdDate),
            validUpto: parseDate(expiryDate),
            offerPrice: parseFloat(offerPrice),
            minPurchase: parseFloat(minPurchase)
        };
if (couponData.couponAmount > couponData.minimumCartValue * 0.3) {
            return res.status(400).json({
                success: false,
                message: `Coupon amount cannot exceed 30% of minimum cart value (₹${(couponData.minimumCartValue * 0.3).toFixed(2)})`
            });
        }
       const newCoupon = new Coupon(couponData);
       await newCoupon.save();
       res.status(201).json({ success: true, message: "Coupon created successfully"});

    } catch (error) {
         console.error("Coupon Add Error:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });

    }
}

const activeCoupon=async (req,res) => {
    try {
        const id=req.params.id
        await Coupon.updateOne({_id:id},{$set:{isActive:true}})
        res.status(200).json({success:true,message:"Coupon is Active Succefully"})
    } catch (error) {
        console.error('Error active coupon:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
}

const inactiveCoupon=async (req,res) => {
    try {
        const id=req.params.id
        await Coupon.findByIdAndUpdate({_id:id},{$set:{isActive:false}})
        res.status(200).json({success:false,message:"Coupon inActive Successfully"})
    } catch (error) {
         console.error('Error inactive coupon:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
}

 // Edit Coupon
const editCoupon=async (req,res) => {
    try {
        const couponId=req.params.couponId
        const coupon=await Coupon.findById(couponId).lean()
        res.render("editCoupon",{coupon})
    } catch (error) {
       console.error('Error editing coupon:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
} 
const editpageCoupon = async (req, res) => {
    try {
        const couponID = req.params.couponId;
    const {
        couponName,
        couponCode,
        description,
        createdDate,
        expiryDate,
        offerPrice,
        minPurchase
    } = req.body;

        const couponExists = await Coupon.findById(couponID);
        if (!couponExists) {
            return res.status(404).json({
                success: false,
                message: "Coupon not found"
            });
        }


        const existingCoupon = await Coupon.findOne({
            couponCode,
            _id: { $ne: couponID }
        });
        if (existingCoupon) {
            return res.status(400).json({
                success: false,
                message: "Coupon code already exists"
            });
        }


        const updatedCoupon = await Coupon.findByIdAndUpdate(
            couponID,
            {
                couponName,
                couponCode,
                description,
                createdDate: new Date(createdDate),
                expiryDate: new Date(expiryDate),
                offerPrice: Number(offerPrice),
                minPurchase: Number(minPurchase),
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        return res.status(200).json({
            success: true,
            message: "Coupon updated successfully",
            data: updatedCoupon
        });

    } catch (error) {
        console.error("Error updating coupon:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while updating coupon",
            error: error
        });
    }
};


const deleteCoupon=async (req,res) => {
    try {
        const id=req.params.id
        const deleteCoupon= await Coupon.findByIdAndUpdate(id,{isDeleted:true},{new:true})
        if(!deleteCoupon){
              return res.status(404).json({error:"Coupon Not found"});
        }
       return res.status(200).json({message:"Coupon deleted"});
    } catch (error) {
             console.error("Error deleting coupon:", error);
            return res.status(500).json({
            success: false,
            message: "Server error while deleting coupon",
            error: error
        });
    }
}

module.exports={
    couponManagementpage,
    addCouponpage,
    addnewCoupon,
    activeCoupon,
    inactiveCoupon,
    editCoupon,
    editpageCoupon,
    deleteCoupon,
}