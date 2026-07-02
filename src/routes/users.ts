import { Router } from "express";
import {
  getMeProfileHandler,
  handleUploadError,
  updateMeProfileHandler,
} from "../controllers/userController";
import { authenticate } from "../middleware/authenticate";
import { avatarUpload } from "../middleware/upload";

const router = Router();

router.get("/me", authenticate, getMeProfileHandler);
router.patch(
  "/me",
  authenticate,
  avatarUpload.single("avatar"),
  handleUploadError,
  updateMeProfileHandler
);

export default router;
