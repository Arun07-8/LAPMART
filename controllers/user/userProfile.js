const User = require("../../models/userSchema")
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const cloudinary = require('../../config/cloudinary');
const saltround = 10;

const userProfile = async (req, res) => {
    try { 
        let user = req.session.user
        if (user) {
            const userData = await User.findById(user)

            res.render("userprofile", { user: userData })
        } else {
            res.redirect("/login")
        }
    } catch (error) {
        res.redirect("error", error)
    }
}

const userEditprofile = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)
        res.render("editprofle", { user: user, userId: userId ,currentPage:"editprofile"})

    } catch (error) {
        console.error("edit profile occur error", error)
        res.redirect("/pageNotFound")
    }
}


const profileUpdate = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) return res.status(401).json({ success: false, message: 'User not authenticated' });

        const { name, phoneNumber } = req.body;
        const updateData = { name, phoneNumber };

        if (req.file) {
            updateData.profileImage = req.file.path;
        }
        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true, runValidators: true });

        if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found' });

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                name: updatedUser.name,
                phoneNumber: updatedUser.phoneNumber,
                profileImage: updatedUser.profileImage || null
            }
        });
    } catch (error) {
        console.error('Edit Profile Error:', error);
        res.status(500).json({ success: false, message: 'Server error while updating profile' });
    }
};
const removeUserImage = async (req, res) => {
  try {
    const userId = req.session.user;
    const { index } = req.params;

    const imageIndex = parseInt(index);
    const actualUserId = typeof userId === 'object' ? userId._id || userId.id : userId;

    if (!actualUserId || !actualUserId.toString().match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    if (isNaN(imageIndex) || imageIndex < 0) {
      return res.status(400).json({
        success: false,
        message: `Invalid image index. Received: ${index}, Parsed: ${imageIndex}`,
      });
    }

    let rawUser = await User.findById(actualUserId).lean();
    if (!rawUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (typeof rawUser.wallet === 'number') {
      rawUser.wallet = undefined; 
    }

    const user = User.hydrate(rawUser);

    if (!user.profileImage || user.profileImage.length === 0) {
      return res.status(400).json({ success: false, message: 'No profile images found' });
    }

    if (imageIndex >= user.profileImage.length) {
      return res.status(400).json({ success: false, message: 'Image index out of bounds' });
    }

    const imageUrl = user.profileImage[imageIndex];

    const getPublicIdFromUrl = (url) => {
      if (!url) return null;
      const regex = /\/ProfilePictures\/(.+?)\.(?:jpg|jpeg|png|webp)$/i;
      const match = url.match(regex);
      return match ? `ProfilePictures/${match[1]}` : null;
    };

    const publicId = getPublicIdFromUrl(imageUrl);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteError) {
        console.error(`Failed to delete image with public_id: ${publicId}`, deleteError);
      }
    }

    user.profileImage.splice(imageIndex, 1);

    const updatedUser = await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile image removed successfully',
      user: {
        _id: updatedUser._id,
        name: updatedUser.name,
        profileImage: updatedUser.profileImage,
      },
    });

  } catch (error) {
    console.error('Error removing user profile image:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during image removal',
      error: error.message,
    });
  }
};


function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(newEmail, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD,
            },
            logger: true,
            debug: true,
        });

        const mailOptions = {
            from: `"Your App Name" <${process.env.NODEMAILER_EMAIL}>`,
            to: newEmail,
            subject: "Email Change Verification OTP",
            text: `Your OTP for email change is: ${otp}. This OTP is valid for 1 minute.`,
            html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Email Change Verification</h2>
          <p>Your OTP for changing your email address is:</p>
          <h3 style="color: #C4A676;">${otp}</h3>
          <p>This OTP is valid for 1 minute.</p>
          <p>If you did not initiate this request, please ignore this email.</p>
        </div>
      `,
        };

        const info = await transporter.sendMail(mailOptions);
        return info.accepted.length > 0;
    } catch (error) {
        console.error("Error sending email:", error.message, error.stack);
        return false;
    }
}

const editemail = async (req, res) => {
    try {
        const userId = req.session.user;
        const { newEmail, currentPassword } = req.body;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: Please log in" });
        }

        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Email is already in use" });
        }

        const findUser = await User.findOne({ _id: userId, isadmin: false });
        if (!findUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(currentPassword, findUser.password);
        if (!passwordMatch) {
            return res.status(400).json({ success: false, message: "Incorrect password" });
        }

        const otp = generateOtp();
        const otpExpiration = new Date(Date.now() + 60 * 1000); // 
        console.log("change email Generated OTP:", otp);

        const emailSent = await sendVerificationEmail(newEmail, otp);
        if (!emailSent) {
            return res.status(500).json({
                success: false,
                message: "Failed to send OTP. Please try again.",
            });
        }


        req.session.emailChange = {
            newEmail,
            otp,
            expiresAt: otpExpiration,
        };

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            redirect: "/email-otp",
        });
    } catch (error) {
        console.error("Error in editemail:", error.message, error.stack);
        return res.status(500).json({
            success: false,
            message: error.message || "An unexpected error occurred. Please try again later.",
        });
    }
};


const verifyOtp = async (req, res) => {
    try {
        const userId = req.session.user;
        const { otp } = req.body;
        const emailChangeData = req.session.emailChange;

        if (!otp) {
            return res.status(400).json({ success: false, message: "OTP is required" });
        }
        if (!emailChangeData || !emailChangeData.otp || !emailChangeData.expiresAt || !emailChangeData.newEmail) {
            return res.status(400).json({ success: false, message: "No OTP found or session expired" });
        }

        const user = await User.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (new Date() > new Date(emailChangeData.expiresAt)) {
            return res.status(400).json({ success: false, message: "OTP has expired. Please resend a new OTP." });
        }

        if (otp !== emailChangeData.otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        await User.updateOne(
            { _id: userId },
            {
                $set: { email: emailChangeData.newEmail },
                $unset: { tempEmail: "", otp: "", otpExpiry: "" },
            }
        );
        delete req.session.emailChange;

        return res.status(200).json({ success: true, message: "Email updated successfully" });
    } catch (error) {
        console.error("Error in verifyOtp:", error);
        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
};


const resendOtp = async (req, res) => {
    try {
        const userId = req.session.user;
        const emailChangeData = req.session.emailChange;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: Please log in" });
        }
        if (!emailChangeData || !emailChangeData.newEmail) {
            return res.status(400).json({ success: false, message: "No pending email change request" });
        }
        const newEmail = emailChangeData.newEmail;
        const otp = generateOtp();
        const otpExpiration = new Date(Date.now() + 60 * 1000);
        console.log("change email Resend OTP:", otp);

        const emailSent = await sendVerificationEmail(newEmail, otp);
        if (!emailSent) {
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }

        req.session.emailChange.otp = otp;
        req.session.emailChange.expiresAt = otpExpiration;

        return res.status(200).json({ success: true, message: "OTP resent successfully" });
    } catch (error) {
        console.error("Error in resendOtp:", error);
        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred. Please try again later.",
        });
    }
};

const getOtpPage = async (req, res) => {
    try {
        if (!req.session.emailChange || !req.session.emailChange.newEmail) {
            req.session.message = { type: "error", text: "No pending email change request" };
            return res.redirect("/profile");
        }
        res.render("emailOtpverify", { message: req.session.message });
        req.session.message = null;
    } catch (error) {
        console.error("Error in getOtpPage:", error);
        req.session.message = { type: "error", text: "An unexpected error occurred" };
        return res.redirect("/pageNotFound");
    }
};

const changepassword = async (req, res) => {
    try {
        const user = req.session.user;
        const { currentPassword, newPassword } = req.body;
        if (!user || !user._id) {

            return res.status(401).json({ message: "Unauthorized: Please log in" });
        }

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current password and new password are required" });
        }

        const finduser = await User.findOne({ _id: user._id, isadmin: false });

        if (!finduser) {
            return res.status(404).json({ message: "User not found" });
        }

        const passwordMatch = await bcrypt.compare(currentPassword, finduser.password);

        if (!passwordMatch) {
            return res.status(400).json({ message: "Current password is invalid" });
        }

        const hashPassword = await bcrypt.hash(newPassword, saltround)

        await User.updateOne(
            { _id: finduser._id },
            { $set: { password: hashPassword } }
        );

        return res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (error) {
        console.error("Error in changepassword:", error);
        return res.status(500).json({ message: "An unexpected error occurred. Please try again later." });
    }
};


//  referralcode
const getreferralPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId)
      .populate('redeemedUsers', 'name email createdAt') // include createdAt for history
      .lean();

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 4;
    const skip = (page - 1) * limit;

    const redeemedUsers = userData.redeemedUsers || [];
    const paginatedRedeemedUsers = redeemedUsers.slice(skip, skip + limit);
    const totalReferrals = redeemedUsers.length;
    const totalPages = Math.ceil(totalReferrals / limit);

    res.render("referral", {
      user: userData,
      referralCode: userData.referralCode, // ✅ Pass this to EJS
      redeemedUsers: paginatedRedeemedUsers,
      currentPage: page,
      totalPages: totalPages,
      limit: limit,
      totalReferrals: totalReferrals
    });
  } catch (error) {
    console.error("Referral page error:", error);
    res.redirect("/pageNotFound");
  }
};


module.exports = {
    userProfile,
    userEditprofile,
    profileUpdate,
    removeUserImage,
    editemail,
    changepassword,
    getOtpPage,
    verifyOtp,
    resendOtp,
    getreferralPage
}