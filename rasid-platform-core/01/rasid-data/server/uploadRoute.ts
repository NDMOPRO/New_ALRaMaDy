/**
 * File Upload Route — stores files locally in uploads/ directory
 * Supports: images, PDFs, Excel, Word, PowerPoint, audio, video
 */
import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { verifyToken } from "./localAuth";
import { createFile } from "./localDb";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure subdirectories exist
const SUBDIRS = ["images", "documents", "spreadsheets", "audio", "video", "other"];
SUBDIRS.forEach((dir) => {
  const fullPath = path.join(UPLOADS_DIR, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Determine subdirectory based on MIME type
function getSubDir(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "images";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
    return "spreadsheets";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    mimeType.includes("presentation") ||
    mimeType.includes("powerpoint")
  )
    return "documents";
  return "other";
}

// Get icon based on MIME type
function getIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audiotrack";
  if (mimeType.startsWith("video/")) return "videocam";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return "table_chart";
  if (mimeType.includes("pdf")) return "picture_as_pdf";
  if (mimeType.includes("word") || mimeType.includes("document")) return "description";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "slideshow";
  return "insert_drive_file";
}

// Get category based on MIME type
function getCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType === "text/csv") return "spreadsheet";
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("word") || mimeType.includes("document")) return "document";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "presentation";
  return "general";
}

// Format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subDir = getSubDir(file.mimetype);
    const dest = path.join(UPLOADS_DIR, subDir);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext);
    const safeName = baseName.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, "_");
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}${ext}`;
    cb(null, uniqueName);
  },
});

// File filter — allow common file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    // Images
    "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp", "image/tiff",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    // Spreadsheets
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    // Presentations
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Audio
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/m4a",
    // Video
    "video/mp4", "video/webm", "video/ogg", "video/quicktime",
    // Text
    "text/plain", "text/html", "application/json",
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(null, true); // Allow all for now, just categorize as "other"
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 10, // Max 10 files at once
  },
});

export const uploadRouter = Router();

// Auth middleware for upload routes
uploadRouter.use(async (req, res, next) => {
  const cookieName = "rasid_session";
  const token = req.cookies?.[cookieName] || req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ error: "غير مصرح — يرجى تسجيل الدخول" });
  }
  const user = await verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: "جلسة منتهية — يرجى تسجيل الدخول مجدداً" });
  }
  (req as any).user = user;
  next();
});

// Single file upload
uploadRouter.post("/single", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "لم يتم اختيار ملف" });
    }

    const user = (req as any).user;
    const subDir = getSubDir(file.mimetype);
    const relativePath = `/uploads/${subDir}/${file.filename}`;

    // Save file record to database
    const dbFile = await createFile({
      userId: user.id,
      title: file.originalname,
      type: "file",
      category: getCategory(file.mimetype),
      status: "ready",
      icon: getIcon(file.mimetype),
      size: formatSize(file.size),
      filePath: relativePath,
      mimeType: file.mimetype,
      metadata: {
        originalName: file.originalname,
        encoding: file.encoding,
        sizeBytes: file.size,
      },
    });

    return res.json({
      success: true,
      file: {
        ...dbFile,
        url: relativePath,
      },
    });
  } catch (error: any) {
    console.error("[Upload] Error:", error);
    return res.status(500).json({ error: "فشل رفع الملف: " + error.message });
  }
});

// Multiple file upload
uploadRouter.post("/multiple", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "لم يتم اختيار ملفات" });
    }

    const user = (req as any).user;
    const results = [];

    for (const file of files) {
      const subDir = getSubDir(file.mimetype);
      const relativePath = `/uploads/${subDir}/${file.filename}`;

      const dbFile = await createFile({
        userId: user.id,
        title: file.originalname,
        type: "file",
        category: getCategory(file.mimetype),
        status: "ready",
        icon: getIcon(file.mimetype),
        size: formatSize(file.size),
        filePath: relativePath,
        mimeType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          encoding: file.encoding,
          sizeBytes: file.size,
        },
      });

      results.push({
        ...dbFile,
        url: relativePath,
      });
    }

    return res.json({
      success: true,
      files: results,
      count: results.length,
    });
  } catch (error: any) {
    console.error("[Upload] Error:", error);
    return res.status(500).json({ error: "فشل رفع الملفات: " + error.message });
  }
});

// Delete uploaded file
uploadRouter.delete("/:fileId", async (req, res) => {
  try {
    const user = (req as any).user;
    const fileId = parseInt(req.params.fileId);

    // Get file info from DB
    const { getFileById, deleteFile } = await import("./localDb");
    const file = await getFileById(fileId, user.id);
    if (!file) {
      return res.status(404).json({ error: "الملف غير موجود" });
    }

    // Delete physical file
    if (file.filePath) {
      const fullPath = path.join(process.cwd(), file.filePath as string);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    // Delete from DB
    await deleteFile(fileId, user.id);

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Upload] Delete error:", error);
    return res.status(500).json({ error: "فشل حذف الملف: " + error.message });
  }
});
