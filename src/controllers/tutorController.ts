import { Request, Response } from "express";
import { ZodError } from "zod";
import {
  getOwnTutorProfile,
  getPublicTutorById,
  listPublicTutors,
  updateOwnTutorProfile,
} from "../services/tutorService";
import { getValidatedQuery } from "../middleware/validateQuery";
import { AppError, handleControllerError } from "../utils/errors";
import {
  ListTutorsQuery,
  parseQualificationTitles,
  parseUpdateTutorProfileInput,
} from "../validators/tutor";

export async function listTutorsHandler(req: Request, res: Response) {
  try {
    const query = getValidatedQuery<ListTutorsQuery>(res);
    const result = await listPublicTutors(query);
    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function getTutorHandler(req: Request, res: Response) {
  try {
    const tutorId = String(req.params.id ?? "");

    if (!tutorId) {
      res.status(400).json({ error: "Tutor ID is required", code: "INVALID_TUTOR" });
      return;
    }

    const tutor = await getPublicTutorById(tutorId);
    res.json({ tutor });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function getOwnTutorProfileHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const tutor = await getOwnTutorProfile(req.user.userId);
    res.json({ tutor });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function updateOwnTutorProfileHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const input = parseUpdateTutorProfileInput(req.body as Record<string, unknown>);
    const files = req.files as
      | {
          photo?: Express.Multer.File[];
          qualifications?: Express.Multer.File[];
        }
      | undefined;

    const photoFile = files?.photo?.[0];
    const qualificationFiles = files?.qualifications ?? [];
    const qualificationTitles = parseQualificationTitles(req.body.qualificationTitles);

    if (qualificationFiles.length > 0 && qualificationTitles.length !== qualificationFiles.length) {
      throw new AppError(
        "qualificationTitles must match the number of uploaded qualification files",
        400,
        "QUALIFICATION_TITLE_MISMATCH"
      );
    }

    const tutor = await updateOwnTutorProfile(
      req.user.userId,
      input,
      {
        photoFilename: photoFile?.filename,
        qualifications: qualificationFiles.map((file, index) => ({
          title: qualificationTitles[index],
          filename: file.filename,
        })),
      }
    );

    res.json({ tutor });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Validation failed",
        details: error.flatten().fieldErrors,
      });
      return;
    }

    if (error instanceof Error && error.message.startsWith("Invalid JSON")) {
      res.status(400).json({ error: error.message });
      return;
    }

    handleControllerError(res, error);
  }
}
