import { Router } from "express";
import { paymentCallback } from "../controllers/paymentController";

const router = Router();

// Flutterwave checkout redirect_url
router.get("/callback", paymentCallback);

export default router;
