import { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";

export type RoleParam = "student" | "tutor" | "admin";

const roleMap: Record<RoleParam, UserRole> = {
  student: UserRole.STUDENT,
  tutor: UserRole.TUTOR,
  admin: UserRole.ADMIN,
};

export function requireRole(...roles: RoleParam[]) {
  const allowed = roles.map((role) => roleMap[role]);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
