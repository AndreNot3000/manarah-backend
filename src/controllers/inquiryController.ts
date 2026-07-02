import { Request, Response } from "express";
import { createInquiry, listTutorInquiries } from "../services/inquiryService";
import { AppError, handleControllerError } from "../utils/errors";
import { getValidatedQuery } from "../middleware/validateQuery";
import { CreateInquiryInput, ListInquiriesQuery } from "../validators/inquiry";

export async function createInquiryHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const input = req.body as CreateInquiryInput;
    const inquiry = await createInquiry(req.user.userId, input);
    res.status(201).json({ inquiry });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function listTutorInquiriesHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const query = getValidatedQuery<ListInquiriesQuery>(res);
    const result = await listTutorInquiries(req.user.userId, query);
    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
}
