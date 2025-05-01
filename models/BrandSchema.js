const mongoose=require("mongoose")
const {Schema}=mongoose


const BrandSchema=new Schema({

    name:{
        type:String,
        required:true,
    },
    description:{
        type:String,
        required:true,
    },
    isListed:{
        type:Boolean,
        default:true,        
    },
    isDeleted:{
        type:Boolean,
        default:true,
    }
},{ timestamps: true })

const Brand=mongoose.model("Brand",BrandSchema);
module.exports=Brand;