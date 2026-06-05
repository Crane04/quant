import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { connectDB } from "./config/db";
import apiRouter from "./routes/api";
import webhookRouter from "./routes/webhook";
import { ensureDefaultAdmin } from "./services/adminService";
import { sendSuccess } from "./utils/apiResponse";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan("dev"));
app.use(cors());

// Twilio sends application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// WhatsApp webhook
app.use("/webhook", webhookRouter);

// Internal API (used by admin panel)
app.use("/api/v1", apiRouter);

app.get("/health", (_req, res) => {
  sendSuccess(res, { status: "ok", service: "quant-bot", ts: new Date().toISOString() });
});

const start = async () => {
  await connectDB();
  await ensureDefaultAdmin();
  app.listen(PORT, () => {
    console.log(`🚀 Quant Bot running on port ${PORT}`);
    console.log(`   Webhook: POST /webhook/whatsapp`);
    console.log(`   API:     /api/v1/documents`);
  });
};

start();
