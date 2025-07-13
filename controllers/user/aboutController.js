const User=require("../../models/userSchema")

const getAboutPage=async (req,res) => {
    try {
        const userId=req.session.user
        const userData=await User.findById(userId)
        res.render("about",{user:userData})
    } catch (error) {
        console.error("the about page rendering time error :",error)
        res.redirect("/pageNotFoundgen")
    }
}
module.exports={
    getAboutPage
}