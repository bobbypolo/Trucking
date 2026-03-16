import { LoadData, LoadLeg } from "../types";
import { v4 as uuidv4 } from "uuid";
import { DEMO_MODE } from "./firebase";

export interface OCRResult {
  loadData: Partial<LoadData>;
  confidence: number;
}

/**
 * OCR Service using Gemini for document extraction.
 * In demo mode, returns sample structured load data simulating an extraction
 * from a standard Intermodal Rate Confirmation.
 * In production, delegates to the server-side AI extraction endpoint.
 */
export const extractLoadData = async (file: File): Promise<OCRResult> => {
  if (!DEMO_MODE) {
    // Production path — real OCR is handled server-side via /api/ai/extract
    throw new Error(
      "OCR extraction requires the server-side AI endpoint. Upload documents through the Load Creation wizard.",
    );
  }

  // Demo mode: simulate network delay for AI processing
  await new Promise((resolve) => setTimeout(resolve, 3500));

  // Demo mode sample extraction data
  const demoLoad: Partial<LoadData> = {
    loadNumber: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
    carrierRate: 1850.0,
    containerNumber: "SZLU 928374",
    containerSize: "40' High Cube",
    chassisProvider: "DCLI",
    commodity: "ELECTRONICS - FLAT PANEL TVS",
    weight: 42500,
    pickupDate: new Date().toISOString().split("T")[0],
    legs: [
      {
        id: uuidv4(),
        type: "Pickup",
        location: {
          facilityName: "APM TERMINALS - PIER 400",
          city: "Los Angeles",
          state: "CA",
          address: "2500 Navy Way",
        },
        date: new Date().toISOString(),
        completed: false,
      },
      {
        id: uuidv4(),
        type: "Dropoff",
        location: {
          facilityName: "KCI WHSE - RIVERSIDE",
          city: "Riverside",
          state: "CA",
          address: "123 Logistics Way",
        },
        date: new Date(Date.now() + 86400000).toISOString(),
        completed: false,
      },
    ],
  };

  return {
    loadData: demoLoad,
    confidence: 0.94,
  };
};
