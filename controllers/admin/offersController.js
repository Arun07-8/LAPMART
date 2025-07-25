const Offer=require("../../models/offersSchema")
const Product=require("../../models/productSchema")
const Category=require("../../models/categorySchema")
const Brand=require("../../models/BrandSchema")
const mongoose=require("mongoose")
const { distance } = require('fastest-levenshtein');

const OffersManagement = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : '';
    const sort = req.query.sort || 'Newest First';

    // Build query object
    let query = { isDeleted: false };
    if (search) {
      query.offerName = { $regex: search, $options: 'i' }; // Case-insensitive search
    }

    // Define sort options
    let sortOption = { createdAt: -1 }; // Default: Newest First
    switch (sort) {
      case 'Oldest First':
        sortOption = { createdAt: 1 };
        break;
      case 'A-Z':
        sortOption = { offerName: 1 };
        break;
      case 'Z-A':
        sortOption = { offerName: -1 };
        break;
      case 'Category A-Z':
        sortOption = { 'applicableId.name': 1 };
        break;
      case 'Category Z-A':
        sortOption = { 'applicableId.name': -1 };
        break;
      case 'Product A-Z':
        sortOption = { 'applicableId.productName': 1 };
        break;
      case 'Product Z-A':
        sortOption = { 'applicableId.productName': -1 };
        break;
      case 'High to Low':
        sortOption = { offerAmount: -1 };
        break;
      case 'Low to High':
        sortOption = { offerAmount: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    // Fetch offers with search and sort
    const offers = await Offer.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .populate('applicableId')
      .lean();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    offers.forEach(offer => {
      const endDate = new Date(offer.validUpto);
      endDate.setHours(0, 0, 0, 0);
      offer.isExpired = endDate < today;
    });

    const totalOffers = await Offer.countDocuments(query);
    const totalPages = Math.ceil(totalOffers / limit);

    res.render('offresMangment', {
      offers,
      currentPage: page,
      totalPages,
      limit,
      search, 
      sort 
    });
  } catch (error) {
    console.error('Offer management page rendering issue:', error);
    res.redirect('/admin/pagenotFounderror');
  }
};

const offerAdd=async (req,res) => {
    try {
        res.render("addOffers")
    } catch (error) {
        console.error(' Offer creation failed:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const normalize = (str) => str.trim().toLowerCase().replace(/\s+/g, ' ');
const createOffer = async (req, res) => {
  try {
    const {
      offerName,
      offerType,
      applicable,
      discountType,
      offerAmount,
      validFrom,
      validUpto,
      description,
    } = req.body;

    const formattedType = offerType.charAt(0).toUpperCase() + offerType.slice(1).toLowerCase();

    if (
      !offerName ||
      !formattedType ||
      !applicable ||
      !discountType ||
      !offerAmount ||
      !validFrom ||
      !validUpto ||
      !description
    ) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const validTypes = ['Product', 'Category', 'Brand'];
    if (!validTypes.includes(formattedType)) {
      return res.status(400).json({ success: false, message: 'Invalid offer type.' });
    }

    if (discountType !== 'percentage') {
      return res.status(400).json({ success: false, message: 'Only percentage discount allowed.' });
    }

    if (offerAmount < 1 || offerAmount > 50) {
      return res.status(400).json({ success: false, message: 'Offer amount must be between 1% and 50%.' });
    }

    function parseDate(dateStr) {
      const [day, month, year] = dateStr.split('/').map(Number);
      return (!day || !month || !year) ? null : new Date(year, month - 1, day);
    }

    const from = parseDate(validFrom);
    const upto = parseDate(validUpto);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!from || !upto || isNaN(from) || isNaN(upto)) {
      return res.status(400).json({ success: false, message: 'Invalid date format. Use dd/mm/yyyy.' });
    }
    if (from < today) {
      return res.status(400).json({ success: false, message: 'Valid From date cannot be in the past.' });
    }
    if (upto <= from) {
      return res.status(400).json({ success: false, message: 'Valid Upto must be after Valid From.' });
    }

    const modelMap = { Product, Category, Brand };
    const model = modelMap[formattedType];
    if (!model) {
      return res.status(400).json({ success: false, message: 'Invalid model for offer type.' });
    }

    const exists = await model.findById(applicable);
    if (!exists) {
      return res.status(400).json({ success: false, message: `No such ${formattedType} found.` });
    }

  
    const allOffers = await Offer.find({
      offerType: formattedType,
      applicableId: applicable,
      isDeleted: false,
    });

    const inputNormalized = normalize(offerName);

    const similarExists = allOffers.find(o => {
      const existingNormalized = normalize(o.offerName);
      const dist = distance(inputNormalized, existingNormalized);
      const maxLen = Math.max(inputNormalized.length, existingNormalized.length);
      const similarity = 1 - dist / maxLen;
      return similarity >= 0.8; 
    });

    if (similarExists) {
      return res.status(400).json({
        success: false,
        message: `A similar offer name already exists: "${similarExists.offerName}". Please choose a more distinct name.`,
      });
    }

    const activeOfferForSameItem = await Offer.findOne({
      offerType: formattedType,
      applicableId: applicable,
      status: 'active',
      isDeleted: false
    });

    if (activeOfferForSameItem) {
      return res.status(400).json({
        success: false,
        message: `An active offer already exists for the selected ${formattedType}. Please deactivate or delete it before creating a new one.`
      });
    }

    const sameNameSameItemUsed = await Offer.findOne({
      offerName,
      offerType: formattedType,
      applicableId: applicable,
      status: { $ne: 'inactive' },
      isDeleted: false
    });

    if (sameNameSameItemUsed) {
      return res.status(400).json({
        success: false,
        message: `Offer name "${offerName}" has already been used for this ${formattedType}. Choose a different name.`
      });
    }

    const newOffer = new Offer({
      offerName,
      offerType: formattedType,
      applicableId: applicable,
      discountType,
      offerAmount,
      validFrom: from,
      validUpto: upto,
      description,
      status: 'active',
      isActive: true,
      isDeleted: false
    });

    const saved = await newOffer.save();

    return res.status(201).json({
      success: true,
      message: 'Offer created successfully.',
      data: saved
    });

  } catch (err) {
    console.error('Offer creation error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
};


const listAvailableProducts = async (req, res) => {
  try {
    const products = await Product.find(
      { isDeleted: false, isListed: true },
      '_id productName' 
    );

    res.status(200).json({ products }); 
  } catch (error) {
    console.error("Error fetching product list for offer:", error);
    res.status(500).json({ error: "Failed to load products" });
  }
};

   const listAvailableCategories = async (req, res) => {
  try {
    const categories = await Category.find(
      { isDeleted: false, isListed: true },
      '_id name'
    );
    
    res.status(200).json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to load categories" });
  }
};

const listAvailableBrands = async (req, res) => {
  try {
    const brands = await Brand.find(
      { isDeleted: false, isListed: true },
      '_id name'
    );
    res.status(200).json({ brands });
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ error: "Failed to load brands" });
  }
};

const activeOffer=async (req,res) => {
    try{
        const id=req.params.id
        await Offer.findByIdAndUpdate({_id:id},{$set:{isActive:true}})
        res.status(200).json({success:true,message:"Offer is Acive Succefully"})
    } catch (error) {
        console.error('Error active coupon:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
}

const inActiveOffer=async (req,res) => {
    try {
        const id=req.params.id
        await Offer.findByIdAndUpdate({_id:id},{$set:{isActive:false}})
        res.status(200).json({success:true,message:"Offer is  inAcive Succefully"})
    } catch (error) {
       console.error('Error inactive coupon:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
}

const deleteOffer=async (req,res) => {
      try {
        const id=req.params.id
        const deleteOffer=await Offer.findByIdAndUpdate(id,{isDeleted:true},{new:true})
         if(!deleteOffer){
              return res.status(404).json({error:"Offer Not found"});
        }
       return res.json({success:true});
      } catch (error) {
          console.error("Error deleting coupon:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while deleting coupon",
            error: error
      })
}
}

const editOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    const offer = await Offer.findById(offerId);

    if (!offer) {
      return res.status(404).send('Offer not found');
    }

    let populatedOffer = offer;
    let applicableItemName = '(Deleted Item)';


    if (offer.offerType === 'Product') {
      populatedOffer = await Offer.findById(offerId).populate({
        path: 'applicableId',
        model: 'Product'
      });
      if (populatedOffer.applicableId && populatedOffer.applicableId.productName) {
        applicableItemName = populatedOffer.applicableId.productName;
      }
    } else if (offer.offerType === 'Category') {
      populatedOffer = await Offer.findById(offerId).populate({
        path: 'applicableId',
        model: 'Category'
      });
      if (populatedOffer.applicableId && populatedOffer.applicableId.name) {
        applicableItemName = populatedOffer.applicableId.name;
      }
    } else if (offer.offerType === 'Brand') {
      populatedOffer = await Offer.findById(offerId).populate({
        path: 'applicableId',
        model: 'Brand'
      });
      if (populatedOffer.applicableId && populatedOffer.applicableId.name) {
        applicableItemName = populatedOffer.applicableId.name;
      }
    }

    res.render('EditOffer', {
      offer: populatedOffer,
      applicableItemName
    });

  } catch (err) {
    console.error("Error loading Edit Offer:", err);
    res.status(500).send('Server Error');
  }
};




const editOfferPage = async (req, res) => {
  try {
    const offerId = req.params.id;

    const {
      offerName,
      offerType,
      applicable,
      discountType,
      offerAmount,
      validFrom,
      validUpto,
      description
    } = req.body;

    // Check if offer exists
    const offerExists = await Offer.findById(offerId);
    if (!offerExists) {
      return res.status(404).json({
        success: false,
        message: "Offer not found"
      });
    }

    // Format and validate dates
    const parseDate = (d) => {
      const parts = d.split('/');
      if (parts.length !== 3) return null;
      const [day, month, year] = parts;
      const date = new Date(`${year}-${month}-${day}`);
      return isNaN(date) ? null : date;
    };

    const parsedFrom = parseDate(validFrom);
    const parsedUpto = parseDate(validUpto);

    if (!parsedFrom || !parsedUpto) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use dd/mm/yyyy." });
    }

    if (parsedUpto <= parsedFrom) {
      return res.status(400).json({ success: false, message: "Valid Upto must be after Valid From." });
    }

    const normalizedOfferType = offerType.charAt(0).toUpperCase() + offerType.slice(1).toLowerCase();

    let applicableId = null;


    if (normalizedOfferType !== 'Sitewide') {
      if (!mongoose.Types.ObjectId.isValid(applicable)) {
        return res.status(400).json({
          success: false,
          message: "Invalid applicable ID"
        });
      }

      applicableId = new mongoose.Types.ObjectId(applicable);

      const existingActiveOffer = await Offer.findOne({
        _id: { $ne: offerId },
        offerType: normalizedOfferType,
        applicableId: applicableId,
        status: 'active',
        isDeleted: false
      });

      if (existingActiveOffer) {
        return res.status(400).json({
          success: false,
          message: `Another active offer already exists for this ${normalizedOfferType}. Deactivate or delete it first.`
        });
      }


      const sameNameUsed = await Offer.findOne({
        _id: { $ne: offerId },
        offerName,
        offerType: normalizedOfferType,
        applicableId: applicableId,
        isDeleted: false
      });

      if (sameNameUsed) {
        return res.status(400).json({
          success: false,
          message: `Offer name "${offerName}" is already used for this ${normalizedOfferType}. Choose a different name.`
        });
      }
    }

    const updateData = {
      offerName,
      offerType: normalizedOfferType,
      discountType,
      offerAmount: Number(offerAmount),
      validFrom: parsedFrom,
      validUpto: parsedUpto,
      description,
      updatedAt: new Date(),
      applicableId: applicableId  
    };

    // Update offer
    const updatedOffer = await Offer.findByIdAndUpdate(
      offerId,
      updateData,
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Offer updated successfully",
      data: updatedOffer
    });

  } catch (error) {
    console.error("Error in editOfferPage:", error);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later."
    });
  }
};



module.exports={
    OffersManagement,
    offerAdd,
    createOffer,
    listAvailableProducts,
    listAvailableCategories,
    listAvailableBrands,
    activeOffer,
    inActiveOffer,
    deleteOffer,
    editOffer,
    editOfferPage
}