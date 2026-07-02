import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { getCurrentUserProfile, updateCurrentUserProfile } from "../services/userService";
import { handleControllerError, AppError } from "../utils/errors";
import { parseUpdateProfileInput } from "../validators/user";

export async function getMeProfileHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const profile = await getCurrentUserProfile(req.user.userId);
    res.json(profile);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function updateMeProfileHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const input = parseUpdateProfileInput(req.body as Record<string, unknown>);
    const file = req.file;

    if (
      input.name === undefined &&
      input.phone === undefined &&
      !file
    ) {
      throw new AppError("No profile fields to update", 400, "NO_CHANGES");
    }

    const profile = await updateCurrentUserProfile(
      req.user.userId,
      input,
      file?.filename
    );

    res.json(profile);
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.flatten().fieldErrors,
      });
      return;
    }

    handleControllerError(res, error);
  }
}

export function handleUploadError(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (error instanceof Error) {
    if (error.message.includes("File too large")) {
      res.status(400).json({ error: "File must be 10MB or smaller" });
      return;
    }

    if (error.message.includes("Only JPEG") || error.message.includes("Only PDF")) {
      res.status(400).json({ error: error.message });
      return;
    }
  }

  next(error);
}
