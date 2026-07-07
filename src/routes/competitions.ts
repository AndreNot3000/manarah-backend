import { Router } from "express";
import {
  getCompetitionHandler,
  getMyCompetitionsHandler,
  listCompetitionDocumentsHandler,
  listCompetitionsHandler,
  registerForCompetitionHandler,
  uploadCompetitionDocumentsHandler,
} from "../controllers/competitionController";
import { authenticate } from "../middleware/authenticate";
import { optionalAuthenticate } from "../middleware/optionalAuthenticate";
import { competitionDocUpload } from "../middleware/upload";
import { handleUploadError } from "../controllers/userController";
import { validateQuery } from "../middleware/validateQuery";
import { listCompetitionsQuerySchema } from "../validators/competition";

const router = Router();

// Must be before /:id to avoid being swallowed as an id param
router.get("/my", authenticate, getMyCompetitionsHandler);

// Public (optional auth so logged-in users see their registration status)
router.get("/", validateQuery(listCompetitionsQuerySchema), listCompetitionsHandler);
router.get("/:id", optionalAuthenticate, getCompetitionHandler);

// Registration
router.post("/:id/register", authenticate, registerForCompetitionHandler);

// Document upload (multipart, up to 5 files per request) & listing
router.post(
  "/:id/documents",
  authenticate,
  competitionDocUpload.array("documents", 5),
  handleUploadError,
  uploadCompetitionDocumentsHandler
);
router.get("/:id/documents", authenticate, listCompetitionDocumentsHandler);

export default router;
