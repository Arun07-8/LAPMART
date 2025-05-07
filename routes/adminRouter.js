const express=require("express");
const router=express.Router();
const adminController=require("../controllers/admin/adminController");
const customerController=require("../controllers/admin/customerController");
const categoryController=require("../controllers/admin/categoryController");
const brandController=require("../controllers/admin/brandController");
const productController=require("../controllers/admin/productController")
const  {adminAuth,userAuth}=require("../middlewares/Auth");
const {uploads}=require("../config/multer")


//  error 404
router.get("/pagenotFounderror",adminController.pagenotFounderror);

//  Admin Login
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/dashBoard",adminAuth,adminController.loadDashbard);
router.get("/logout",adminController.logout);

//  Customer Management 
router.get("/users",adminAuth,customerController.customerInfo);
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
router.get("/products",adminAuth,productController.produtInfo);
router.get("/addProducts",adminAuth,productController.loadaddProduct)
router.post("/addProduct",adminAuth,uploads,productController.addProducts)
router.patch("/listedProduct/:id",adminAuth,productController.listedProduct);
router.patch("/unlistedProduct/:id",adminAuth,productController.unlistedProduct);
router.get("/editProduct/:id",adminAuth,productController.loadEditProduct)
router.post("/editProduct/:id",adminAuth,uploads,productController.editProduct)
router.delete("/remove-product-image/:productId/:index",adminAuth,productController.removeProductImage);
router.post("/deleteImage",adminAuth,productController.deleteProductImage)
router.patch("/deleteProducts/:id",adminAuth,productController.deleteProduct)
module.exports=router;