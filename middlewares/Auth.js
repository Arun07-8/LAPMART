const User = require("../models/userSchema");

const adminAuth=(req,res,next)=>{
    if(req.session.admin){
    User.findOne({_id:req.session.admin,isadmin:true})
    .then(data=>{
        if(data){

            next()
        }else{
            res.redirect("/admin/login");
        }
    }).catch(error=>{
        console.error("Error in admin auth middleware");
        res.status(500).send("Internal Server error")
        
    })
   }else{
    res.redirect("/admin/login")
   }
}


const userAuth=(req,res,next)=>{
    if(req.session.user){
        User.findById(req.session.user)
        .then(data=>{
             if(data && !data.isBlocked){
                next();
             }else{
                res.redirect("/login")
             }
        })
        .catch(error=>{
            console.error("Error in user auth middleware");
            res.status(500).send("Internal Server error");
            
        })
    }else{
        res.redirect("/login");
    }
}
module.exports={userAuth,adminAuth}