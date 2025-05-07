const User = require("../../models/userSchema");
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
require('dotenv').config();
const session = require('express-session');
const saltround = 10;
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const forgotEmailvalid = async (req, res) => {
    try {
        const { email } = req.body;
      
        const findUser = await User.findOne({ email,isadmin:false});
        if (!findUser) {
            return res.status(404).json({
                success: false,
                message: 'User with this email does not exist',
            });
        }
        if (findUser.googleid) {
            return res.status(404).json({
                success: false,
                message: 'Can not change password this google account',
            });
        }
        const otp = generateOtp();
        console.log('Generated OTP:', otp);
        const otpExpiration = new Date(Date.now() + 30 * 1000); // OTP expires in 30 seconds
        const emailSent = await sendVerificationEmail(email, otp);
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP. Please try again.',
            });
        }

        req.session.userOtp = { otp, expiresAt: otpExpiration };
        req.session.email = email;
        res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
        });
    } catch (error) {
        console.error('Error in forgotEmailvalid:', error);
        res.status(500).json({
            success: false,
            message: 'Something went wrong. Please try again.',
        });
    }
};

const securePassword = async (password) => {
    try {
      
        const passwordHash = await bcrypt.hash(password,saltround); 
        return passwordHash;
    } catch (error) {
        console.error("Error hashing password:", error.message, error.stack);
        return null;
    }
};
const sendVerificationEmail = async (email, otp) => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
        });

        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Your OTP for Password Reset',
            text: `Your OTP is ${otp}. It is valid for 30 seconds.`,
            html: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2>Your OTP Code</h2>
                <p style="font-size: 18px; color: #555;">
                    Your OTP is <b style="color: blue; font-size: 22px;">${otp}</b>
                </p>
                <p>Please enter this OTP to verify your account.</p>
            </div>`,
        };

        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
        return false;
    }
};

const getforgetPass = async (req, res) => {
    try {
        res.render("email-forgot");
    } catch (error) {
        console.error('Error in getforgetPass:', error);
        res.redirect("/pageNotFound");
    }
};

const loadVerifyOtp = async (req, res) => {
    try {
        if (!req.session.email) {
            return res.redirect("/forgot-password");
        }
        res.render("forget-Otp");
    } catch (error) {
        console.error("Error loading OTP page:", error);
        res.redirect("/pageNotFound");
    }
};

const otpVerify = async (req, res) => {
    try {
        const { otp } = req.body;
        const storedOtpData = req.session.userOtp;

        if (!storedOtpData || !storedOtpData.otp || !storedOtpData.expiresAt) {
            return res.status(400).json({
                success: false,
                message: "No OTP found or session expired",
            });
        }
        if (new Date() > new Date(storedOtpData.expiresAt)) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please resend a new OTP.",
            });
        }

        if (otp === storedOtpData.otp) {
            return res.json({
                success: true,
                redirectUrl: "/reset-password",
            });
        } else {
            return res.json({
                success: false,
                message: "Invalid OTP. Please try again.",
            });
        }
    } catch (error) {
        console.error("Error verifying OTP:", error.message, error.stack);
        res.status(500).json({
            success: false,
            message: "An error occurred. Please try again.",
        });
    }
};

const getRestPassPage = async (req, res) => {
    try {
        if (!req.session.userOtp) {
            return res.redirect("/forgot-password");
        }
        res.render("changepassword");
    } catch (error) {
        console.error("Error loading reset password page:", error);
        res.redirect("/pageNotFound");
    }
};

const newPasswordSet=async (req,res) => {
  try {
    const {newPass1,newPass2}=req.body;
    console.log(newPass1);
    
    const email=req.session.email;
    if(newPass1===newPass2){
    
      const passwordHash=await securePassword(newPass1);
      console.log("hello",passwordHash);
      await User.updateOne(
        {email:email},
        {$set:{password:passwordHash}}
      )
      res.json({success:true,message:"Password Changed SuccessFuly"})
    }else{
      res.json({success:false,message:"Password do not match"});
    }
  } catch (error) {
    res.redirect("/pageNotFound")
  }
}
const loadresendOtp = async (req, res) => {
    try {
        const email = req.session.email;
        console.log('Resend OTP email:', email);

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email not found in session. Please start over.",
            });
        }
        const otp = generateOtp();
        const otpExpiration = new Date(Date.now() + 30 * 1000); // OTP expires in 30 seconds
        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP email. Please try again.",
            });
        }

        req.session.userOtp = { otp, expiresAt: otpExpiration };
        console.log("Resend OTP:", otp);

        res.status(200).json({
            success: true,
            message: "OTP resent successfully",
        });
    } catch (error) {
        console.error("Error resending OTP:", error.message, error.stack);
        res.status(500).json({
            success: false,
            message: "Failed to resend OTP. Please try again.",
        });
    }
};

module.exports = {
    getforgetPass,
    forgotEmailvalid,
    loadVerifyOtp,
    otpVerify,
    getRestPassPage,
    loadresendOtp,
    newPasswordSet
};