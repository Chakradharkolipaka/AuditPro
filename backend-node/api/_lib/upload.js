import multer from "multer";
import { isSupportedExtension, supportedExtensions } from "../../src/services/languageSupport.js";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isSupportedExtension(file?.originalname || "")) {
      return cb(
        Object.assign(new Error(`Unsupported file type. Allowed: ${supportedExtensions().join(", ")}`), {
          status: 400,
        })
      );
    }
    if (file.mimetype && !/text|octet-stream|application/.test(file.mimetype)) {
      // be conservative but not too strict; browsers vary
    }
    cb(null, true);
  },
});
