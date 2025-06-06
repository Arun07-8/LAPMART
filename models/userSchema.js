const mongoose=require("mongoose");
const {Schema}=mongoose;


const userSchema=new Schema({
    name:{
         type:String,
         required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    phoneNumber:{
        type:String,
        required:false,
        // unique:true,
        // sparse:true,
        default:null
    },
    googleid:{ 
        type:String,
        sparse:true,
        unique:true
    },
    password:{
        type:String,
        required:false,
    },
    isBlocked:{
        type:Boolean,
        default:false
    },
    isadmin:{
        type:Boolean,
        default:false
    },
    cart:[{
        type:Schema.Types.ObjectId,
        ref:"Cart",
    }],
    wallet:{
        type:Number,
        default:0,
    },
    wishlist:[{
        type:Schema.Types.ObjectId,
        ref:"Wishlist"
    }],
    orderHistory:[{
        type:Schema.Types.ObjectId,
        ref:"Order"
    }],
    createdAt:{
        type:Date,
        default:Date.now,
    },
    referalCode:{
        type:String,
        // required:true
    },
    redeemed:{
        type:Boolean,
        // default:fasle
    },
    redeemedUsers:[{
        type:Schema.Types.ObjectId,
        ref:"User",
        // required:true
    }],
    searchHistory:[{
        category:{
            type:Schema.Types.ObjectId,
            ref:"Category",
        },
        brand:{
            type:String
        },
        searchOn:{
            type:Date,
            default:Date.now
        }
    }]

})
const User=mongoose.model("User",userSchema);

module.exports=User;