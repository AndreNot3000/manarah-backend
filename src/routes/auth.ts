import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate } from "../middleware/authenticate";
import { requireRole } from "../middleware/requireRole";
import { signToken } from "../utils/jwt";

const router = Router();

router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

router.get("/admin/check", authenticate, requireRole("admin"), (_req, res) => {
  res.json({ ok: true });
});

// Dev helper to obtain a token for middleware testing (remove or protect in production)
if (process.env.NODE_ENV !== "production") {
  router.post("/dev/token", (req, res) => {
    const { userId, email, role } = req.body as {
      userId?: string;
      email?: string;
      role?: UserRole;
    };

    if (!userId || !email || !role) {
      res.status(400).json({ error: "userId, email, and role are required" });
      return;
    }

    if (!Object.values(UserRole).includes(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const token = signToken({ userId, email, role });
    res.json({ token });
  });
}

export default router;
