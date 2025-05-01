const User=require("../../models/userSchema")
const nodemailer=require('nodemailer');
const bcrypt=require('bcrypt');
const env=require('dotenv').config();
const session=require('express-session'); 

function generateOtp(){
   const  digits='1234567890';
   let otp="";
   for(let i=0;i<6;i++){
     otp+=digits[Math.floor(Match.random()*10)];
   }  
   return otp;
}
const sendVerificationEmail=async (email,otp) => {
    try {
        
        const transporter= nodemailor.createTransport({
            service:'gmail',
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                password:process.env.NODEMAILER_PASSWORD,

            }
        })

        const mailinfo = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to:email,
            subject: "Your One-Time Password (OTP) for Account Verification",
            text: `Your OTP is ${otp}`,
            html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Your OTP Code</h2>
                <p style="font-size: 18px; color: #555;">
                    Your OTP is <b style="color: blue; font-size: 22px;">${otp}</b>
                </p>
                <p>Please enter this OTP to verify your account.</p>
            </div>`,
        });
        const info=await transporter.sendMail(mailinfo);
        console.log("email send:",info.messageId);
        return true
    } catch (error) {
        console.error("Error sending ");
    }
}

const getforgetPass=async (req,res) => {
    try {
        
        const message=req.session.Mesg
        console.log(message);
        
        req.session.Mesg=null
        res.render("email-forgot",{message})
    } catch (error) {
        res.redirect("/pageNotFoundr")
        
    }
}
const forgotEmailvalid=async (req,res) => {
    try {
        const email=req.body  

        const findUser=await User.findOne({email:email});
        if(findUser){
            const otp=generateOtp();
            const emailsent=await sendVerificationEmail(email.otp);
            if(emailsent){
                req.session.UserOtp=otp;
                req.session.email=email;
                res.render('verify-Otp');
                console.log("OTP",otp)
            }else{
                res.json({succes:false,message:"Failed to send OTP please try again"})

            }
        }else{
        req.session.Mesg="User with  this email does not exist"
           res.render('/forgot-password')
        }
      
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

module.exports=({getforgetPass,forgotEmailvalid})