import mongoose from "mongoose";
import { config } from "../config.js";

let connectPromise = null;

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || config.mongoUri;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectPromise) {
    connectPromise = mongoose
      .connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        retryWrites: true,
        retryReads: true,
      })
      .then((connection) => {
        console.log(`MongoDB connected: ${connection.connection.host}`);
        return connection;
      })
      .catch((error) => {
        connectPromise = null;
        console.error("MongoDB connection failed:", error.message);
        throw error;
      });
  }

  return await connectPromise;
};

export default connectDB;
