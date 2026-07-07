import path from "path";
import fs from "fs";
import multer from "multer";
import { randomUUID } from "crypto";
import type { Request } from "express";

const AVATAR_DIR = path.join(process.cwd(), "uploads", "avatars");
const QUALIFICATION_DIR = path.join(process.cwd(), "uploads", "qualifications");
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_QUALIFICATION_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const QUALIFICATION_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(QUALIFICATION_DIR, { recursive: true });

function createImageStorage(directory: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, directory);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
      cb(null, `${randomUUID()}${ext}`);
    },
  });
}

function createImageFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (!IMAGE_MIME_TYPES.has(file.mimetype)) {
    cb(new Error("Only JPEG, PNG, WebP, and GIF images are allowed"));
    return;
  }
  cb(null, true);
}

function createQualificationFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (!QUALIFICATION_MIME_TYPES.has(file.mimetype)) {
    cb(new Error("Only PDF, JPEG, PNG, and WebP files are allowed for qualifications"));
    return;
  }
  cb(null, true);
}

const avatarStorage = createImageStorage(AVATAR_DIR);

export const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: createImageFilter,
  limits: { fileSize: MAX_IMAGE_SIZE },
});

export const tutorProfileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === "qualifications") {
        cb(null, QUALIFICATION_DIR);
        return;
      }
      cb(null, AVATAR_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const fallback = file.fieldname === "qualifications" ? ".pdf" : ".jpg";
      cb(null, `${randomUUID()}${ext || fallback}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "qualifications") {
      createQualificationFilter(req, file, cb);
      return;
    }
    createImageFilter(req, file, cb);
  },
  limits: { fileSize: MAX_QUALIFICATION_SIZE },
});

export function getAvatarPublicUrl(filename: string): string {
  const baseUrl = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return `${baseUrl}/uploads/avatars/${filename}`;
}

export function getQualificationPublicUrl(filename: string): string {
  const baseUrl = process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return `${baseUrl}/uploads/qualifications/${filename}`;
}

export function getAvatarFilenameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const parts = url.split("/");
  return parts[parts.length - 1] || null;
}

export function getQualificationFilenameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const parts = url.split("/");
  return parts[parts.length - 1] || null;
}

export function deleteAvatarFile(filename: string | null) {
  if (!filename) return;
  const filePath = path.join(AVATAR_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function deleteQualificationFile(filename: string | null) {
  if (!filename) return;
  const filePath = path.join(QUALIFICATION_DIR, filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
