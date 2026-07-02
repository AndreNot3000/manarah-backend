import jwt, { SignOptions } from "jsonwebtoken";

export interface PasswordResetPayload {
  userId: string;
  purpose: "password_reset";
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signPasswordResetToken(userId: string): string {
  const expiresIn = (process.env.PASSWORD_RESET_EXPIRES_IN ?? "1h") as SignOptions["expiresIn"];
  return jwt.sign({ userId, purpose: "password_reset" }, getJwtSecret(), { expiresIn });
}

export function verifyPasswordResetToken(token: string): PasswordResetPayload {
  const decoded = jwt.verify(token, getJwtSecret());

  if (typeof decoded === "string" || !decoded || typeof decoded !== "object") {
    throw new Error("Invalid reset token");
  }

  const { userId, purpose } = decoded as PasswordResetPayload;

  if (!userId || purpose !== "password_reset") {
    throw new Error("Invalid reset token");
  }

  return { userId, purpose };
}
