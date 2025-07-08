const Category=require("../../models/categorySchema");
const { distance } = require('fastest-levenshtein');


//  category page rendering
const categoryInfo=async (req,res) => {
    try{

        const  page=parseInt(req.query.page)||1;
        const  limit=4;
        const  skip=(page-1)*limit;
        const search = req.query.search || '';
        
        const query = { isDeleted: false };
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }
        const categoryData=await  Category.find(query)
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit);

        const  totalCategories=await Category.countDocuments(query);
        const  totalPages=Math.ceil(totalCategories/limit);
        res.render("categoryManagement",{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories,
            search: search 
        }) 
    }catch(error){
       console.error(error);
       res.redirect(" /admin/pagenotFounderror")
    }
}


const normalizeName = (str) => {
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
};

const addCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const normalizedInput = normalizeName(name);

    const existingCategories = await Category.find({ isDeleted: false });

    const duplicate = existingCategories.find((category) => {
      const existingName = normalizeName(category.name);
      const dist = distance(normalizedInput, existingName);
      const maxLen = Math.max(normalizedInput.length, existingName.length);
      const similarity = 1 - dist / maxLen;

      return similarity >= 0.8; 
    });

    if (duplicate) {
      return res.status(400).json({
        error: `Category is too similar to existing: "${duplicate.name}"`,
      });
    }

    const newCategory = new Category({
      name: name.trim(),
      description,
    });

    await newCategory.save();
    return res.json({ message: 'Category added successfully' });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

//  listed category

const listedcategory=async(req,res)=>{
    try{
        let id=req.params.id
        await Category.updateOne({_id:id},{$set:{isListed:true}});
        res.status(200).json({message:"Category listed Successfully",redirectUrl:"/admin/category"})
    }catch(error){
       res.status(500).send("server error");
       res.redirect("/admin/pagenotFounderror");
    }
}
//  unlisted category
const unlistedcategory=async(req,res)=>{
    try{
      let id=req.params.id;
      await Category.updateOne({_id:id},{$set:{isListed:false}});
      res.status(200).json({message:"Category unlisted successfully",redirectUrl:"/admin/category"})
    }catch(error){
      res.status(500).send("server error");
      res.redirect("/admin/pagenotFounderror");
    }
}

//  edited category
const editCategory = async (req, res) => {
    try {
        let id = req.params.id;
        const { categoryname, description } = req.body;

        
        const existingCategory = await Category.findOne({ name: categoryname, _id: { $ne: id } ,isDeleted:true});
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exists. Please choose a different name" });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: categoryname, description },
            { new: true }
        );

        if (updatedCategory) {
            return res.status(200).json({ message: "Category updated successfully!", category: updatedCategory });
        } else {
            return res.status(404).json({ error: "Category not found." });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Server error. Please try again later." });
    }
};

const softDeleteCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const category = await Category.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new:true}
        );
        if (!category) {
            return res.status(404).json({error:"category Not found"})
        }

        return res.status(200).json({message:"  Category  deleted"})
    } catch (error) {
        console.error('Error soft deleting category:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
module.exports={
    categoryInfo,
    addCategory,
    listedcategory,
    unlistedcategory,
    editCategory,
    softDeleteCategory
}