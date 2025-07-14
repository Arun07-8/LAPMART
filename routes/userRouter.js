const express=require("express")
const router=express.Router();
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController");
const passport = require("passport");
const productController=require("../controllers/user/productController")
const userProfile=require("../controllers/user/userProfile")
const cartController=require("../controllers/user/cartController")
const addressController=require("../controllers/user/addressController")
const checkOutController=require("../controllers/user/checkOutController")
const whishlistController=require("../controllers/user/wishlistController")
const OrderController=require("../controllers/user/orderController")
const walletController=require("../controllers/user/walletController")
const couponController=require("../controllers/user/couponController")
const contactsController=require("../controllers/user/contactsController")
const aboutController=require("../controllers/user/aboutController")
const  {userAuth,userAuthHome }=require("../middlewares/userAuth")
const {profileUpload}=require("../config/multer");
const { ReturnDocument } = require("mongodb");



router.get("/pageNotFound",userController.pageNotFound)
       //   Register Management
router.get("/signup",userController.loadsignup);
router.post("/signup",userController.signup)
router.get("/verify-Otp",userController.renderOtpPge)
router.post("/verify-Otp",userController.verifyOtp);
router.post("/resendOtp",userController.resendOtp)
router.get("/auth/google", passport.authenticate("google", {scope: ["profile", "email"]}));
router.get('/auth/google/callback', (req, res, next) => {
      passport.authenticate('google', (err, user, info) => {
      if (err || !user) {const message = info?.message || 'Authentication failed';
           return res.redirect(`/signup?message=${encodeURIComponent(message)}`);}
      req.logIn(user, (loginErr) => {if (loginErr) {
           return res.redirect(`/signup?message=${encodeURIComponent('Login failed')}`);}
      req.session.user = user._id;
           return res.redirect('/');
      });
    })(req, res, next);});
  
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
router.get("/",userAuthHome,userController.LoadHomepage);
router.get("/shop",userAuthHome,userController.loadShoppingPage)
router.get("/productview",productController.productViewPage);

// contact page
router.get("/contacts",contactsController.contactPage)
router.post("/contacts",contactsController.sendEmail)

// about page
router.get("/about",aboutController.getAboutPage)


// protected routes 
router.use(userAuth);

//   User Profile
router.get("/profile",userProfile.userProfile)
router.get("/editprofile",userProfile.userEditprofile)
router.post("/editprofile",profileUpload,userProfile.profileUpdate)
router.delete("/removeuserimage/:index",userProfile.removeUserImage);
router.post("/change-password",userProfile.changepassword)
router.post("/change-email", userProfile.editemail);
router.get("/email-otp", userProfile.getOtpPage);
router.post("/email-otp",userProfile.verifyOtp);
router.post("/resend-Otp",userProfile.resendOtp);
router.get("/referral",userProfile.getreferralPage)
router.get("/logout",userController.logout)
router.get("/check-session", userController.checkSession);


//   Cart page
router.get("/cart",cartController.renderCartPage)
router.post("/cart/add",cartController.addTocart)
router.post("/cart/remove",cartController.removeCartProduct)
router.post("/cart/update-quantity",cartController.updateCartQuantity)

//   address page
router.get("/address",addressController.addressPageload)
router.get("/address/add",addressController.getaddressAddpage)
router.post("/address/add",addressController.addaddressPage)
router.get("/address/edit/:addressId",addressController.editAddressPageLoad)
router.post("/address/edit/:addressId",addressController.editaddress)
router.delete("/address/delete/:addressId",addressController.deleteAddress)
router.patch("/address/set-default/:addressId",addressController.setDefaultAddress)

//wishlist Page
router.get("/wishlist",whishlistController.getWishlistPage)
router.post("/wishlist/add/:Id",whishlistController.addWishlist)
router.delete("/wishlist/remove/:productId",whishlistController.deleteWishlistProduct)
router.post("/add/wishlist-cart/:productId",whishlistController.addToCartFromWishlist);

//  checkOut page
router.get("/checkout",checkOutController.checkOutpage)
router.post("/checkout",checkOutController.checkoutHandler)

//  Order Page
router.get("/order/:orderId",OrderController.getOrderPage)
router.get("/view-order",OrderController.getViewOrderpage)
router.get("/order-details/:orderId",OrderController.getOrderViewPage)
router.get("/order/invoice/:orderId", OrderController.downloadInvoice);
router.post("/order-details/cancel",OrderController.cancelOrder)
router.post("/order-details/return",OrderController.orderReturn)

//  Wallect
router.get("/wallet",walletController.getWalletPage)

// coupon controller
router.get('/coupons/available',couponController.availableCoupon)
router.post("/coupons/apply",couponController.applyCoupon)
router.post("/coupons/remove",couponController.removeCoupon)




module.exports=router;                