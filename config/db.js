require("dotenv").config(); // ✅ Loads .env
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI); // ✅ Connect to DB
    console.log(process.env.MONGODB_URI); // 🔍 Show URI to confirm
    console.log("DB connected");
  } catch (error) {
    console.log("DB Connection error", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
