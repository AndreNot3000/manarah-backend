import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

export interface NotificationResponse {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationListMeta {
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
}

export interface NotificationListResponse {
  notifications: NotificationResponse[];
  meta: NotificationListMeta;
}

function mapNotification(notification: {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}): NotificationResponse {
  return {
    id: notification.id,
    title: notification.title,
    body: notification.body,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };
}

import { sendNotificationEmail } from "./emailService";

export async function createNotification(
  userId: string,
  title: string,
  body: string
): Promise<NotificationResponse> {
  const notification = await prisma.notification.create({
    data: { userId, title, body },
  });

  // Async query and send of email alerts
  prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  }).then((user) => {
    if (user?.email) {
      sendNotificationEmail(user.email, title, body).catch((err) => {
        console.error(`Failed to send notification email to ${user.email}:`, err);
      });
    }
  }).catch((err) => {
    console.error(`Failed to lookup email configuration for user ${userId}:`, err);
  });

  return mapNotification(notification);
}

export async function listNotifications(
  userId: string,
  options: {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
  } = {}
): Promise<NotificationListResponse> {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = {
    userId,
    ...(options.unreadOnly ? { read: false } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return {
    notifications: notifications.map(mapNotification),
    meta: {
      page,
      limit,
      total,
      unreadCount,
    },
  };
}

export async function markNotificationAsRead(
  userId: string,
  notificationId: string
): Promise<NotificationResponse> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new AppError("Notification not found", 404, "NOTIFICATION_NOT_FOUND");
  }

  if (notification.read) {
    return mapNotification(notification);
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });

  return mapNotification(updated);
}
