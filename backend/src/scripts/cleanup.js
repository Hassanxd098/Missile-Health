import mongoose from "mongoose";
import User from "../models/User.js";
import Hospital from "../models/Hospital.js";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  await User.deleteMany({ role: "superadmin" });
  await Hospital.deleteMany({});
  await User.deleteMany({ role: "hospital_admin" });
  await User.deleteMany({ role: "doctor" });
  await User.deleteMany({ role: "patient" });
  await User.deleteMany({ role: "reception" });
  await User.deleteMany({ role: "pharmacy" });
  await User.deleteMany({ role: "cleaner" });
  await User.deleteMany({ role: "admin" });
  console.log("Cleanup done");
  await mongoose.disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });
