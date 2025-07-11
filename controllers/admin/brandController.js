const Brand = require("../../models/BrandSchema");
const { distance } = require('fastest-levenshtein');

const brandInfo = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

     
        const query = { isDeleted: false };
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const branddata = await Brand.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);


        const totalBrands = await Brand.countDocuments(query);
        const totalPages = Math.ceil(totalBrands / limit);

        res.render("brandMangement", {
            brand: branddata,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands,
            search: search  
        });
    } catch (error) {
        console.error('Error in brandInfo:', error);
        res.redirect("/admin/pagenotFounderror");
    }
};



const normalizeName = (str) => {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
};

const addbrand = async (req, res) => {
  try {
    const { name, description } = req.body;
    const normalizedInput = normalizeName(name);

    const existingBrands = await Brand.find({ isDeleted: false });

      const duplicate = existingBrands.find((brand) => {
      const existingName = normalizeName(brand.name);
      const dist = distance(normalizedInput, existingName);
      const maxLen = Math.max(normalizedInput.length, existingName.length);
      const similarity = 1 - dist / maxLen;

      return similarity >= 0.8; 
    });

    if (duplicate) {
      return res.status(400).json({
        error: `Brand is too similar to existing brand: "${duplicate.name}"`,
      });
    }

    const newBrand = new Brand({
      name: name.trim(),
      description,
    });

    await newBrand.save();

    return res.json({ message: 'Brand added successfully' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};



// listed Brand
const listedBrand=async (req,res) => {
    try{
     let id=req.params.id;
     await Brand.updateOne({_id:id},{$set:{isListed:true}});
     res.status(200).json({message:"Brand listed Successfully",redirectUrl:"/admin/brand"})
    }catch(error){
        console.error('Error listing brand:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
}


//  unlisted Brand
const unlistedBrand=async (req,res) => {
    try{
        let id=req.params.id;
        await Brand.updateOne({_id:id},{$set:{isListed:false}});
        res.status(200).json({message:"Brand Unlisted Successfully",redirectUrl:"/admin/brand"})
    }catch(error){
        console.error('Error unlisting brand:', error);
        res.status(500).json({ error: 'Server error' });
        res.redirect("/admin/pagenotFounderror");
    }
}

//  edited  brand
const editBrand=async (req,res) => {
    try{
        const {id}=req.params
        const {name,description}=req.body;
        const updatedBrand = await Brand.findByIdAndUpdate(id,{name,description},{new:true})    
        if(updatedBrand){
            return res.status(200).json({message:"Brand updated successfully",brand:updatedBrand})
        }else{
            return res.status(404).json({error:"Brand not found"})
        }
    }catch(error){
        console.error(error);
        return res.status(500).json({error:"server error. Please try again later"})
        
    }
}

//  deleted brand
const softdeleteBrand=async (req,res) => {
    try{
        const id=req.params.id;   
        const delBrand=await Brand.findByIdAndUpdate( 
            id,
            {isDeleted:true},
            {new:true}
        );
        if(!delBrand){
            return res.status(404).json({error:"Brand Not found"});
        }
        return res.status(200).json({message:"Brand deleted"});
    }catch(error){
        console.error("Error soft deleted  brand:",error);
        return res.status(500).json({error:"Internal server error"});
         
    }
}
module.exports={
    brandInfo,
    addbrand,
    listedBrand,
    unlistedBrand,
    editBrand,
    softdeleteBrand,
}