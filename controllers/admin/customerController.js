const User=require("../../models/userSchema");


const searchUsers = async (req, res) => {
    try {
        let search = decodeURIComponent(req.query.search || "").trim();
        const page = parseInt(req.query.page) || 1;
        const limit = 10; 
        const searchTerms = search.split(/\s+/).filter(term => term.length > 0);

        if (searchTerms.some(term => term.length < 2)) {
            return res.status(400).json({ error: 'Search terms must be at least 2 characters long' });
        }

        const regexQueries = searchTerms.map(term => ({
            $or: [
                { name: { $regex: term, $options: "i" } },
                { email: { $regex: term, $options: "i" } }
            ]
        }));

        const query = {
            isadmin: false,
            ...(searchTerms.length > 0 ? { $and: regexQueries } : {})
        };

        const users = await User.find(query)
            .select('name email phoneNumber profileImage createdAt isBlocked ')
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);
        if (req.headers.accept.includes('application/json')) {
            res.json({ users, currentPage: page, totalPages });
        } else {
            res.render('usersManagement', { 
                data: users, 
                search, 
                currentPage: page, 
                totalPages,
            });
        }
    } catch (error) {
        console.error('Error fetching users:', error.message, error.stack);
        res.status(500).json({ error: 'Internal server error' });
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



module.exports={
  searchUsers,
    blockUser,
    unblockUser
}