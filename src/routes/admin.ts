import { Router } from "express";
import {
  getAdminStatsHandler,
  listUsersHandler,
  verifyTutorHandler,
  createCompetitionHandler,
  updateCompetitionHandler,
  getParticipantsHandler,
  publishResultsHandler,
} from "../controllers/adminController";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import { validateQuery } from "../middleware/validateQuery";
import {
  listUsersQuerySchema,
  verifyTutorSchema,
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

export default router;
