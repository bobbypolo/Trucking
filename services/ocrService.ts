import { LoadData, LoadLeg } from "../types";
import { v4 as uuidv4 } from 'uuid';

export interface OCRResult {
    loadData: Partial<LoadData>;
    confidence: number;
}

/**
 * OCR Service using Gemini for document extraction.
 * For now, this is a high-fidelity mock that returns structured load data
 * simulating an extraction from a standard Intermodal Rate Confirmation.
 */
export const extractLoadData = async (file: File): Promise<OCRResult> => {
    // Simulate network delay for AI processing
    await new Promise(resolve => setTimeout(resolve, 3500));

    // Mock extraction logic based on "analyzing" the file
    // In a real implementation, this would send the image to Gemini (Vertex AI / AI Studio)
    const isPDF = file.type === 'application/pdf';

    const mockLoad: Partial<LoadData> = {
        loadNumber: `LD-${Math.floor(1000 + Math.random() * 9000)}`,
        carrierRate: 1850.00,
        containerNumber: "SZLU 928374",
        containerSize: "40' High Cube",
        chassisProvider: "DCLI",
        commodity: "ELECTRONICS - FLAT PANEL TVS",
        weight: 42500,
        pickupDate: new Date().toISOString().split('T')[0],
        legs: [
            {
                id: uuidv4(),
                type: 'Pickup',
                location: {
                    facilityName: "APM TERMINALS - PIER 400",
                    city: "Los Angeles",
                    state: "CA",
                    address: "2500 Navy Way"
                },
                date: new Date().toISOString(),
                completed: false
            },
            {
                id: uuidv4(),
                type: 'Dropoff',
                location: {
                    facilityName: "KCI WHSE - RIVERSIDE",
                    city: "Riverside",
                    state: "CA",
                    address: "123 Logistics Way"
                },
                date: new Date(Date.now() + 86400000).toISOString(),
                completed: false
            }
        ]
    };

    return {
        loadData: mockLoad,
        confidence: 0.94
    };
};
