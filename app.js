const express=require('express');
const app=express();
const path=require("path");
const env=require("dotenv").config()
const session=require("express-session");
const db=require("./config/db");
const userRouter=require("./routes/userRouter")
const adminRouter=require("./routes/adminRouter")
const passport=require("./config/passport");
const nocache = require('nocache');
const cloudinary=require('cloudinary').v2;

db()

app.use(nocache())
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine","ejs");
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge: 1000 * 60 * 60 * 24
    }
}))
app.use(passport.initialize())
app.use(passport.session())
app.use('/uploads', express.static('uploads'));
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,"views/admin")]);
app.use(express.static(path.join(__dirname,"public")));
app.use('/',userRouter);
app.use("/admin",adminRouter);
app.use('/hello')


app.listen(process.env.PORT,()=>{
    console.log("Server is Running");
    
})

module.exports=app;