import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { AppError } from '../utils/AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${safeOriginal}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.mimetype !== 'application/pdf') {
    cb(new AppError('Only PDF files are allowed', { statusCode: 400, code: 'UNSUPPORTED_FILE_TYPE' }));
    return;
  }
  cb(null, true);
}

export const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
}).single('file');
