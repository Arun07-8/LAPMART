const Product=require('../../models/productSchema');
const Category=require('../../models/categorySchema');
const User=require('../../models/userSchema');
const {applyBestOffer}=require("../../helpers/offerHelper")
//  Product view page
const productViewPage=async(req,res)=>{
    try{
        const userId=req.session.user;
        const productId=req.query.id;
        const product=await Product.findById({_id:productId}).populate('category').lean();
        const findCategory=product.category;
        const upadtedProduct=await applyBestOffer(product)
        const similerProducts = await Product.find({category:findCategory,_id:{$ne:product._id},isDeleted:false,isListed:true})
        const  applyoffsimilerProducts = await Promise.all(similerProducts.map(p => applyBestOffer(p)));
        if(userId){
        const userData=await User.findById(userId);
            res.render("productViewPage",{
            user:userData,
            product: upadtedProduct,
            quantity:product.quantity,
            category:findCategory,
            applyoffsimilerProducts
        })
        }else{
            res.render("productViewPage",{
            product: upadtedProduct,
            quantity:product.quantity,
            category:findCategory,
            applyoffsimilerProducts
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