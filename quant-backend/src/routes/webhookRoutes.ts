import { Router } from "express";
import {
  verifyWebhook,
  handleIncoming,
} from "../controllers/webhookController";
import { handleFlowRequest } from "../controllers/flowController";
import { handleFlutterwaveWebhook } from "../controllers/paymentController";

const router = Router();

router.get("/whatsapp", verifyWebhook);
router.post("/whatsapp", handleIncoming);

// WhatsApp Flow data endpoint — encrypted request/response, see flowController.ts
router.post("/flow", handleFlowRequest);

// Flutterwave payment events — quant top-ups, see paymentController.ts
router.post("/flutterwave", handleFlutterwaveWebhook);

export default router;
