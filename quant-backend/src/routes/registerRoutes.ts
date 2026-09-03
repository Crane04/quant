import { Router } from "express";
import {
  showRegistrationForm,
  submitRegistrationForm,
} from "../controllers/registrationPageController";

const router = Router();

router.get("/:token", showRegistrationForm);
router.post("/:token", submitRegistrationForm);

export default router;
