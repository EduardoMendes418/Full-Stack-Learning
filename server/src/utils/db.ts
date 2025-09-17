import mongoose from "mongoose";
require("dotenv").config();

const dbUrl: string = process.env.DB_URL || "";

const connectDB = async (): Promise<void> => {
  if (!dbUrl) {
    console.error("MongoDB URL is not defined in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(dbUrl);
    console.log("MongoDB connected successfully!");
  } catch (error: any) {
    console.error("Error connecting to MongoDB:", error);
    console.log("Retrying in 5 seconds...");
    setTimeout(connectDB, 5000); 
  }
};

export default connectDB;