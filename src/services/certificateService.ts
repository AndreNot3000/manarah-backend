import { CertificateType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { createNotification } from "./notificationService";
import { generateCertificatePdf } from "../utils/pdf";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";

const CERTIFICATE_DIR = path.join(process.cwd(), "uploads", "certificates");
if (!fs.existsSync(CERTIFICATE_DIR)) {
  fs.mkdirSync(CERTIFICATE_DIR, { recursive: true });
}

export interface CertificateResponseItem {
  id: string;
  userId: string;
  competitionId: string;
  competitionTitle: string;
  type: CertificateType;
  fileUrl: string;
  issuedAt: string;
}

export async function generateCertificate(
  userId: string,
  competitionId: string,
  type: CertificateType
): Promise<CertificateResponseItem> {
  // Validate student
  const student = await prisma.user.findUnique({
    where: { id: userId },
    include: { studentProfile: true }
  });

  if (!student || student.role !== "STUDENT") {
    throw new AppError("Student user not found", 404, "STUDENT_NOT_FOUND");
  }

  // Validate competition
  const competition = await prisma.competition.findUnique({
    where: { id: competitionId }
  });

  if (!competition) {
    throw new AppError("Competition not found", 404, "COMPETITION_NOT_FOUND");
  }

  // Check for duplicate certificate
  const existing = await prisma.certificate.findFirst({
    where: { userId, competitionId, type }
  });

  if (existing) {
    throw new AppError(
      "A certificate of this type has already been generated for this student and competition",
      400,
      "CERTIFICATE_ALREADY_EXISTS"
    );
  }

  const name = student.studentProfile?.name || student.email.split("@")[0];
  const competitionTitle = competition.title;
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const fileId = randomUUID();
  const fileName = `${fileId}.pdf`;
  const destPath = path.join(CERTIFICATE_DIR, fileName);
  const fileUrl = `/uploads/certificates/${fileName}`;

  // Generate PDF
  await generateCertificatePdf(destPath, {
    name,
    competitionTitle,
    type,
    date: dateStr
  });

  // Save to DB
  const cert = await prisma.certificate.create({
    data: {
      userId,
      competitionId,
      type,
      fileUrl
    }
  });

  // Notify student
  await createNotification(
    userId,
    "Certificate Issued",
    `Congratulations! You have been awarded a ${type.toLowerCase()} certificate for "${competitionTitle}".`
  );

  return {
    id: cert.id,
    userId: cert.userId,
    competitionId: cert.competitionId,
    competitionTitle,
    type: cert.type,
    fileUrl: cert.fileUrl,
    issuedAt: cert.issuedAt.toISOString()
  };
}

export async function getMyCertificates(userId: string): Promise<CertificateResponseItem[]> {
  const certs = await prisma.certificate.findMany({
    where: { userId },
    include: { competition: { select: { title: true } } },
    orderBy: { issuedAt: "desc" }
  });

  return certs.map((c) => ({
    id: c.id,
    userId: c.userId,
    competitionId: c.competitionId,
    competitionTitle: c.competition.title,
    type: c.type,
    fileUrl: c.fileUrl,
    issuedAt: c.issuedAt.toISOString()
  }));
}
