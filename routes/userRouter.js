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
const {userAuth}=require("../middlewares/userAuth")
const {profileUpload}=require("../config/multer")


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
          console.log()
      if (err || !user) {const message = info?.message || 'Authentication failed';
          console.log(message)
           return res.redirect(`/signup?message=${encodeURIComponent(message)}`);}
      req.logIn(user, (loginErr) => {if (loginErr) {
           return res.redirect(`/signup?message=${encodeURIComponent('Login failed')}`);}
      req.session.user = user._id;
           return res.redirect('/home');
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
router.get("/home",userAuth,userController.LoadHomepage);
router.get("/shop",userAuth,userController.loadShoppingPage)
router.get("/productview",userAuth,productController.productViewPage);

//   User Profile
router.get("/profile",userAuth,userProfile.userProfile)
router.get("/editprofile",userAuth,userProfile.userEditprofile)
router.post("/editprofile",userAuth,profileUpload,userProfile.profileUpdate)
router.delete("/removeuserimage/:index",userAuth,userProfile.removeUserImage);
router.post("/change-password",userAuth,userProfile.changepassword)
router.post("/change-email", userAuth, userProfile.editemail);
router.get("/email-otp", userAuth, userProfile.getOtpPage);
router.post("/email-otp", userAuth, userProfile.verifyOtp);
router.post("/resend-Otp", userAuth, userProfile.resendOtp);
router.get("/referral",userAuth,userProfile.getreferralPage)
router.get("/logout",userController.logout)

//   Cart page
router.get("/cart",userAuth,cartController.renderCartPage)
router.post("/cart/add",userAuth,cartController.addTocart)
router.post("/cart/remove",userAuth,cartController.removeCartProduct)
router.post("/cart/update-quantity",userAuth,cartController.updateCartQuantity)

//   address page
router.get("/address",userAuth,addressController.addressPageload)
router.get("/address/add",userAuth,addressController.getaddressAddpage)
router.post("/address/add",userAuth,addressController.addaddressPage)
router.get("/address/edit/:addressId",userAuth,addressController.editAddressPageLoad)
router.post("/address/edit/:addressId",userAuth,addressController.editaddress)
router.delete("/address/delete/:addressId",userAuth,addressController.deleteAddress)
router.patch("/address/set-default/:addressId",userAuth,addressController.setDefaultAddress)

//wishlist Page
router.get("/wishlist",userAuth,whishlistController.getWishlistPage)
router.post("/wishlist/add",userAuth,whishlistController.addWishlist)
router.delete("/wishlist/remove/:productId",userAuth,whishlistController.deleteWishlistProduct)
router.post("/add/wishlist-cart/:productId", userAuth,whishlistController.addToCartFromWishlist);

//  checkOut page
router.get("/checkout",userAuth,checkOutController.checkOutpage)
router.post("/checkout",userAuth,checkOutController.checkoutHandler)

//  Order Page
router.get("/order/:orderId",userAuth,OrderController.getOrderPage)
router.get("/view-order",userAuth,OrderController.getViewOrderpage)
router.get("/order-details/:orderId",userAuth,OrderController.getOrderViewPage)
router.get("/order/invoice/:orderId", userAuth, OrderController.downloadInvoice);
router.post("/order-details/cancel",userAuth,OrderController.cancelOrder)
router.post("/order-details/return",userAuth,OrderController.orderReturn)

//  Wallect
router.get("/wallet",userAuth,walletController.getWalletPage)

// coupon controller
router.get('/coupons/available',userAuth,couponController.availableCoupon)
router.post("/coupons/apply",userAuth,couponController.applyCoupon)
router.post("/coupons/remove",userAuth,couponController.removeCoupon)

module.exports=router;                