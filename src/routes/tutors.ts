import { Router } from "express";
import {
  createInquiryHandler,
  listTutorInquiriesHandler,
} from "../controllers/inquiryController";
import {
  getOwnTutorProfileHandler,
  getTutorHandler,
  listTutorsHandler,
  updateOwnTutorProfileHandler,
} from "../controllers/tutorController";
import { handleUploadError } from "../controllers/userController";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { tutorProfileUpload } from "../middleware/upload";
import { validateBody } from "../middleware/validate";
import { validateQuery } from "../middleware/validateQuery";
import { createInquirySchema, listInquiriesQuerySchema } from "../validators/inquiry";
import { listTutorsQuerySchema } from "../validators/tutor";

const router = Router();

const tutorUpload = tutorProfileUpload.fields([
  { name: "photo", maxCount: 1 },
  { name: "qualifications", maxCount: 10 },
]);

// Tutor self-service — must be registered before /:id
router.get("/me", authenticate, requireRole("tutor"), getOwnTutorProfileHandler);
router.get(
  "/me/inquiries",
  authenticate,
  requireRole("tutor"),
  validateQuery(listInquiriesQuerySchema),
  listTutorInquiriesHandler
);
router.patch(
  "/me",
  authenticate,
  requireRole("tutor"),
  tutorUpload,
  handleUploadError,
  updateOwnTutorProfileHandler
);

router.post(
  "/inquiries",
  authenticate,
  requireRole("student"),
  validateBody(createInquirySchema),
  createInquiryHandler
);

// Public endpoints — no authentication required
router.get("/", validateQuery(listTutorsQuerySchema), listTutorsHandler);
router.get("/:id", getTutorHandler);

export default router;
