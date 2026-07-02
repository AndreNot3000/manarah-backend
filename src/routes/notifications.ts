import { Router } from "express";
import {
  listNotificationsHandler,
  markNotificationReadHandler,
} from "../controllers/notificationController";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.use(authenticate);

router.get("/", listNotificationsHandler);
router.patch("/:id/read", markNotificationReadHandler);

export default router;
