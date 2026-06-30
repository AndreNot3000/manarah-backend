import jwt, { SignOptions } from "jsonwebtoken";
import { UserRole } from "@prisma/client";

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signToken(payload: JwtPayload): string {
  const expiresIn = (process.env.JWT_EXPIRES_IN ?? "7d") as SignOptions["expiresIn"];
  return jwt.sign(payload, getJwtSecret(), { expiresIn });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }
  const { userId, email, role } = decoded as JwtPayload;
  if (!userId || !email || !role) {
    throw new Error("Invalid token payload");
  }
  return { userId, email, role };
}
