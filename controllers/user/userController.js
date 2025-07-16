const User = require("../../models/userSchema");
const Category=require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand=require("../../models/BrandSchema")
const Wallet=require("../../models/walletSchema")
const {applyBestOffer}=require("../../helpers/offerHelper")
const Wishlist=require("../../models/wishlistSchema")
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const saltround = 10;
const mongoose = require('mongoose');


// Register Management
const loadsignup = async (req, res) => {
    try {
        let { message, referral } = req.query;

        if (message) {
            message = message.replace(/\bBlocked\b/g, 'blocked');
            message = message.replace(/^User is/, 'Your account is');
        }

        res.render("signUp", {
            message: message || null,
            referralCode: referral || ""
        });
    } catch (error) {
        console.error("Error loading signup page:", error.message);
        res.render("signUp", {
            message: "Error loading signup page",
            referralCode: req.query.referral || ""
        });
    }
};

// OTP generate
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
const signup = async (req, res) => {
  try {
    const { name, phoneNumber, email, password, confirmpassword, referralCode: formReferralCode } = req.body;
    const referralCode = req.query.referral || formReferralCode || "";

    if (password !== confirmpassword) {
      return res.json({ success: false, message: "Passwords do not match", referralCode });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.json({ success: false, message: "User already exists", referralCode });
    }

    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
      if (!referrer) return res.json({ success: false, message: "Invalid referral code", referralCode });
      if (referrer.redeemedUsers.length >= 10) return res.json({ success: false, message: "Referral limit reached", referralCode });
    }

    const otp = generateOtp();
    const otpExpiration = new Date(Date.now() + 1* 60 * 1000); 

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) return res.json({ success: false, message: "Failed to send OTP", referralCode });

    req.session.userOtp = { otp, expiresAt: otpExpiration };
    req.session.userData = {
      name,
      phoneNumber,
      email,
      password,
      referralCode,
      referrerId: referrer ? referrer._id : null,
    };

    res.json({ success: true, message: "OTP sent" });

  } catch (error) {
    console.error("Signup error:", error.message);
    res.json({ success: false, message: "Signup failed", referralCode: formReferralCode || "" });
  }
};
const renderOtpPge=async (req,res) => {
    try {
        res.render("verify-Otp")
    } catch (error) {
        console.error("otp page error:", error);
        res.json({ success: false, message: "otp page failed"});
    }
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });
  const info = await transporter.sendMail({
    from: process.env.NODEMAILER_EMAIL,
    to: email,
    subject: "Your One-Time Password (OTP) for Account Verification",
    text: `Your OTP is ${otp}`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2>Your OTP Code</h2>
        <p>Your OTP is <b>${otp}</b></p>
      </div>`,
  });


  return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error.message, error.stack);
        return false;
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password,saltround); 
        return passwordHash;
    } catch (error) {
        console.error("Error hashing password:", error.message, error.stack);
        return null;
    }
};

async function generateUniqueReferralCode(name) {
  const prefix = name.split(" ")[0].toUpperCase();
  let code, exists;

  do {
    const random = Math.floor(1000 + Math.random() * 9000);
    code = `${prefix}${random}`;
    exists = await User.findOne({ referralCode: code });
  } while (exists);

  return code;
}



const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const stored = req.session.userOtp;
    if (!stored || !stored.otp || !stored.expiresAt) {
      return res.render("verify-Otp", { message: "No OTP found or session expired" });
    }

    if (new Date() > new Date(stored.expiresAt)) {
      return res.render("verify-Otp", { message: "OTP expired. Please request a new one." });
    }


if (otp === stored.otp) {
    const user = req.session.userData;
    const hashedPassword = await securePassword(user.password);
    const referralCode = await generateUniqueReferralCode(user.name);

    const newUser = new User({
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      password: hashedPassword,
      referralCode,
      referredBy: user.referrerId,
      redeemed: !!user.referralCode,
      firstOrder: true,
      profileImage: [],
    });

    const wallet = new Wallet({ user: newUser._id, balance: 0, transactions: [] });
    await wallet.save();
    newUser.wallet = wallet._id;
    await newUser.save();

    if (user.referrerId) {
      const referrer = await User.findById(user.referrerId);
      if (referrer) {
        referrer.redeemedUsers.push(newUser._id);
        referrer.referralStatus.push({ userId: newUser._id, status: "Pending" });
        await referrer.save();
      }
    }

    req.session.user = newUser._id;
    req.session.userOtp = null;
    res.json({success:true,message:"OTP Verified Successfully  Welcome to LapMart"});
} else {
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
        }
  } catch (error) {
    console.error("OTP verify error:", error.message);
    res.render("verify-Otp", { message: "OTP verification failed. Please try again." });
  }
};

const resendOtp = async (req, res) => {
  try {
    const userData = req.session.userData;

    if (!userData || !userData.email) {
      return res.status(400).json({ success: false, message: "No email in session" });
    }

    const otp = generateOtp();
    const otpExpiration = new Date(Date.now() + 1* 60 * 1000); 

    const emailSent = await sendVerificationEmail(userData.email, otp);
    if (!emailSent) {
      return res.status(500).json({ success: false, message: "Failed to send email" });
    }

    req.session.userOtp = { otp, expiresAt: otpExpiration };


    return res.status(200).json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error("Resend OTP error:", error.message);
    return res.status(500).json({ success: false, message: "Resend OTP failed" });
  }
};



const pageNotFound = async (req, res) => {
    try {
        res.render("pageNotFound");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};
// Login Management
const loadlogin = async (req, res) => {
    try {
            const message=req.session.Mes;
            req.session.Mes=null;
            res.render("login",{message});
    } catch (error) {
        res.redirect("/pageNotFound");
        res.status(500).send("Internal error");
    }
};

const   login = async (req, res) => {
    try {

        const { email, password } = req.body;
      
      
        const findUser = await User.findOne({ isadmin: false, email: email });   
       
        
        if (!findUser) {
            req.session.Mes={ type:"error",text:"User Not Found"}
            return res.redirect("/login"); 
        }

        if (findUser.isBlocked) {
            req.session.Mes={type:"error" ,text:"User is Blocked by admin"}
            return res.redirect("/login");
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password);

        if (!passwordMatch) {
            req.session.Mes={type:"error", text:"Incorrect Password"}
            return res.redirect("/login");
        }

        req.session.user = {_id:findUser._id,username:findUser.email}; 
     
        
        res.redirect("/");
    } catch (error) {
        console.error("login error", error);
        req.session.Mes={type:"error",text:"Login failed. Please try again later"}
        res.redirect("/login");
    }
}; 
//  Home page  rendering
const LoadHomepage = async (req, res) => {
  try {
    const user = req.session.user || null;
    const categories = await Category.find({ isListed: true, isDeleted: false });
    const brand = await Brand.find({ isListed: true, isDeleted: false });

    const productData = await Product.find({
      isListed: true,
      isDeleted: false,
      category: { $in: categories.map((c) => c._id) },
      brand: { $in: brand.map((b) => b._id) },
      quantity: { $gt: 0 },
    });

    const updatedProduct = await Promise.all(
      productData.map((product) => applyBestOffer(product))
    );

    updatedProduct.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));

    if (user) {
      const userData = await User.findById(user);
      return res.render("home", {
        user: userData,
        product: updatedProduct,
        categories,
      });
    } else {
      return res.render("home", {
        product: updatedProduct,
        categories,
      });
    }
  } catch (error) {
    console.error("❌ Error loading homepage:", error);
    res.redirect("pageNotFound");
  }
};


const loadShoppingPage = async (req, res) => {
  try {
    const userSession = req.session.user;
   
    let userData = null;
    let wishlistProductIds = [];

 
    if (userSession) {
      userData = await User.findById(userSession).lean();
      const wishlist = await Wishlist.findOne({ userId: userSession}).lean();
      if (wishlist) {
        wishlistProductIds = wishlist.products.map(item => item.productId.toString());
      }
    }

    const {
      category = 'all',
      brand = 'all',
      priceMin = 10000,
      priceMax = 150000,
      sort = 'popular',
      page = 1,
      search = '',
    } = req.query;

    const query = { isListed: true, isDeleted: false };

    if (category !== 'all' && mongoose.isValidObjectId(category)) {
      query.category = category;
    }

    if (brand !== 'all' && mongoose.isValidObjectId(brand)) {
      query.brand = brand;
    }

    const minPrice = Math.max(parseInt(priceMin) || 10000, 10000);
    const maxPrice = Math.min(parseInt(priceMax) || 150000, 150000);
    query.salePrice = { $gte: minPrice, $lte: maxPrice };


    let categoryIds = [];
    if (search.trim()) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');

      const matchedCategories = await Category.find({
        name: { $regex: searchRegex },
        isListed: true,
        isDeleted: false,
      }).lean();

      categoryIds = matchedCategories.map(cat => cat._id);

      query.$or = [
        { productName: { $regex: searchRegex } },
        { category: { $in: categoryIds } },
      ];
    }

    const categories = await Category.find({ isListed: true, isDeleted: false }).lean();
    const brands = await Brand.find({ isListed: true, isDeleted: false }).lean();


    let sortOption = {};
    switch (sort) {
      case 'price-low': sortOption = { salePrice: 1 }; break;
      case 'price-high': sortOption = { salePrice: -1 }; break;
      case 'name-asc': sortOption = { productName: 1 }; break;
      case 'name-desc': sortOption = { productName: -1 }; break;
      default: sortOption = { createdAt: -1 }; break;
    }

    const limit = 6;
    const skip = (parseInt(page) - 1) * limit;

    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query).sort(sortOption).skip(skip).limit(limit).lean();

    const updatedProducts = await Promise.all(products.map(applyBestOffer));
    const totalPages = Math.ceil(totalProducts / limit);

    let categoryName = 'Laptops';
    if (category !== 'all' && mongoose.isValidObjectId(category)) {
      const selectedCategory = categories.find(cat => cat._id.toString() === category);
      if (selectedCategory) categoryName = selectedCategory.name;
    }


    const relatedQuery = {
      isListed: true,
      isDeleted: false,
      quantity: { $gt: 0 },
      _id: { $nin: products.map(p => p._id) },
    };

    if (category !== 'all' && mongoose.isValidObjectId(category)) {
      relatedQuery.category = category;
    }

    if (search.trim()) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      relatedQuery.$or = [
        { productName: { $regex: searchRegex } },
        { category: { $in: categoryIds } },
      ];
    }

    const relatedProducts = await Product.find(relatedQuery).sort({ createdAt: -1 }).limit(4).lean();
    const updatedRelatedProducts = await Promise.all(relatedProducts.map(applyBestOffer));

    updatedRelatedProducts.forEach(product => {
      const discount = ((product.salePrice - product.discountedPrice) / product.salePrice) * 100;
      product.isNew = product.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days
      product.isSale = discount >= 20;
      product.isBestseller = (product.ratingCount || 0) > 150;
    });


    const filters = {
      category, brand, priceMin: minPrice, priceMax: maxPrice, sort, search,
    };

    res.render('shopPage', {
      user: userData,
      product: updatedProducts,
      category: categories,
      brand: brands,
      categoryName,
      currentPage: parseInt(page) || 1,
      totalPages,
      totalProducts,
      limit,
      filters,
      relatedProducts: updatedRelatedProducts,
      wishlistProductIds,
      errorMessage: totalProducts === 0 ? 'No products found for the selected filters.' : null,
    });

  } catch (error) {
    console.error('Error in loadShoppingPage:', error.message);
    res.redirect('/pageNotFound');
  }
};


const  logout=async (req,res) => {
      try{
          req.session.destroy((error)=>{
               if(error){
                console.error("Session destruction error",error);
                return res.redirect("/pageNotFound");
               }
               return  res.redirect("/");
          })    
      } catch(error){
         console.error("Logout error",error);
         res.redirect("/pageNotFound");

      }       
    
}


const checkSession = (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true });
  } else {
    res.json({ loggedIn: false });
  }
};

module.exports = {
    signup,
    LoadHomepage,
    loadsignup,
    verifyOtp,
    resendOtp,
    loadlogin,
    pageNotFound,
    login,
    logout,
    loadShoppingPage,
    renderOtpPge,
    checkSession

};
