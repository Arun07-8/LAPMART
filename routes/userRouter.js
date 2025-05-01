const express=require("express")
const router=express.Router();
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController");
const passport = require("passport");
const  {adminAuth,userAuth}=require("../middlewares/Auth")


router.get("/pageNotFound",userController.pageNotFound)

       //   Register Management
router.get("/signup",userController.loadsignup);
router.post("/signup",userController.signup)
router.post("/verify-Otp",userController.verifyOtp);
router.post("/resendOtp",userController.resendOtp)
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}))
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{      
              if (req.user) {
                  req.session.user = req.user._id;
                  return res.redirect("/home");
              } else {
                  return res.redirect("/signup");
              }
       })
       //   Login management
router.get("/login",userController.loadlogin)
router.post("/login",userController.login)

       //   Forget  Password
router.get("/forgot-password",profileController.getforgetPass)
router.post("/forgot-Password",profileController.forgotEmailvalid)

       //   Home page & Shopping page
router.get("/home",userController.LoadHomepage);
router.get("/shop",userController.loadShoppingPage)
router.get('/filter',userAuth,userController.filterProduct)
router.get("/productview",userAuth,userController.productView)
router.get("/logout",userController.logout);


     

module.exports=router;                