import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import usersRouter from "./routes/users";
import studentsRouter from "./routes/students";
import notificationsRouter from "./routes/notifications";
import tutorsRouter from "./routes/tutors";
import competitionsRouter from "./routes/competitions";
import adminRouter from "./routes/admin";
import certificatesRouter from "./routes/certificates";

const app = express();
const PORT = process.env.PORT ?? 4000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/students", studentsRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/tutors", tutorsRouter);
app.use("/api/competitions", competitionsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/certificates", certificatesRouter);
app.listen(PORT, () => {
  console.log(`MANARAH API running on http://localhost:${PORT}`);
});
