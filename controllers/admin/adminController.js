const User=require("../../models/userSchema");
const mongoose=require("mongoose");
const bcrypt=require("bcrypt");


//    error 404
const pagenotFounderror=async (req,res) => {
    try{
        res.render("adminError")
    }catch(error){
        res.redirect("/pagenotFounderror")
        
    }
}    


//    Admin Login Management
const loadLogin = async (req, res) => {
    try {
        if (req.session.admin) {
            return res.redirect('/admin/dashboard'); 
        }
        const message = req.session.Mes || null; 
      
        
        req.session.message = null; 
        res.render("adminlogin", { message }); 
    } catch (error) {
        console.error("Admin login page error:", error);
        res.redirect("/admin/pagenotFounderror");
    }
};

const login=async(req,res)=>{
    try{
        const {email,password}=req.body;
          
        const admin=await User.findOne({email,isadmin:true})
        if(admin){
            const passwordmatch = await bcrypt.compare(password, admin.password);
          
            
            if(passwordmatch){   
                req.session.admin=admin
                req.session.Mess="Admin Login Successfully";
                return res.redirect("/admin/dashBoard");
            }else{
                req.session.Mes={type:"error",text:"Password do not match"}
                return res.redirect("/admin/login");
            }
        }else{
            req.session.Mes={type:"error",text:"INVALID ADMIN"}
            return res.redirect("/admin/login")
        }
    }catch(error){
       console.error("login error",error);
       return res.redirect("/admin/pagenotFounderror");
    }
}

//     Admin  Dashboard rendering
const  loadDashbard=async (req,res) => {
            try {
                if(req.session.admin){
                    message=req.session.Mess;
                    req.session.Mess=null;
                    res.render("dashBoard",{message});
                }else{
                    res.redirect("/admin/login");
                }
            } catch (error) {
                res.redirect("/pagenotFounderror")

            }
        }

//    Admin  logout
const  logout=async (req,res) => {
    try{
       req.session.destroy(error=>{
        if(error){
            console.error("Error destroying session");
            return res.redirect('/pagenotFounderror')
            
        }
        res.redirect("/admin/login");
       })
    }catch(error){
        console.error("unexpected error durring  logout",error);
        res.redirect("/pagenotFounderror")
        

    }
}
module.exports={loadLogin,
    login,
    loadDashbard,
    pagenotFounderror,
    logout,
};