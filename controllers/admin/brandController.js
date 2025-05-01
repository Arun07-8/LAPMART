const Brand = require("../../models/BrandSchema");




const brandInfo=async (req,res) => {
    try{

        const  page=parseInt(req.query.page)||1;
        const  limit=4;
        const  skip=(page-1)*limit;

 
        const branddata=await  Brand.find({isDeleted:true})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const  totalBrands=await Brand.countDocuments();
        const  totalPages=Math.ceil(totalBrands/limit); 
        res.render("brandMangement",{
            brand:branddata,
            currentPage:page,
            totalPages:totalPages,
            totalBrands:totalBrands
        }) 
    }catch(error){
       console.error(error);
       res.redirect("/admin/pagenotFounderror")
    }
}
//  add Brand
const addbrand=async (req,res) => {
    try {
        const {name,description}=req.body;
      
        
        const existingBrand=await Brand.findOne({name,isDeleted:true});
        if(existingBrand){
            return res.status(400).json({error:"Brand already exists"})
        }
        const newCategory=new Brand({
            name,
            description,
        })
        
        await newCategory.save();

        return res.json({message:"Brand added successfully"});
        
    } catch (error) {
        return res.status(500).json({error:"internal Server"})
        
    }
}
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
        let id=req.params.id;
        const {brandname,description}=req.body;

        const existingBrand=await  Brand.findOne({name:brandname,_id:{$ne:id}})
        if(existingBrand){
            return res.status(400).json({error:"Brand already exists.Please choose a different name"});
        }
        const  updatedBrand=await Brand.findByIdAndUpdate(
            id,
            {name:brandname,description},
            {new:true}
        );
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
            {isDeleted:false},
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