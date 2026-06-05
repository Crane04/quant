import { Router } from "express";
import { handleIncoming } from "../controllers/webhookController";

const router = Router();

router.post("/whatsapp", handleIncoming);

export default router;
