const  mongoose=require("mongoose");
const {Schema}=mongoose;

const CategorySchema= new mongoose.Schema({
    name:{
        type:String,
        required:true,
        unique:true,
    },
    description:{
        type:String,
        required:true,
    },
    isListed:{
        type:Boolean,
        default:true,
    },
    isDeleted: {
        type: Boolean,
        default: true,
    },
},{ timestamps: true })

const Category=mongoose.model("Category",CategorySchema);

module.exports=Category
