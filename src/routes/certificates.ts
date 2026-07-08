import { Router } from "express";
import { getMyCertificatesHandler, downloadCertificateHandler } from "../controllers/certificateController";
import { authenticate } from "../middleware/authenticate";

const router = Router();

router.get("/me", authenticate, getMyCertificatesHandler);
router.get("/:id/download", downloadCertificateHandler);

export default router;
