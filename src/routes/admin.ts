import { Router } from "express";
import {
  getAdminStatsHandler,
  listUsersHandler,
  verifyTutorHandler,
  createCompetitionHandler,
  updateCompetitionHandler,
  getParticipantsHandler,
  publishResultsHandler,
  getRegistrationDocumentsHandler,
  updatePaymentStatusHandler,
  createAnnouncementHandler,
} from "../controllers/adminController";
import { authenticate } from "../middleware/authenticate";
import { generateCertificateHandler } from "../controllers/certificateController";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import { validateQuery } from "../middleware/validateQuery";
import {
  listUsersQuerySchema,
  verifyTutorSchema,
  updatePaymentSchema,
  createAnnouncementSchema,
} from "../validators/admin";
import {
  createCompetitionSchema,
  updateCompetitionSchema,
  publishResultsSchema,
} from "../validators/competition";

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole("admin"));

// BE-050 — Dashboard stats
router.get("/stats", getAdminStatsHandler);

// BE-051 — User & tutor management
router.get("/users", validateQuery(listUsersQuerySchema), listUsersHandler);
router.patch("/tutors/:id/verify", validateBody(verifyTutorSchema), verifyTutorHandler);

// BE-052 — Competition CRUD
router.post("/competitions", validateBody(createCompetitionSchema), createCompetitionHandler);
router.put("/competitions/:id", validateBody(updateCompetitionSchema), updateCompetitionHandler);
router.get("/competitions/:id/participants", getParticipantsHandler);
router.post(
  "/competitions/:id/results",
  validateBody(publishResultsSchema),
  publishResultsHandler
);

router.post("/certificates/generate", generateCertificateHandler);
router.get("/competitions/:id/registrations/:regId/documents", getRegistrationDocumentsHandler);
router.patch("/competitions/:id/registrations/:regId/payment", validateBody(updatePaymentSchema), updatePaymentStatusHandler);
router.post("/announcements", validateBody(createAnnouncementSchema), createAnnouncementHandler);

export default router;
