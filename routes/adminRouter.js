const express=require("express");
const router=express.Router();
const adminController=require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController");
const categoryController=require("../controllers/admin/categoryController");
const brandController=require("../controllers/admin/brandController");
const productController=require("../controllers/admin/productController")
const orderMangementController=require("../controllers/admin/orderMangementController")
const couponController=require("../controllers/admin/couponController")
const offersController=require("../controllers/admin/offersController")
const salesReporterController=require("../controllers/admin/salesReporterController")
const dashboardController=require("../controllers/admin/dasboardController")
const {adminAuth}=require("../middlewares/adminAuth");
const {productUpload}=require("../config/multer")


//  error 404
router.get("/pagenotFounderror",adminController.pagenotFounderror);

//  Admin Login
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/logout",adminController.logout);

//  Customer Management 
router.get("/users",adminAuth,customerController.searchUsers);
router.patch("/blockUser/:id",adminAuth,customerController.blockUser);
router.patch("/unblockUser/:id",adminAuth,customerController.unblockUser);

//  Category Management
router.get("/category",adminAuth,categoryController.categoryInfo)
router.post("/addCategory",adminAuth,categoryController.addCategory);   
router.patch("/listedCategory/:id",adminAuth,categoryController.listedcategory);
router.patch("/unlistedCategory/:id",adminAuth,categoryController.unlistedcategory)
router.post("/editCategory/:id",adminAuth,categoryController.editCategory);
router.patch("/categoryDelete/:id",adminAuth,categoryController.softDeleteCategory)

//  Brand Managemnet 
router.get ("/brand",adminAuth,brandController.brandInfo);
router.post("/addbrand",adminAuth,brandController.addbrand);
router.patch("/listedBrand/:id",adminAuth,brandController.listedBrand);
router.patch("/unlistedBrand/:id",adminAuth,brandController.unlistedBrand);
router.post("/editBrand/:id",adminAuth,brandController.editBrand)
router.patch("/deleteBrand/:id",adminAuth,brandController.softdeleteBrand);

//  Products Managment
router.get("/products",adminAuth,productController. productInfo); 
router.get("/addProducts",adminAuth,productController.loadaddProduct)
router.post("/addProduct",adminAuth,productUpload,productController.addProducts)
router.patch("/listedProduct/:id",adminAuth,productController.listedProduct);
router.patch("/unlistedProduct/:id",adminAuth,productController.unlistedProduct);
router.get("/editProduct/:id",adminAuth,productController.loadEditProduct)
router.post("/editProduct/:id",adminAuth,productUpload,productController.editProduct)
router.delete("/remove-product-image/:productId/:index",adminAuth,productController.removeProductImage);
router.patch("/deleteProducts/:id",adminAuth,productController.deleteProduct)

//  OrderManagement
router.get("/order-management", adminAuth, orderMangementController.getOrderManagementPage);
router.get("/order-view/:id", adminAuth, orderMangementController.getOrderDetailspage);
router.patch("/orders-status/:orderId", adminAuth, orderMangementController.updateStatus);
router.patch("/orders/:orderId/accept/:productId", adminAuth, orderMangementController.acceptReturn);
router.patch("/orders/:orderId/reject/:productId", adminAuth, orderMangementController.rejectReturn);

//  CouponManagement
router.get("/coupon",adminAuth,couponController.couponManagementpage)
router.get("/addcoupon",adminAuth,couponController.addCouponpage)
router.post("/addcoupon",adminAuth,couponController.addnewCoupon)
router.patch("/active-coupon/:id",adminAuth,couponController.activeCoupon)
router.patch("/inactive-coupon/:id",adminAuth,couponController.inactiveCoupon)
router.get("/edit-coupon/:couponId",adminAuth,couponController.editCoupon)
router.post("/edit-coupon/:couponId",adminAuth,couponController.editpageCoupon)
router.patch("/coupondelete/:id",adminAuth,couponController.deleteCoupon)

//  OffersManagement
router.get("/offers",adminAuth,offersController.OffersManagement)
router.get("/add-offers",adminAuth,offersController.offerAdd)
router.post("/add-offers",adminAuth,offersController.createOffer)
router.get('/offer-products', offersController.listAvailableProducts);
router.get('/offer-categories', offersController.listAvailableCategories);
router.get('/offer-brands', offersController.listAvailableBrands);
router.patch("/active-offers/:id",adminAuth,offersController.activeOffer)
router.patch("/inactive-offers/:id",adminAuth,offersController.inActiveOffer)
router.get("/edit-offer/:id",adminAuth,offersController.editOffer)
router.post("/edit-offer/:id",adminAuth,offersController.editOfferPage)
router.patch("/offerdelete/:id",adminAuth,offersController.deleteOffer)


//  SalesReport
router.get("/sales-report",adminAuth, salesReporterController.getSalesReport);
router.post("/filter-sales-report",adminAuth,  salesReporterController.filterSalesReport);
router.post("/export-sales-report-pdf",adminAuth,  salesReporterController.exportSalesReportPDF);
router.post("/export-sales-report-excel",adminAuth,  salesReporterController.exportSalesReportExcel);

//  Dashboard
router.get("/dashBoard",adminAuth,dashboardController.loadDashbard);
module.exports=router;