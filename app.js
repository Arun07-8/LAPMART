const express=require('express');
const app=express();
const path=require("path");
const env=require("dotenv").config()
const session=require("express-session");
const db=require("./config/db");
const userRouter=require("./routes/userRouter")
const adminRouter=require("./routes/adminRouter")
const paymentRouter=require("./routes/paymentRouter")
const passport=require("./config/passport");
const nocache = require('nocache');
const morgan=require('morgan');
const cloudinary=require('cloudinary').v2;
const errorHandler = require('./middlewares/errorHandler');
require('dotenv').config();

const MongoStore = require('connect-mongo')


db()

app.use(nocache())
app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.set("view engine","ejs");

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,                    
    saveUninitialized: false,          
    store: MongoStore.create({        
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions'       
    }),
    cookie: {
        secure: false,                
        httpOnly: true,                
        maxAge: 1000 * 60 * 60 * 24    
    }
}));

app.use(express.static("public"));
app.use(passport.initialize())
app.use(passport.session())



app.use('/uploads', express.static('uploads'));
app.set("views",[path.join(__dirname,"views/user"),path.join(__dirname,"views/admin")]);


app.use("/admin",adminRouter);
app.use('/',userRouter);
app.use("/payment", paymentRouter); 
app.use(errorHandler)


app.use(morgan('dev'));
app.listen(process.env.PORT,()=>{
    console.log("Server is Running");
    
})

module.exports=app;