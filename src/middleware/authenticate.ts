import { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { verifyToken } from "../utils/jwt";

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized", code: "UNAUTHORIZED" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: "Unauthorized", code: "USER_NOT_FOUND" });
      return;
    }

    if (user.email !== payload.email || user.role !== payload.role) {
      res.status(401).json({ error: "Unauthorized", code: "TOKEN_STALE" });
      return;
    }

    req.user = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch {
    res.status(401).json({ error: "Unauthorized", code: "INVALID_TOKEN" });
  }
}
