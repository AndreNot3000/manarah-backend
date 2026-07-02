import { createNotification } from "../src/services/notificationService";
import { prisma } from "../src/lib/prisma";

const BASE = "http://localhost:4000";

async function request(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {}
) {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  return { status: res.status, body };
}

async function main() {
  const reg = await request("POST", "/api/auth/register/student", {
    body: {
      email: `notif.${Date.now()}@test.com`,
      password: "TestPass123",
      name: "Notif Student",
    },
  });

  const token = reg.body.token as string;
  const userId = reg.body.user.id as string;

  await createNotification(userId, "Welcome", "Welcome to MANARAH");
  await createNotification(userId, "Competition", "A new competition is open");
  await createNotification(userId, "Read me", "Already read");
  const third = await createNotification(userId, "Unread", "Still unread");

  await prisma.notification.update({
    where: { id: (await prisma.notification.findFirst({ where: { userId, title: "Read me" } }))!.id },
    data: { read: true },
  });

  const list = await request("GET", "/api/notifications", { token });
  console.log("GET all:", list.status, "count=", list.body.notifications.length, "unread=", list.body.meta.unreadCount);

  const unread = await request("GET", "/api/notifications?unreadOnly=true", { token });
  console.log("GET unreadOnly:", unread.status, "count=", unread.body.notifications.length);

  const mark = await request("PATCH", `/api/notifications/${third.id}/read`, { token });
  console.log("PATCH read:", mark.status, "read=", mark.body.notification.read);

  const after = await request("GET", "/api/notifications", { token });
  console.log("Unread after mark:", after.body.meta.unreadCount);

  const other = await request("POST", "/api/auth/register/student", {
    body: {
      email: `other.${Date.now()}@test.com`,
      password: "TestPass123",
      name: "Other",
    },
  });
  const foreign = await request("PATCH", `/api/notifications/${third.id}/read`, {
    token: other.body.token,
  });
  console.log("Other user PATCH:", foreign.status, foreign.body.code);

  await prisma.$disconnect();
}

main().catch(console.error);
