import { Router } from "express";
import {
  adminCheckHandler,
  forgotPasswordHandler,
  loginHandler,
  meHandler,
  registerStudentHandler,
  registerTutorHandler,
  resetPasswordHandler,
} from "../controllers/authController";
import { authenticate } from "../middleware/authenticate";
import {
  loginRateLimiter,
  passwordResetRateLimiter,
  registerRateLimiter,
} from "../middleware/rateLimit";
import { requireRole } from "../middleware/requireRole";
import { validateBody } from "../middleware/validate";
import {
  forgotPasswordSchema,
  loginSchema,
  registerStudentSchema,
  registerTutorSchema,
  resetPasswordSchema,
} from "../validators/auth";

const router = Router();

router.post(
  "/register/student",
  registerRateLimiter,
  validateBody(registerStudentSchema),
  registerStudentHandler
);
router.post(
  "/register/tutor",
  registerRateLimiter,
  validateBody(registerTutorSchema),
  registerTutorHandler
);
router.post("/login", loginRateLimiter, validateBody(loginSchema), loginHandler);
router.post(
  "/forgot-password",
  passwordResetRateLimiter,
  validateBody(forgotPasswordSchema),
  forgotPasswordHandler
);
router.post(
  "/reset-password",
  passwordResetRateLimiter,
  validateBody(resetPasswordSchema),
  resetPasswordHandler
);

router.get("/me", authenticate, meHandler);
router.get("/admin/check", authenticate, requireRole("admin"), adminCheckHandler);

export default router;
