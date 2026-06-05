import { Router } from "express";
import {
  createDocument,
  deleteDocument,
  getDocument,
  listDocuments,
  updateDocument,
} from "../controllers/documentController";
import { addAdmin, editAdmin, getAdmins, removeAdmin } from "../controllers/adminController";
import { getCurrentAdmin, login } from "../controllers/authController";
import { requireAuth, requireSuperAdmin } from "../middlewares/requireAuth";
import { upload } from "../middlewares/upload";

const router = Router();

router.post("/auth/login", login);

router.use(requireAuth);

router.get("/auth/me", getCurrentAdmin);

router.post("/documents", upload.single("pdf"), createDocument);
router.get("/documents", listDocuments);
router.get("/documents/:id", getDocument);
router.patch("/documents/:id", updateDocument);
router.delete("/documents/:id", deleteDocument);

router.get("/admins", requireSuperAdmin, getAdmins);
router.post("/admins", requireSuperAdmin, addAdmin);
router.patch("/admins/:id", requireSuperAdmin, editAdmin);
router.delete("/admins/:id", requireSuperAdmin, removeAdmin);

export default router;
