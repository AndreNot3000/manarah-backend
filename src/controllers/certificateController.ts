import { Request, Response } from "express";
import { AppError, handleControllerError } from "../utils/errors";
import { generateCertificate, getMyCertificates } from "../services/certificateService";
import { prisma } from "../lib/prisma";
import path from "path";
import fs from "fs";

export async function getMyCertificatesHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const certificates = await getMyCertificates(req.user.userId);
    res.json({ certificates });
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function downloadCertificateHandler(req: Request, res: Response) {
  try {
    const certId = String(req.params.id ?? "");
    if (!certId) {
      res.status(400).json({ error: "Certificate ID is required" });
      return;
    }

    const cert = await prisma.certificate.findUnique({
      where: { id: certId }
    });

    if (!cert) {
      res.status(404).json({ error: "Certificate not found" });
      return;
    }

    const absolutePath = path.join(process.cwd(), cert.fileUrl);
    if (!fs.existsSync(absolutePath)) {
      res.status(404).json({ error: "Certificate PDF file not found on disk" });
      return;
    }

    // Set correct headers for inline viewing or download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=certificate_${certId}.pdf`);
    res.sendFile(absolutePath);
  } catch (error) {
    handleControllerError(res, error);
  }
}

export async function generateCertificateHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { userId, competitionId, type } = req.body;
    if (!userId || !competitionId || !type) {
      res.status(400).json({ error: "userId, competitionId, and type are required" });
      return;
    }

    const certificate = await generateCertificate(userId, competitionId, type);
    res.status(201).json({ certificate });
  } catch (error) {
    handleControllerError(res, error);
  }
}
