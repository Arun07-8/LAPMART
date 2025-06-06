const express=require("express")
const router=express.Router();
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController");
const passport = require("passport");
const {userAuth}=require("../middlewares/userAuth")
const productController=require("../controllers/user/productController")


router.get("/pageNotFound",userController.pageNotFound)

       //   Register Management
router.get("/signup",userController.loadsignup);
router.post("/signup",userController.signup)
router.post("/verify-Otp",userController.verifyOtp);
router.post("/resendOtp",userController.resendOtp)
router.get("/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"]
  }));
  router.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, user, info) => {
      if (err || !user) {
        const message = info?.message || 'Authentication failed';
       
        return res.redirect(`/signup?message=${encodeURIComponent(message)}`);
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.redirect(`/signup?message=${encodeURIComponent('Login failed')}`);
        }
        req.session.user = user._id;
        return res.redirect('/home');
      });
    })(req, res, next);
  });
  
  
//   Login management
router.get("/login",userController.loadlogin)
router.post("/login",userController.login)

//   Forget  Password
router.get("/forgot-password",profileController.getforgetPass)
router.post("/forgot-Password",profileController.forgotEmailvalid)
router.get("/Otp-verify",profileController.loadVerifyOtp)
router.post("/Otp-verify",profileController.otpVerify);
router.get("/reset-password",profileController.getRestPassPage);
router.post("/reset-password",profileController.newPasswordSet)
router.get("/forgot-resendOtp",profileController.loadresendOtp)

//   Home page & Shopping page
router.get("/home",userAuth,userController.LoadHomepage);
router.get("/shop",userAuth,userController.loadShoppingPage)
router.get("/logout",userController.logout);

//   Product details
router.get("/productview",userAuth,productController.productViewPage);



     

module.exports=router;                