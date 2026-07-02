import { Router } from "express";
import {
  listSavedTutorsHandler,
  saveTutorHandler,
  unsaveTutorHandler,
} from "../controllers/savedTutorController";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.use(authenticate, requireRole("student"));

router.get("/saved-tutors", listSavedTutorsHandler);
router.post("/saved-tutors/:tutorId", saveTutorHandler);
router.delete("/saved-tutors/:tutorId", unsaveTutorHandler);

export default router;
