const mongoose = require("mongoose");
require("dotenv").config(); // ✅ Load .env at the top

const connectDB = async () => {
  try {
    console.log("🌐 Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error); // Show full error
    process.exit(1); // Exit the app if DB fails
  }
};

module.exports = connectDB;
