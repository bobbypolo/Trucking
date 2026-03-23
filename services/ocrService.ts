import { LoadData } from "../types";
import { DEMO_MODE } from "./firebase";

export interface OCRResult {
  loadData: Partial<LoadData>;
  confidence: number;
}

/**
 * OCR Service using Gemini for document extraction.
 * Both demo mode and production mode require the server-side AI extraction
 * endpoint. Demo mode is not a substitute for real OCR — callers must use
 * the Load Creation wizard which POSTs to /api/ai/extract.
 */
export const extractLoadData = async (_file: File): Promise<OCRResult> => {
  if (DEMO_MODE) {
    // Demo mode: OCR is unavailable — no fake data returned.
    throw new Error(
      "OCR extraction is not available in demo mode. Configure Firebase credentials and use the server-side AI endpoint.",
    );
  }

  // Production path — real OCR is handled server-side via /api/ai/extract.
  // This client-side function should not be called directly; use the upload
  // wizard which handles the multipart POST to the server.
  throw new Error(
    "OCR extraction requires the server-side AI endpoint. Upload documents through the Load Creation wizard.",
  );
};
