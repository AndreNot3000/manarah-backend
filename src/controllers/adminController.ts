import { Request, Response } from "express";
import {
  getAdminStats,
  listUsers,
  verifyTutor,
  createCompetition,
  updateCompetition,
  getCompetitionParticipants,
  buildParticipantsCsv,
  publishResults,
  createAnnouncement,
} from "../services/adminService";
import { getRegistrationDocuments, updatePaymentStatus } from "../services/competitionService";
import { handleControllerError, AppError } from "../utils/errors";
import { getValidatedQuery } from "../middleware/validateQuery";
import {
  ListUsersQuery,
  VerifyTutorInput,
  CreateAnnouncementInput,
} from "../validators/admin";
import {
  CreateCompetitionInput,
  UpdateCompetitionInput,
  PublishResultsInput,
} from "../validators/competition";

export async function getAdminStatsHandler(_req: Request, res: Response) {
  try {
    const stats = await getAdminStats();
    res.json({ stats });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function listUsersHandler(req: Request, res: Response) {
  try {
    const query = getValidatedQuery<ListUsersQuery>(res);
    const result = await listUsers(query);
    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function verifyTutorHandler(req: Request, res: Response) {
  try {
    const tutorId = String(req.params.id ?? "");
    if (!tutorId) {
      res.status(400).json({ error: "Tutor ID is required" });
      return;
    }

    const input = req.body as VerifyTutorInput;
    if (!input.status || !["VERIFIED", "REJECTED"].includes(input.status)) {
      res.status(400).json({
        error: "Status must be VERIFIED or REJECTED",
        code: "INVALID_STATUS",
      });
      return;
    }

    const result = await verifyTutor(tutorId, input.status);
    res.json({ tutor: result });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function createCompetitionHandler(req: Request, res: Response) {
  try {
    const input = req.body as CreateCompetitionInput;
    const competition = await createCompetition(input);
    res.status(201).json({ competition });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function updateCompetitionHandler(req: Request, res: Response) {
  try {
    const competitionId = String(req.params.id ?? "");
    if (!competitionId) {
      res.status(400).json({ error: "Competition ID is required" });
      return;
    }

    const input = req.body as UpdateCompetitionInput;
    const competition = await updateCompetition(competitionId, input);
    res.json({ competition });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function getParticipantsHandler(req: Request, res: Response) {
  try {
    const competitionId = String(req.params.id ?? "");
    if (!competitionId) {
      res.status(400).json({ error: "Competition ID is required" });
      return;
    }

    const data = await getCompetitionParticipants(competitionId);

    if (req.query.format === "csv") {
      const csv = buildParticipantsCsv(data);
      const filename = `participants-${competitionId}.csv`;
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
      return;
    }

    res.json(data);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function publishResultsHandler(req: Request, res: Response) {
  try {
    const competitionId = String(req.params.id ?? "");
    if (!competitionId) {
      res.status(400).json({ error: "Competition ID is required" });
      return;
    }

    const input = req.body as PublishResultsInput;
    const competition = await publishResults(competitionId, input);
    res.json({ competition });
  } catch (error) {
    handleControllerError(res, error);
  }
}

// -------------------------------------------
// New Handlers for receipt review and payment status
// -------------------------------------------
/**
 * GET /competitions/:id/registrations/:regId/documents
 * Returns the list of uploaded receipt documents for a registration.
 */
export async function getRegistrationDocumentsHandler(req: Request, res: Response) {
  try {
    const competitionId = String(req.params.id ?? "");
    const registrationId = String(req.params.regId ?? "");
    if (!competitionId || !registrationId) {
      res.status(400).json({ error: "Competition ID and Registration ID are required" });
      return;
    }
    const docs = await getRegistrationDocuments(registrationId);
    res.json({ documents: docs });
  } catch (error) {
    handleControllerError(res, error);
  }
}

/**
 * PATCH /competitions/:id/registrations/:regId/payment
 * Admin can approve (CONFIRMED) or reject (REJECTED) a payment.
 */
export async function updatePaymentStatusHandler(req: Request, res: Response) {
  try {
    const competitionId = String(req.params.id ?? "");
    const registrationId = String(req.params.regId ?? "");
    if (!competitionId || !registrationId) {
      res.status(400).json({ error: "Competition ID and Registration ID are required" });
      return;
    }
    const { status } = req.body as { status: "CONFIRMED" | "REJECTED" };
    await updatePaymentStatus(registrationId, status);
    res.json({ message: "Payment status updated" });
  } catch (error) {
    handleControllerError(res, error);
  }
}

/**
 * POST /announcements
 * Admin can broadcast an announcement to all registered users.
 */
export async function createAnnouncementHandler(req: Request, res: Response) {
  try {
    const input = req.body as CreateAnnouncementInput;
    const result = await createAnnouncement(input);
    res.status(201).json({ message: "Announcement broadcasted successfully", announcement: result });
  } catch (error) {
    handleControllerError(res, error);
  }
}
