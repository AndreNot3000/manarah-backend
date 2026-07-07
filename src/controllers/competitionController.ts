import { Request, Response } from "express";
import { getValidatedQuery } from "../middleware/validateQuery";
import {
  getCompetitionById,
  getMyCompetitions,
  listCompetitionDocuments,
  listCompetitions,
  registerForCompetition,
  uploadCompetitionDocuments,
} from "../services/competitionService";
import { AppError, handleControllerError } from "../utils/errors";
import { ListCompetitionsQuery } from "../validators/competition";

export async function listCompetitionsHandler(req: Request, res: Response) {
  try {
    const query = getValidatedQuery<ListCompetitionsQuery>(res);
    const result = await listCompetitions(query);
    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function getCompetitionHandler(req: Request, res: Response) {
  try {
    const competitionId = String(req.params.id ?? "");

    if (!competitionId) {
      res.status(400).json({ error: "Competition ID is required" });
      return;
    }

    const userId = req.user?.userId;
    const competition = await getCompetitionById(competitionId, userId);
    res.json({ competition });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function getMyCompetitionsHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));

    const result = await getMyCompetitions(req.user.userId, page, limit);
    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function registerForCompetitionHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const competitionId = String(req.params.id ?? "");
    if (!competitionId) {
      res.status(400).json({ error: "Competition ID is required" });
      return;
    }

    const registration = await registerForCompetition(req.user.userId, competitionId);
    res.status(201).json({ registration });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function uploadCompetitionDocumentsHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const competitionId = String(req.params.id ?? "");
    if (!competitionId) {
      res.status(400).json({ error: "Competition ID is required" });
      return;
    }

    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      res.status(400).json({ error: "At least one file is required", code: "NO_FILES" });
      return;
    }

    const result = await uploadCompetitionDocuments(
      req.user.userId,
      competitionId,
      files.map((f) => ({ filename: f.filename, originalname: f.originalname }))
    );

    res.status(201).json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function listCompetitionDocumentsHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const competitionId = String(req.params.id ?? "");
    if (!competitionId) {
      res.status(400).json({ error: "Competition ID is required" });
      return;
    }

    const result = await listCompetitionDocuments(req.user.userId, competitionId);
    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
}
