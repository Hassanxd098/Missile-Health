import mongoose from "mongoose";
import connectDB from "../utils/db.js";
import Hospital from "../models/Hospital.js";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

(async () => {
  await connectDB();

  const hospitals = await Hospital.find({}).lean();
  console.log("=== All Hospitals in DB ===");
  hospitals.forEach((h) => {
    console.log(`Code: ${h.code}, Name: ${h.name}, Status: ${h.status}, hospitalId: ${h.hospitalId}`);
  });
  console.log("\nTotal hospitals:", hospitals.length);

  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
