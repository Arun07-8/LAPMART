const User = require("../../models/userSchema");
const Category=require("../../models/categorySchema");
const Product = require("../../models/productSchema");
const Brand=require("../../models/BrandSchema")
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const saltround = 10;

// Register Management
const loadsignup = async (req, res) => {
    try {
        let {message}=req.query;
        
        if (message) {
            message = message.replace(/\bBlocked\b/g, 'blocked');
            message = message.replace(/^User is/, 'Your account is');
            return res.render("signUp",{message});

        }
        return res.render("signUp",{message})
    } catch (error) {
        console.error("Error for save user", error);
        res.status(500).send("internal error");
    }
};
// OTP generate
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const signup = async (req, res) => {
    try {
        const { name, phoneNumber, email, password, confirmpassword } = req.body;

        if (password !== confirmpassword) {
            return res.render("signUp", { message: "Passwords do not match" });
        }

        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signUp", { message: "User with this email already exists" });
        }

        const otp = generateOtp();
        const otpExpiration = new Date(Date.now() + 60 * 1000); // OTP expires in 60 seconds
        const emailsent = await sendVerificationEmail(email, otp);
        if (!emailsent) {
            return res.json({ success: false, message: "email-error" });
        }

        req.session.userOtp = { otp, expiresAt: otpExpiration };
        req.session.userData = { name, phoneNumber, email, password };

        res.render("verify-Otp");
        console.log("OTP sent:", otp);
    } catch (error) {
        console.error("Signup error:", error.message, error.stack);
        res.redirect("/pageNotFound");
    }
};

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
                <p style="font-size: 18px; color: #555;">
                    Your OTP is <b style="color: blue; font-size: 22px;">${otp}</b>
                </p>
                <p>Please enter this OTP to verify your account.</p>
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

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const storedOtpData = req.session.userOtp;
        if (!storedOtpData || !storedOtpData.otp || !storedOtpData.expiresAt) {
            return res.status(400).json({ success: false, message: "No OTP found or session expired" });
        }

        if (new Date() > new Date(storedOtpData.expiresAt)) {
            return res.status(400).json({ success: false, message: "OTP has expired. Please resend a new OTP." });
        }

        if (otp === storedOtpData.otp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            if (!passwordHash) {
                return res.status(500).json({ success: false, message: "Error processing password" });
            }

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                password: passwordHash,
            });

            await saveUserData.save();
            req.session.user = saveUserData._id;
            req.session.userOtp = null; 
            res.json({ success: true, redirectUrl: "/home" });
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error.message, error.stack);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        const otpExpiration = new Date(Date.now() + 60 * 1000); 
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }

        req.session.userOtp = { otp, expiresAt: otpExpiration };
        console.log("Resend OTP:", otp);

        res.status(200).json({ success: true, message: "OTP resent successfully" });
    } catch (error) {
        console.error("Error resending OTP:", error.message, error.stack);
        res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again." });
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
     
        
        res.redirect("/home");
    } catch (error) {
        console.error("login error", error);
        req.session.Mes={type:"error",text:"Login failed. Please try again later"}
        res.redirect("/login");
    }
}; 
//  Home page  rendering
const LoadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brand = await Brand.find({ isListed: true, isDeleted: false });
        const productData = await Product.find({
            isListed: true,
            isDeleted:false,
            category: { $in: categories.map((category) => category._id) },
            brand: { $in: brand.map((brand) => brand._id) },
            quantity: { $gt: 0 }
        });
        productData.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn));
        if (user) {
            const userData = await User.findById(user);
            return res.render("home", { user: userData, product: productData });
        } else {
            return res.render("home", { product: productData });
        }
    } catch (error) {
        console.error("Home page is not working", error);
        res.status(500).send("Server error");
    }
    
};
const loadShoppingPage = async (req, res) => {
  try {
    const user = req.session.user;
    let userData = null;
    if (user) {
      userData = await User.findOne({ _id: user }).lean();
    }
    const {
      category = 'all',
      brand = 'all',
      priceMin = 20000,
      priceMax = 150000,
      sort = 'popular',
      page = 1,
      search = '',
    } = req.query;

    const query = { isListed: true, isDeleted: false};
    if (category !== 'all') query.category = category;
    if (brand !== 'all') query.brand = brand;
    if (priceMin !== '0' || priceMax !== '150000') {
      query.salePrice = {
        $gte: parseInt(priceMin) || 0,
        $lte: parseInt(priceMax) || 150000,
      };
    }

    let categoryIds = [];
    if (search.trim()) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      const categoriesSearch = await Category.find({
        name: { $regex: searchRegex },
        isListed: true,
        isDeleted: false,
      }).lean();
      categoryIds = categoriesSearch.map(cat => cat._id);

      query.$or = [
        { productName: { $regex: searchRegex } },
        { category: { $in: categoryIds } },
      ];
    }

    const categories = await Category.find({ isListed: true, isDeleted: false }).lean();
    const brands = await Brand.find({ isListed: true, isDeleted: false }).lean();

    let sortOption = {};
    switch (sort) {
      case 'price-low':
        sortOption = { salePrice: 1 };
        break;
      case 'price-high':
        sortOption = { salePrice: -1 };
        break;
      case 'name-asc':
        sortOption = { productName: 1 };
        break;
      case 'name-desc':
        sortOption = { productName: -1 };
        break;
      case 'popular':
      default:
        sortOption = { createdAt: -1 };
        break;
    }

    const limit = 6;
    const skip = (parseInt(page) - 1) * limit;
    const totalProducts = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPages = Math.ceil(totalProducts / limit);

    let categoryName = 'Laptops';
    if (category !== 'all') {
      const selectedCategory = categories.find(cat => cat._id.toString() === category);
      categoryName = selectedCategory ? selectedCategory.name : 'Laptops';
    }

    const relatedQuery = {
      isListed: true,
      isDeleted: false,
      quantity: { $gt: 0 },
      _id: { $nin: products.map(p => p._id) },
    };
    if (category !== 'all') {
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
    const relatedProducts = await Product.find(relatedQuery)
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    relatedProducts.forEach(product => {
      const discount = ((product.regularPrice - product.salePrice) / product.regularPrice) * 100;
      product.isNew = product.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      product.isSale = discount >= 20;
      product.isBestseller = (product.ratingCount || 0) > 150;
    });

    const filters = {
      category: category,
      brand: brand,
      priceMin: parseInt(priceMin) || 20000,
      priceMax: parseInt(priceMax) || 150000,
      sort: sort,
      search: search,
    };

    res.render('shopPage', {
      user: userData,
      product: products,
      category: categories,
      brand: brands,
      categoryName: categoryName,
      currentPage: parseInt(page),
      totalPages: totalPages,
      totalProducts: totalProducts,
      limit: limit,
      filters: filters,
      relatedProducts: relatedProducts,
      errorMessage: null,
    });
  } catch (error) {
    console.error('Error:', error);
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
               return  res.redirect("/home");
          })    
      } catch(error){
         console.error("Logout error",error);
         res.redirect("/pageNotFound");

      }       
    
}
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

};
