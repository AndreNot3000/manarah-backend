import "dotenv/config";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";

const app = express();
const PORT = process.env.PORT ?? 4000;
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);
app.use(express.json());

app.use("/api", healthRouter);
app.use("/api/auth", authRouter);
app.listen(PORT, () => {
  console.log(`MANARAH API running on http://localhost:${PORT}`);
});
