const Order=require("../../models/orderSchema")
const User=require("../../models/userSchema")
const Address=require("../../models/addressSchema")
const Cart=require("../../models/cartSchema")
const Wishlist=require("../../models/wishlistSchema")

const getOrderPage = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderid=req.params.orderId
        if (!userId) {
            return res.redirect("/login");
        }

        const userData = await User.findById(userId);
        if (!userData) {
            return res.redirect("/login");
        }
        const order = await Order.findById(orderid).populate("orderedItems.product")
        res.render("Orderpage", {
            userData,
            order
        });
    } catch (error) {
        console.error("Order page error:", error);
        res.redirect("/pageNotFound");
    }
};
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { addressId, paymentMethod } = req.body;
        if (!addressId || !paymentMethod) {
            console.error("Missing addressId or paymentMethod:", { addressId, paymentMethod });
            return res.status(400).json({
                success: false,
                message: { title: "Invalid Input", text: "Please select an address and payment method.", icon: "warning" },
            });
        }

        const validPaymentMethods = ["Cash on Delivery"];
        if (!validPaymentMethods.includes(paymentMethod)) {
            console.error("Invalid payment method:", paymentMethod);
            return res.status(400).json({
                success: false,
                message: { title: "Invalid Payment Method", text: "Selected payment method is not supported.", icon: "warning" },
            });
        }

        const cart = await Cart.findOne({ userId }).populate("items.productId");
        if (!cart || cart.items.length === 0) {
            console.error("Cart is empty or not found for userId:", userId);
            return res.status(400).json({
                success: false,
                message: { title: "Empty Cart", text: "Your cart is empty.", icon: "warning" },
            });
        }

        const totalPrice = cart.items.reduce((sum, item) => sum + item.productId.salePrice * item.quantity, 0);

    const selectedAddress= await Address.findOne(
  { userId, "address._id":addressId },
  { "address.$": 1 } 
);

        if (!selectedAddress) {
            console.error("Address not found for addressId:", addressId);
            return res.status(400).json({
                success: false,
                message: { title: "Invalid Address", text: "The selected address does not exist.", icon: "warning" },
            });
        }
        
     
        const orderItems = cart.items.map((item) => ({
            product: item.productId._id,
            quantity: item.quantity,
            price: item.productId.salePrice,
        }));
        const discount = 0;
        const finalAmount = totalPrice - discount;
        const addr = selectedAddress.address[0]; 

        const order = new Order({
            userId,
            orderedItems: orderItems,
            totalPrice,
            discount,
            finalAmount,
            shippingAddress: addr,
            paymentMethod,
            invoiceDate: new Date(),
            status: "Pending",
        });

        const savedOrder = await order.save();

        await Cart.updateOne({ userId }, { $set: { items: [] } });

        // Clear wishlist (if applicable)
        const wishlist = await Wishlist.findOne({ userId });
        console.log("wishlist",wishlist)
        if (wishlist) {
            await Wishlist.updateOne({ userId }, { $set: { items: [] } });
            console.log("Wishlist cleared for userId:", userId);
        }

        res.status(200).json({
            success: true,
            orderId: savedOrder._id,
            message: { title: "Success", text: "Order placed successfully!", icon: "success" },
        });
    } catch (error) {
        console.error("Place order error:", error.stack);
        res.status(500).json({
            success: false,
            message: { title: "Error", text: "Failed to place order. Please try again.", icon: "error" },
        });
    }
};

const getViewOrderpage=async (req,res) => {
    try {
        const userId=req.session.user
        const userData=await User.findById(userId)
        res.render("ordersDetails",{userData})
    } catch (error) {
        console.error("page rendering error",error)
        res.redirect("/pageNotFound")
    }
}
module.exports={
    getOrderPage,
    placeOrder,
    getViewOrderpage
}