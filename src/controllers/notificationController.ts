import { Request, Response } from "express";
import {
  listNotifications,
  markNotificationAsRead,
} from "../services/notificationService";
import { AppError, handleControllerError } from "../utils/errors";

function parseBooleanQuery(value: unknown): boolean {
  if (value === "true" || value === true) return true;
  return false;
}

function parsePositiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.floor(parsed);
}

export async function listNotificationsHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20);
    const unreadOnly = parseBooleanQuery(req.query.unreadOnly);

    const result = await listNotifications(req.user.userId, {
      page,
      limit,
      unreadOnly,
    });

    res.json(result);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function markNotificationReadHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const notificationId = String(req.params.id ?? "");

    if (!notificationId) {
      throw new AppError("Notification ID is required", 400, "INVALID_NOTIFICATION");
    }

    const notification = await markNotificationAsRead(req.user.userId, notificationId);
    res.json({ notification });
  } catch (error) {
    handleControllerError(res, error);
  }
}
