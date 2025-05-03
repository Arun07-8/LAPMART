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
        res.redirect("/admin/pageNotFounderror")
    }
};


//  blockuser
const blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        await User.updateOne({ _id: id }, { $set: { isBlocked: true } });
        return res.status(200).json({ message: 'User blocked successfully' });
    } catch (error) {
        console.error('Error blocking user:', error);
        return res.status(500).json({ error: 'An error occurred while blocking the user' });
    }
};

const unblockUser = async (req, res) => {
    try {
        const { id } = req.params; 
       
        await User.updateOne({ _id: id }, { $set: { isBlocked: false } });
        return res.status(200).json({ message: 'User unblocked successfully' });
    } catch (error) {
        console.error('Error unblocking user:', error);
        return res.status(500).json({ error: 'An error occurred while unblocking the user' });
    }
};

module.exports = { blockUser, unblockUser };

module.exports={
    customerInfo,
    blockUser,
    unblockUser
}