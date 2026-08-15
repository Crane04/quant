import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

mongoose.set("strictQuery", true);

export async function connectDB(): Promise<void> {
  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) => logger.error("MongoDB connection error", err));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  await mongoose.connect(env.MONGO_URI);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
