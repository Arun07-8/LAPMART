require("dotenv").config();
const User = require("../../models/userSchema");
const Contact = require("../../models/contactSchema");
const nodemailer = require("nodemailer");
const sanitizeHtml = require("sanitize-html"); 

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PASSWORD,
    },
  });
};

// Render contact page
const contactPage = async (req, res) => {
  try {
    const userId = req.session.user;
    const userData = await User.findById(userId);
 
    res.render("contactsPage", { user: userData });
  } catch (error) {
    console.error("Error rendering contact page:", error);
    res.status(500).render("pageNotFound", { message: "Server error" });
  }
};

// Handle contact form submission
const sendEmail = async (req, res) => {
  try {
    const { fullName, email, phone, subject, message } = req.body;


    if (!fullName || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }

  
    const sanitizedMessage = sanitizeHtml(message, {
      allowedTags: [],
      allowedAttributes: {},
    });

 
    const contact = new Contact({
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      phone: phone ? phone.trim() : null,
      subject: subject.trim(),
      message: sanitizedMessage.trim(),
    });

    await contact.save();

    const transporter = createTransporter();

   
    const adminEmailOptions = {
      from: email,
      to: process.env.NODEMAILER_EMAIL || "info@lapmartlaptops.com",
      subject: `New Contact Form Submission: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #333;">New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${sanitizeHtml(fullName)}</p>
          <p><strong>Email:</strong> ${sanitizeHtml(email)}</p>
          <p><strong>Phone:</strong> ${phone ? sanitizeHtml(phone) : "Not provided"}</p>
          <p><strong>Subject:</strong> ${sanitizeHtml(subject)}</p>
          <p><strong>Message:</strong><br>${sanitizedMessage.replace(/\n/g, "<br>")}</p>
          <hr>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <p><strong>IP:</strong> ${req.ip}</p>
          <p><strong>User Agent:</strong> ${req.get("User-Agent")}</p>
        </div>
      `,
    };

 
    const userEmailOptions = {
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Thank you for contacting TechLaptops Pro",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #007bff;">Hi ${sanitizeHtml(fullName)},</h2>
          <p>We’ve received your message. Our team will get back to you soon.</p>
          <hr>
          <p><strong>Subject:</strong> ${sanitizeHtml(subject)}</p>
          <p><strong>Your Message:</strong><br>${sanitizedMessage.replace(/\n/g, "<br>")}</p>
          <hr>
          <p>📞 Support: ${process.env.SUPPORT_PHONE || "+91 94950 12345"}</p>
          <p>📧 Email: ${process.env.ADMIN_EMAIL || "info@lapmartlaptops.com"}</p>
          <p>🕒 Working Hours: Mon–Sat, 9 AM to 6 PM IST</p>
        </div>
      `,
    };

    await Promise.all([
      transporter.sendMail(adminEmailOptions),
      transporter.sendMail(userEmailOptions),
    ]);

    res.status(200).json({
      success: true,
      message: "Your message has been sent successfully!",
      data: {
        id: contact._id,
        submittedAt: contact.createdAt,
      },
    });
  } catch (error) {
    console.error("Contact form error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Please check your input and try again.",
      });
    }

    if (error.code === "EAUTH" || error.code === "ECONNECTION") {
      return res.status(500).json({
        success: false,
        message: "Email service temporarily unavailable. Please try again later.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};

module.exports = {
  contactPage,
  sendEmail,
};
