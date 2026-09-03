import { Router } from "express";
import {
  verifyWebhook,
  handleIncoming,
} from "../controllers/webhookController";
import { handleFlowRequest } from "../controllers/flowController";

const router = Router();

router.get("/whatsapp", verifyWebhook);
router.post("/whatsapp", handleIncoming);

// WhatsApp Flow data endpoint — encrypted request/response, see flowController.ts
router.post("/flow", handleFlowRequest);

export default router;
