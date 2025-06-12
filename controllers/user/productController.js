const Product=require('../../models/productSchema');
const Category=require('../../models/categorySchema');
const User=require('../../models/userSchema');

//  Product view page
const productViewPage=async(req,res)=>{
    try{
        const userId=req.session.user;
        const productId=req.query.id;
        const product=await Product.findById({_id:productId}).populate('category');
        const findCategory=product.category;
        if(userId){
        const userData=await User.findById(userId);
        const similerProducts = await Product.find({category:findCategory,_id:{$ne:product._id},isDeleted:false,isListed:true})
            res.render("productViewPage",{
            user:userData,
            product:product,
            quantity:product.quantity,
            category:findCategory,
            similerProducts
        })
        }else{
        const similerProducts = await Product.find({category:findCategory,_id:{$ne:product._id},isDeleted:false,isListed:true})
            res.render("productViewPage",{
            product:product,
            quantity:product.quantity,
            category:findCategory,
            similerProducts
        })
        }
    }catch(error){
        console.error('error for fetching product details',error);
        res.redirect("/pageNotFound")
    }
}

module.exports={
    productViewPage,
}