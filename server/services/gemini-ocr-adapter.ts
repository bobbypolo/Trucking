/**
 * Gemini OCR Adapter for LoadPilot
 *
 * Implements the OcrAdapter interface from ocr.service.ts using Google Gemini AI.
 * Reads document blobs from storage, sends to Gemini for field extraction,
 * and returns structured OcrExtractionOutput with per-field confidence scores.
 */

import { GoogleGenAI, Type } from "@google/genai";
import type { OcrAdapter, OcrExtractionOutput } from "./ocr.service";
import type { StorageAdapter } from "./document.service";
import { createChildLogger } from "../lib/logger";

const log = createChildLogger({ module: "gemini-ocr-adapter" });

/**
 * Infer MIME type from file extension in the storage path.
 */
function inferMimeType(storagePath: string): string {
  const ext = storagePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "tiff":
    case "tif":
      return "image/tiff";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/**
 * Build a document-type-aware extraction prompt.
 */
function buildPromptForDocType(documentType: string): string {
  const dt = documentType.toLowerCase().replace(/[^a-z]/g, "");

  if (dt.includes("bol") || dt.includes("billoflading")) {
    return "Extract all fields from this Bill of Lading document. For each field found, provide the field name, the extracted value, and a confidence score from 0.0 to 1.0. Common fields include: BOL number, shipper name, consignee name, carrier name, pickup date, delivery date, commodity description, weight, piece count, special instructions, reference numbers.";
  }

  if (dt.includes("ratecon") || dt.includes("rateconfirmation")) {
    return "Extract all fields from this Rate Confirmation document. For each field found, provide the field name, the extracted value, and a confidence score from 0.0 to 1.0. Common fields include: load number, carrier rate, broker name, broker MC number, broker phone, broker email, pickup city, pickup state, pickup facility, pickup date, dropoff city, dropoff state, dropoff facility, commodity, weight.";
  }

  if (dt.includes("fuel") || dt.includes("receipt")) {
    return "Extract all fields from this fuel receipt. For each field found, provide the field name, the extracted value, and a confidence score from 0.0 to 1.0. Common fields include: vendor name, gallons, price per gallon, total cost, transaction date, state, truck ID, card number.";
  }

  if (dt.includes("pod") || dt.includes("proofofdelivery")) {
    return "Extract all fields from this Proof of Delivery document. For each field found, provide the field name, the extracted value, and a confidence score from 0.0 to 1.0. Common fields include: delivery date, delivery time, receiver name, receiver signature, load number, piece count, exceptions or damage notes.";
  }

  return "Extract all text fields from this document. For each field found, provide the field name, the extracted value, and a confidence score from 0.0 to 1.0 indicating how certain you are about the extraction.";
}

/**
 * Creates an OCR adapter that uses Google Gemini AI for document field extraction.
 *
 * @param storage - StorageAdapter to read document blobs
 * @returns OcrAdapter compatible with createOcrService()
 */
export function createGeminiOcrAdapter(storage: StorageAdapter): OcrAdapter {
  return {
    async extractFields(
      storagePath: string,
      documentType: string,
      _signal?: AbortSignal,
    ): Promise<OcrExtractionOutput> {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not set — OCR extraction unavailable");
      }

      // Read document blob from storage
      const buffer = await storage.readBlob(storagePath);
      const base64 = buffer.toString("base64");
      const mimeType = inferMimeType(storagePath);

      log.info(
        { storagePath, documentType, mimeType, sizeBytes: buffer.length },
        "Starting Gemini OCR extraction",
      );

      const ai = new GoogleGenAI({ apiKey });
      const prompt = buildPromptForDocType(documentType);

      const schema = {
        type: Type.OBJECT,
        properties: {
          fields: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                field_name: { type: Type.STRING },
                extracted_value: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
              },
              required: ["field_name", "extracted_value", "confidence"],
            },
          },
          raw_text: { type: Type.STRING },
        },
        required: ["fields", "raw_text"],
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType } },
            { text: prompt },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: schema,
        },
      });

      const parsed = JSON.parse(
        response.text || '{"fields": [], "raw_text": ""}',
      );

      log.info(
        { storagePath, fieldCount: parsed.fields?.length ?? 0 },
        "Gemini OCR extraction completed",
      );

      return {
        fields: Array.isArray(parsed.fields) ? parsed.fields : [],
        raw_text: parsed.raw_text || "",
      };
    },
  };
}
