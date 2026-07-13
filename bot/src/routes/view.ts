import { Router } from "express";
import { viewDocument } from "../controllers/viewController";

const router = Router();

router.get("/:id", viewDocument);

export default router;
