const User =require("../models/userSchema");

const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{ 
             if(!data.isBlocked){
                 next(); 
                }else{
                    req.session.user=null
                res.redirect("/login")
             }
        })
        .catch(error=>{
            console.error("Error in user auth middleware",error);
            res.status(500).send("Internal Server error");
        })  
    }else{
        res.redirect("/login")
    }
}
module.exports={userAuth}