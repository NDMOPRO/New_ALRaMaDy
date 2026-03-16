/**
 * File Upload Route — registers files with Central Engine
 */
import { Router } from "express";
import multer from "multer";
import { verifyToken } from "./engineAuth";
import * as engine from "./platformConnector";

// Use memory storage — files go to S3, not local disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max
    files: 10,
  },
});

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

// Single file upload → Engine registration
uploadRouter.post("/single", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "لم يتم اختيار ملف" });
    }

    const user = (req as any).user;
    // Register with engine
    const engineResult = await engine.engineCreateFile({
      title: file.originalname,
      type: "file",
      category: getCategory(file.mimetype),
      status: "ready",
      icon: getIcon(file.mimetype),
      size: formatSize(file.size),
    });

    const engineFile = engineResult.ok ? (engineResult.data as any) : null;

    return res.json({
      success: true,
      file: {
        id: engineFile?.id || engineFile?.data?.id || Date.now().toString(),
        title: file.originalname,
        type: "file",
        category: getCategory(file.mimetype),
        status: "ready",
        icon: getIcon(file.mimetype),
        size: formatSize(file.size),
        mimeType: file.mimetype,
      },
    });
  } catch (error: any) {
    console.error("[Upload] Error:", error);
    return res.status(500).json({ error: "فشل رفع الملف: " + error.message });
  }
});

// Multiple file upload → Engine registration
uploadRouter.post("/multiple", upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "لم يتم اختيار ملفات" });
    }

    const user = (req as any).user;
    const results = [];

    for (const file of files) {
      // Register with engine
      const engineResult = await engine.engineCreateFile({
        title: file.originalname,
        type: "file",
        category: getCategory(file.mimetype),
        status: "ready",
        icon: getIcon(file.mimetype),
        size: formatSize(file.size),
      });

      const engineFile = engineResult.ok ? (engineResult.data as any) : null;

      results.push({
        id: engineFile?.id || engineFile?.data?.id || Date.now().toString(),
        title: file.originalname,
        type: "file",
        category: getCategory(file.mimetype),
        status: "ready",
        icon: getIcon(file.mimetype),
        size: formatSize(file.size),
        mimeType: file.mimetype,
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

// Delete file — via engine
uploadRouter.delete("/:fileId", async (req, res) => {
  try {
    const fileId = req.params.fileId;

    // Delete from engine
    const result = await engine.engineDeleteFile(fileId);
    if (!result.ok) {
      return res.status(404).json({ error: "الملف غير موجود أو لا يمكن حذفه" });
    }

    return res.json({ success: true });
  } catch (error: any) {
    console.error("[Upload] Delete error:", error);
    return res.status(500).json({ error: "فشل حذف الملف: " + error.message });
  }
});
