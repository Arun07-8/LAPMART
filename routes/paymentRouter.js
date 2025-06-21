const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/user/paymentController');
const {userAuth}=require("../middlewares/userAuth")

router.post('/create-order',userAuth,paymentController.createOrder);
router.post("/verify", userAuth,paymentController.verifyPayment);
router.post("/verify-cod",userAuth,paymentController.createCODOrder)
router.get("/payment-failed",userAuth,paymentController.paymentFailed)
router.post("/retry-payment",userAuth, paymentController.retryPayment);
router.post("/order/pay-with-wallet",userAuth,paymentController.walletPayment)
module.exports = router;
