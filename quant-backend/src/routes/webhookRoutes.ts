import { Router } from "express";
import { verifyWebhook, handleIncoming } from "../controllers/webhookController";

const router = Router();

router.get("/whatsapp", verifyWebhook);
router.post("/whatsapp", handleIncoming);

export default router;
