const User=require("../../models/userSchema");



//  user Info rendering
const customerInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1;
        const limit = 3;

        const query = {
            isadmin: false,
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } }
            ]
        };

        const userData = await User.find(query)/*  */
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

          
            
        const count = await User.countDocuments(query)
        res.render("usersManagement",{
            data: userData,
            currentPage: page,
            totalPages: Math.ceil(count / limit),
            search: search.trim(),
            path:req.path
        });
    } catch (error) {
        console.error("Error in customerInfo:", error);
        res.render("usersManagement", {
            data: [],
            currentPage: 1,
            totalPages: 1,
            search: "",
            errorMsg: "Something went wrong!"
        });
    }
};


//  blockuser
const blockUser=async (req,res) => {
    try{
    
        let  id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:true}});
        res.redirect("/admin/users");

    }catch(error){
        res.redirect("/pageNotFounderror");

    }
}
const unblockUser=async (req,res) => {
    try{

        let  id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("users")

    }catch(error){
        res.redirect("/pageNotFounderror")

    }
}

module.exports={
    customerInfo,
    blockUser,
    unblockUser
}