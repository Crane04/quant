import { Router } from "express";
import authRoutes from "./authRoutes";
import adminAuthRoutes from "./adminAuthRoutes";
import adminRoutes from "./adminRoutes";
import studentRoutes from "./studentRoutes";
import courseRoutes from "./courseRoutes";
import timetableRoutes from "./timetableRoutes";
import assignmentRoutes from "./assignmentRoutes";
import lectureSummaryRoutes from "./lectureSummaryRoutes";
import documentRoutes from "./documentRoutes";
import gradeRoutes from "./gradeRoutes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/auth", adminAuthRoutes);
router.use("/admins", adminRoutes);
router.use("/students", studentRoutes);
router.use("/courses", courseRoutes);
router.use("/timetable", timetableRoutes);
router.use("/assignments", assignmentRoutes);
router.use("/lecture-summaries", lectureSummaryRoutes);
router.use("/documents", documentRoutes);
router.use("/grades", gradeRoutes);

export default router;
