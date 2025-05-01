const User = require("../../models/userSchema");
const Category=require("../../models/categorySchema");
const Product=require("../../models/productSchema");
const Brand=require("../../models/BrandSchema")
const env = require("dotenv").config();
const nodemailer = require("nodemailer");
const bcrypt = require("bcrypt");
const saltround = 10;

// Register Management
const loadsignup = async (req, res) => {
    try {
        return res.render("signUp");
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
        const { name, phoneNumber, email, password,confirmpassword } = req.body;
        
        // Password mismatch check
        if (password !== confirmpassword) {
            return res.render("signUp", { message: "Passwords do not match" });
        }
        
        // Check if user already exists
        const findUser = await User.findOne({ email });
        if (findUser) {
            return res.render("signUp", { message: "User with this email already exists" });
        }
        
        const otp = generateOtp();
        const emailsent = await sendVerificationEmail(email, otp);
        console.log(emailsent);
        
        if (!emailsent) {
            return res.json("email-error");
        }
        // Store OTP and user data in session
        req.session.userOtp = otp;
        req.session.userData = { name, phoneNumber, email, password };
        
        res.render("verify-Otp");
        console.log("OTP sent", otp);
    } catch (error) {
        console.error("signup error", error);
        res.redirect("/pageNotFound");
    }
};
async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
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
            to:email,
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
        console.error("Error sending email", error);
        return false;
    }
}
const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, saltround);
        return passwordHash;
    } catch (error) {
        console.error("Error hashing password", error);
        return null;
    }
};
const   verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        if (otp === req.session.userOtp) {
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);
          
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phoneNumber: user.phoneNumber,
                password: passwordHash,
            });

            await saveUserData.save();
            req.session.user = saveUserData._id;
            res.json({ success: true, redirectUrl:"/home"});
        } else {
            res.status(400).json({ success: false, message: "Invalid OTP, Please try again" });
        }
    } catch (error) {
        console.error("Error verifying OTP", error);
        res.status(500).json({ success: false, message: "An error occurred" });
    }
};
// Resend OTP management
const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData;
       
        
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" });
        }

        const otp = generateOtp();
        req.session.userOtp = otp; // Corrected the session variable name
        console.log(req.session.userOtp);
        
        const emailSent = await sendVerificationEmail(email, otp);

        if (emailSent) {
            console.log("Resend OTP", otp);
            res.status(200).json({ success: true, message: "OTP Resent Successfully" });
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP. Please try again" });
        }
    } catch (error) {
        console.error("Error resending OTP", error);
        res.status(500).json({ success: false, message: "Internal server error. Please try again" });
    }
};
// Page-404 error handling
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

        req.session.user = findUser._id; 
     
        
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
        const categories = await Category.find({ isListed: false, isDeleted: false });
        const brand = await Brand.find({ isListed: false, isDeleted: false });
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

//  Shop page rendering
const loadShoppingPage=async (req,res) => {
    try{
   const user=req.session.user
   if(user){
    const userData = await User.findOne({_id:user});
    const category = await Category.find({isListed:true,isDeleted:true})
    const brand= await Brand.find({isListed:true,isDeleted:true});
    const categoryId=category.map((category)=>category._id.toString());
    const brandId=brand.map((brand)=>brand._id.toString());
    
    const page=parseInt(req.query.page)||1;
    const limit=7;
    const skip=(page-1)*limit;
    const products=await Product.find({
        isListed:true,
        isDeleted:true,
        category:{$in:categoryId},
        brand:{$in:brandId},
        quantity:{$gt:0},

    }).sort({createdAt:-1}).skip(skip).limit(limit);
    const totalProducts=await Product.countDocuments({
        isListed:true,
        isDeleted:true,
        category:{$in:categoryId},
        brand:brandId,
        quantity:{$gt:0}
    });
    const totalPages= Math.ceil(totalProducts/limit);
    const categoriesWithIds=category.map(category=>({_id:category._id,name:category.name}))
     res.render("shopPage",{
        user:userData,
        product:products,
        category:categoriesWithIds,
        brand:brand,
        currentPage:page,
        totalPages:totalPages
     })
     console.log(category);
     
   }else{
    res.render("shopPage")
   }
    }catch(error){
        console.error(error);
      res.redirect("/pageNotFound")
    }
}
//  Product view page
const productView=async(req,res)=>{
    try{
     res.render("productViewPage")
    }catch(error){
        res.redirect("/pageNotFound")
    }
}
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
//  filter product

const  filterProduct=async (req,res) => {
    try {
        const user=req.session.user;
        console.log(user);
        
        const category=req.query.category;
        const brand=req.query.brand;
        const findCategory=category ? await Category.findOne({_id:category}):null;
        const findBrand=brand ? await Brand.findOne({_id:brand}):null;
        const Brand=await Brand.find({}).lean();
        const query={
            isListed:true,
            quantity:{$gt:0}, 
        }
        if(findCategory){
            query.category=findCategory._id;
        }
        if(findBrand){
            query.brand=findBrand.name;
        }

        let findProducts =await Product.find(query).lean();
        findProducts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)); 

        const categories=await Category.find({islisted:true,isDeleted:true})
        
        let itemPerpage=6;
        let currentPage=parseInt(req.query.page)||1;
        let startIndex=(currentPage-1)*itemsPerPage;
        let endIndex=startIndex+itemsPerPage;
        let totalPages=Math.ceil(findProducts.length/itemsPerPage)
        let currentProduct=findProducts.slice(startIndex,endIndex);

        let userData=null;
        if(user){
            userData=await User.findOne({_id:user});
            if(userData){
                const searchEntry={
                    category:findCategory ? findCategory._id:null,
                    brand:findBrand ? findBrand.name:null,
                    searchedOn:new Date()
                }
                userData.searchHistory.push(searchEntry);
                await userData.save();
            }
        }
       res.render('shop',{
        userData,
        products:currentProduct,
        category:categories||null,
        brand:brands,
        totalPages,
        currentPage,
        seletedCategory:category||null,
        seletedBrand:brand||null,
       })
    } catch (error) {
        console.error(error);
        res.redirect('/pageNotFound')
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
    productView,
    filterProduct,
};
