/**
 * gemini.service.ts — Server-side Gemini AI service.
 *
 * This module runs ONLY on the server. The API key is read from process.env.GEMINI_API_KEY
 * (server-only, never exposed to the client bundle).
 */

import { GoogleGenAI, Type } from "@google/genai";
import { v4 as uuidv4 } from "uuid";
import { GEMINI_COMPLEX_MODEL, GEMINI_FAST_MODEL } from "../lib/gemini-models";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }
  return new GoogleGenAI({ apiKey });
}

const fileToGenerativePart = (base64Data: string, mimeType: string) => ({
  inlineData: { data: base64Data, mimeType },
});

export const extractLoadInfo = async (
  base64Image: string,
  mimeType: string,
) => {
  const ai = getClient();
  const model = GEMINI_FAST_MODEL;
  const prompt =
    "Extract comprehensive load and broker information from this document. Ensure you capture the 'Carrier Total' or 'Rate' and the 'Broker Name'. Itemize pickup and dropoff locations.";
  const schema = {
    type: Type.OBJECT,
    properties: {
      load: {
        type: Type.OBJECT,
        properties: {
          loadNumber: { type: Type.STRING },
          carrierRate: { type: Type.NUMBER },
          commodity: { type: Type.STRING },
          weight: { type: Type.NUMBER },
          pickupDate: { type: Type.STRING },
          pickup: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING },
              state: { type: Type.STRING },
              facilityName: { type: Type.STRING },
            },
            required: ["city", "state"],
          },
          dropoff: {
            type: Type.OBJECT,
            properties: {
              city: { type: Type.STRING },
              state: { type: Type.STRING },
              facilityName: { type: Type.STRING },
            },
            required: ["city", "state"],
          },
        },
        required: ["loadNumber", "carrierRate", "pickup", "dropoff"],
      },
      broker: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          mcNumber: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
        },
        required: ["name"],
      },
    },
    required: ["load", "broker"],
  };
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [fileToGenerativePart(base64Image, mimeType), { text: prompt }],
    },
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  return JSON.parse(response.text || '{"load": {}, "broker": {}}');
};

export const extractBrokerFromImage = async (
  base64Image: string,
  mimeType: string,
) => {
  const ai = getClient();
  const model = GEMINI_FAST_MODEL;
  const prompt =
    "Extract broker or customer profile information from this document.";
  const schema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      mcNumber: { type: Type.STRING },
      email: { type: Type.STRING },
      phone: { type: Type.STRING },
      address: { type: Type.STRING },
    },
    required: ["name"],
  };
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [fileToGenerativePart(base64Image, mimeType), { text: prompt }],
    },
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  return JSON.parse(response.text || "{}");
};

export const extractEquipmentFromImage = async (
  base64Image: string,
  mimeType: string,
) => {
  const ai = getClient();
  const model = GEMINI_FAST_MODEL;
  const prompt =
    "Identify the unit number and type of equipment in this photo.";
  const schema = {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.STRING },
      type: {
        type: Type.STRING,
        description: "Truck, Trailer, Chassis, or Container",
      },
    },
    required: ["id", "type"],
  };
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [fileToGenerativePart(base64Image, mimeType), { text: prompt }],
    },
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  return JSON.parse(response.text || "{}");
};

export const generateTrainingFromImage = async (
  base64Image: string,
  mimeType: string,
) => {
  const ai = getClient();
  const model = GEMINI_COMPLEX_MODEL;
  const prompt =
    "Analyze the technical safety content, regulatory requirements, or operational procedures in this document. Generate a comprehensive safety training quiz for a fleet driver. Ensure questions are challenging and technical.";
  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      isMandatory: { type: Type.BOOLEAN },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            text: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctIndex: { type: Type.NUMBER },
          },
          required: ["id", "text", "options", "correctIndex"],
        },
      },
    },
    required: ["title", "description", "questions"],
  };
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [fileToGenerativePart(base64Image, mimeType), { text: prompt }],
    },
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  const quiz = JSON.parse(response.text || "{}");
  return {
    ...quiz,
    id: uuidv4(),
    assignedTo: ["all"],
    createdAt: new Date().toISOString(),
  };
};

export const analyzeSafetyCompliance = async (
  activityHistory: unknown[],
  performance: unknown,
) => {
  const ai = getClient();
  const model = GEMINI_COMPLEX_MODEL;
  const prompt = `Perform a deep safety and compliance audit for a driver with these metrics: ${JSON.stringify(performance)}. Activity history: ${JSON.stringify(activityHistory)}`;
  const schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
      suggestedQuizIds: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["summary", "recommendations"],
  };
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  return JSON.parse(
    response.text || '{"summary": "Audit failed", "recommendations": []}',
  );
};

export const extractFuelReceipt = async (
  base64Image: string,
  mimeType: string,
) => {
  const ai = getClient();
  const model = GEMINI_FAST_MODEL;
  const prompt =
    "Extract fuel purchase details from this receipt. Capture the vendor or gas station name, fuel quantity in gallons, price per gallon, total transaction cost, transaction date, the US state where purchased, and the truck or unit number if visible on the receipt.";
  const schema = {
    type: Type.OBJECT,
    properties: {
      vendorName: { type: Type.STRING },
      gallons: { type: Type.NUMBER },
      pricePerGallon: { type: Type.NUMBER },
      totalCost: { type: Type.NUMBER },
      transactionDate: { type: Type.STRING },
      stateCode: { type: Type.STRING, description: "2-letter US state code" },
      truckId: { type: Type.STRING },
      cardNumber: { type: Type.STRING },
    },
    required: ["vendorName", "gallons", "pricePerGallon", "totalCost", "transactionDate", "stateCode"],
  };
  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [fileToGenerativePart(base64Image, mimeType), { text: prompt }],
    },
    config: { responseMimeType: "application/json", responseSchema: schema },
  });
  return JSON.parse(
    response.text ||
      '{"vendorName": "Unknown", "gallons": 0, "pricePerGallon": 0, "totalCost": 0, "transactionDate": "", "stateCode": "XX"}',
  );
};
