const Offer=require("../models/offersSchema")


const applyBestOffer=async (product) => {
    try {
        if (!product || !product.salePrice || !product._id) {
            return product; 
    }
        const now=new Date()

        const offers=await Offer.find({
            isDeleted:false,
            isActive:true,
            status:"active",
            validFrom:{$lte:now},
            validUpto:{$gte:now},
            $or:[
                {offerType:"Product",applicableId:product._id},
                {offerType:"Category",applicableId:product.category},
                {offerType:"Brand",applicableId:product.brand}
            ]
        })

    if (!offers.length) {
      product.discountedPrice = product.salePrice;
      product.offerPercentage = 0;
      product.offerLabel = null;
      return product;
    }

    const validOffers = offers.filter(
      (offer) =>
        offer.discountType === 'percentage' &&
        typeof offer.offerAmount === 'number' &&
        offer.offerAmount > 1 &&
        offer.offerAmount <= 50
    );


    if (!validOffers.length) {
      product.discountedPrice = product.salePrice;
      product.offerPercentage = 0;
      product.offerLabel = null;
      return product;
    }


   const bestOffer = validOffers.sort((a, b) => b.offerAmount - a.offerAmount)[0];
   const discountAmount=(product.salePrice*bestOffer.offerAmount)/100;
   product.discountedPrice=Math.round(product.salePrice - discountAmount);
   product.finalPrice = product.discountedPrice;
   product.offerPercentage=bestOffer.offerAmount;
   product.offerLabel=bestOffer.offerName;

   return product;

} catch (error) {
    console.error("Offer apply error:", error.message);
    product.discountedPrice = product.salePrice;
    product.offerPercentage = 0;
    product.offerLabel = null;
    return product;
 }
}
module.exports={applyBestOffer}