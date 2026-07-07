import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../lib/prisma";

/**
 * Like `authenticate` but does not reject unauthenticated requests.
 * If a valid Bearer token is present it populates req.user, otherwise continues.
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true },
    });

    if (user && user.email === payload.email && user.role === payload.role) {
      req.user = { userId: user.id, email: user.email, role: user.role };
    }
  } catch {
    // Invalid token — just proceed without setting req.user
  }

  next();
}
