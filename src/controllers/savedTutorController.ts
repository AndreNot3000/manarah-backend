import { Request, Response } from "express";
import {
  listSavedTutors,
  saveTutor,
  unsaveTutor,
} from "../services/savedTutorService";
import { AppError, handleControllerError } from "../utils/errors";

export async function listSavedTutorsHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const tutors = await listSavedTutors(req.user.userId);
    res.json({ tutors });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function saveTutorHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const tutorId = String(req.params.tutorId ?? "");

    if (!tutorId) {
      throw new AppError("Tutor ID is required", 400, "INVALID_TUTOR");
    }

    const tutor = await saveTutor(req.user.userId, tutorId);
    res.status(201).json({ tutor });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function unsaveTutorHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const tutorId = String(req.params.tutorId ?? "");

    if (!tutorId) {
      throw new AppError("Tutor ID is required", 400, "INVALID_TUTOR");
    }

    await unsaveTutor(req.user.userId, tutorId);
    res.status(204).send();
  } catch (error) {
    handleControllerError(res, error);
  }
}
