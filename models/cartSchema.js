const mongoose=require("mongoose");
const {Schema}=momgoose;

const   cartSchema=new Schema({
     userId:{
        type:Schema.Types.objectID,
        ref:"User",
        required:true,
     },
     items:[{
        productId:{
            types:Schema.Types.objectID,
            ref:"Product",
            required:true,
        },
        quantity:{
            type:Number,
            default:1,
        },
        price:{
            type:Number,
            required:true,
        },
        totalPrice:{
            type:Number,
            required:true
        },
        status:{
            type:String,
            default:"placed"
        },
        cancellateReason:{
            type:String,
            default:"none",
        }
     }]

})  

const Cart=mongoose.model("Cart",cartSchema);
module.exports=Cart;