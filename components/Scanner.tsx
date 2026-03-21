import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Upload,
  Loader2,
  FileText,
  FolderOpen,
  Truck,
  BookOpen,
  Video,
  XCircle,
} from "lucide-react";
import { getIdTokenAsync } from "../services/authService";
// AI calls proxied through server — no client-side Gemini SDK
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

async function aiPost(
  endpoint: string,
  imageBase64: string,
  mimeType: string,
): Promise<unknown> {
  const token = (await getIdTokenAsync()) ?? "";
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `AI request failed: ${res.status}`);
  }
  return res.json();
}

/** Check if browser supports getUserMedia */
function hasCameraSupport(): boolean {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

interface Props {
  onDataExtracted: (data: any, secondaryData?: any) => void;
  onCancel: () => void;
  /** onDismiss closes the scanner overlay without cancelling the parent load
   *  creation flow. If not provided, falls back to onCancel for backward compatibility. */
  onDismiss?: () => void;
  mode?: "load" | "broker" | "equipment" | "training";
}

export const Scanner: React.FC<Props> = ({
  onDataExtracted,
  onCancel,
  onDismiss,
  mode = "load",
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFallbackMsg, setCameraFallbackMsg] = useState<string | null>(
    null,
  );

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /** Stop all tracks on the active media stream */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  // Cleanup on unmount — prevent media stream leak
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  /** Request camera access via getUserMedia */
  const startCamera = useCallback(async () => {
    setError(null);
    setCameraFallbackMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraActive(true);
      // Attach stream to video element after state update (via effect)
    } catch {
      // Graceful fallback — no crash, just inform the user
      setCameraFallbackMsg(
        "Camera unavailable — please use the file picker below.",
      );
    }
  }, []);

  // Attach stream to <video> once cameraActive flips true
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [cameraActive]);

  /** Capture a frame from the live video feed */
  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Stop the camera after capture
    stopCamera();

    // Convert canvas to base64 and process through the same AI pipeline
    const dataUrl = canvas.toDataURL("image/png");
    const base64String = dataUrl.split(",")[1];
    const mimeType = "image/png";

    setIsProcessing(true);
    setError(null);

    try {
      if (mode === "broker") {
        const result = (await aiPost(
          "/ai/extract-broker",
          base64String,
          mimeType,
        )) as { brokerInfo: unknown };
        onDataExtracted(result.brokerInfo);
      } else if (mode === "equipment") {
        const result = (await aiPost(
          "/ai/extract-equipment",
          base64String,
          mimeType,
        )) as { equipmentInfo: unknown };
        onDataExtracted(result.equipmentInfo);
      } else if (mode === "training") {
        const result = (await aiPost(
          "/ai/generate-training",
          base64String,
          mimeType,
        )) as { training: unknown };
        onDataExtracted(result.training);
      } else {
        const result = (await aiPost(
          "/ai/extract-load",
          base64String,
          mimeType,
        )) as { loadInfo: { load: unknown; broker: unknown } };
        const { load, broker } = result.loadInfo;
        onDataExtracted(load, broker);
      }
    } catch (err: any) {
      const errorMessage = err?.message || "Unknown error occurred";
      setError(`Scanning Failed: ${errorMessage}`);
    } finally {
      setIsProcessing(false);
    }
  }, [mode, onDataExtracted, stopCamera]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      setError("Please select a valid file (JPG, PNG, PDF).");
      return;
    }

    setIsProcessing(true);
    setError(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = (reader.result as string).split(",")[1];

        if (mode === "broker") {
          const result = (await aiPost(
            "/ai/extract-broker",
            base64String,
            file.type,
          )) as { brokerInfo: unknown };
          onDataExtracted(result.brokerInfo);
        } else if (mode === "equipment") {
          const result = (await aiPost(
            "/ai/extract-equipment",
            base64String,
            file.type,
          )) as { equipmentInfo: unknown };
          onDataExtracted(result.equipmentInfo);
        } else if (mode === "training") {
          const result = (await aiPost(
            "/ai/generate-training",
            base64String,
            file.type,
          )) as { training: unknown };
          onDataExtracted(result.training);
        } else {
          const result = (await aiPost(
            "/ai/extract-load",
            base64String,
            file.type,
          )) as { loadInfo: { load: unknown; broker: unknown } };
          const { load, broker } = result.loadInfo;
          onDataExtracted(load, broker);
        }
      } catch (err: any) {
        const errorMessage = err?.message || "Unknown error occurred";
        setError(`Scanning Failed: ${errorMessage}`);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const getTitle = () => {
    if (mode === "broker") return "Scan Broker Profile";
    if (mode === "equipment") return "Scan Equipment ID";
    if (mode === "training") return "Harvest Training Content";
    return "Scan Load Document";
  };

  const getDescription = () => {
    if (mode === "broker")
      return "Upload a Carrier Packet or Rate Con to create a profile.";
    if (mode === "equipment") return "Take a photo of the Unit ID decal.";
    if (mode === "training")
      return "Upload safety manuals or technical bulletins to auto-generate quizzes.";
    return "Upload or take a photo of a Rate Confirmation or BOL.";
  };

  const cameraSupported = hasCameraSupport();

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full">
      {isProcessing ? (
        <div className="flex flex-col items-center py-10">
          <Loader2 className="w-16 h-16 text-blue-500 animate-spin mb-6" />
          <h3 className="text-xl text-white font-semibold animate-pulse">
            AI Lab Analyzing
          </h3>
          <p className="text-slate-400 text-center mt-2 max-w-xs text-xs uppercase font-bold tracking-widest">
            {mode === "training"
              ? "Converting documentation to training modules..."
              : "Extracting metadata..."}
          </p>
        </div>
      ) : cameraActive ? (
        /* Live camera preview mode */
        <div className="w-full flex flex-col items-center">
          <h2 className="text-2xl font-bold text-white mb-4 text-center uppercase tracking-tighter">
            Camera Preview
          </h2>
          <div className="relative w-full max-w-md mb-4">
            <video
              ref={videoRef}
              data-testid="camera-preview"
              autoPlay
              playsInline
              muted
              className="w-full rounded-xl border-2 border-blue-500"
            />
            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <div className="flex gap-4 mb-6">
            <button
              onClick={captureFrame}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-all active:scale-95"
            >
              <Camera className="w-5 h-5" />
              Capture
            </button>
            <button
              onClick={stopCamera}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest transition-all active:scale-95"
            >
              <XCircle className="w-5 h-5" />
              Stop Camera
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mb-4 border border-blue-500/30">
            {mode === "training" ? (
              <BookOpen className="w-8 h-8 text-blue-400" />
            ) : mode === "equipment" ? (
              <Truck className="w-8 h-8 text-blue-400" />
            ) : (
              <FileText className="w-8 h-8 text-blue-400" />
            )}
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center uppercase tracking-tighter">
            {getTitle()}
          </h2>
          <p className="text-slate-400 text-center mb-8 max-w-sm text-sm font-medium">
            {getDescription()}
          </p>

          {/* Camera fallback message */}
          {cameraFallbackMsg && (
            <div className="mb-4 p-3 bg-amber-900/40 border border-amber-700 text-amber-200 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-3 w-full">
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              {cameraFallbackMsg}
            </div>
          )}

          <div
            className={`grid grid-cols-1 ${cameraSupported ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4 w-full mb-6`}
          >
            {/* Live camera button — only when getUserMedia is supported */}
            {cameraSupported && (
              <button
                onClick={startCamera}
                className="h-full flex flex-col items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 hover:border-purple-500 text-white p-6 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <Video className="w-8 h-8 text-purple-400" />
                <span className="font-bold uppercase text-xs tracking-widest">
                  Use Camera
                </span>
              </button>
            )}
            <label className="relative cursor-pointer group">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 hover:border-blue-500 text-white p-6 rounded-xl transition-all active:scale-95">
                <Camera className="w-8 h-8 text-blue-400" />
                <span className="font-bold uppercase text-xs tracking-widest">
                  Take Photo
                </span>
              </div>
            </label>
            <label className="relative cursor-pointer group">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="h-full flex flex-col items-center justify-center gap-3 bg-slate-700 hover:bg-slate-600 border-2 border-slate-600 hover:border-green-500 text-white p-6 rounded-xl transition-all active:scale-95">
                <FolderOpen className="w-8 h-8 text-green-400" />
                <span className="font-bold uppercase text-xs tracking-widest">
                  Upload PDF/JPG
                </span>
              </div>
            </label>
          </div>
          {error && (
            <div className="mb-6 p-4 bg-red-900/40 border border-red-800 text-red-200 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-3 w-full">
              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              {error}
            </div>
          )}
          <div className="w-full border-t border-slate-700 pt-6 flex justify-center">
            <button
              onClick={onDismiss ?? onCancel}
              className="text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest py-2 px-4 rounded hover:bg-slate-700 transition-colors"
            >
              Cancel Operation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
