import fs from 'fs/promises';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const MIN_EXTRACTED_TEXT_LENGTH = 100;

export class TextExtractionService {
  /**
   * @param {string} storageKey
   * @param {string} mimeType
   */
  async extractFromFile(storageKey, mimeType) {
    if (mimeType !== 'application/pdf') {
      throw new Error(`Text extraction is not supported for mimeType: ${mimeType}`);
    }

    const buffer = await fs.readFile(storageKey);
    const parsed = await pdfParse(buffer);
    const extractedText = (parsed.text ?? '').trim();

    if (extractedText.length < MIN_EXTRACTED_TEXT_LENGTH) {
      throw new Error(
        `Extracted text is too short (${extractedText.length} chars; minimum ${MIN_EXTRACTED_TEXT_LENGTH})`,
      );
    }

    return {
      extractedText,
      extractedTextLength: extractedText.length,
      pageCount: parsed.numpages ?? null,
      ocrUsed: false,
    };
  }
}

export default TextExtractionService;
