import React, { useRef, useState, useEffect } from "react";
import { LoadData, BolData } from "../types";
import {
  X,
  PenTool,
  Eraser,
  CheckCircle,
  FileText,
  Save,
  Clock,
  Lock,
  User,
} from "lucide-react";
import { Toast } from "./Toast";

interface Props {
  load: LoadData;
  onSave: (bolData: BolData) => void;
  onCancel: () => void;
}

// Simple signature canvas component
const SignatureCanvas: React.FC<{
  label: string;
  onSave: (data: string) => void;
  existingSignature?: string;
}> = ({ label, onSave, existingSignature }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!existingSignature);

  useEffect(() => {
    if (existingSignature && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      const img = new Image();
      img.onload = () => ctx?.drawImage(img, 0, 0);
      img.src = existingSignature;
    }
  }, [existingSignature]);

  const getCoords = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e: any) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      const { x, y } = getCoords(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
    }
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      const { x, y } = getCoords(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  const endDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setHasSignature(true);
      onSave(canvasRef.current.toDataURL());
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      onSave("");
    }
  };

  return (
    <div className="mb-4">
      <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">
        {label}
      </label>
      <div className="border border-slate-600 bg-white rounded overflow-hidden relative h-32">
        <canvas
          ref={canvasRef}
          width={400}
          height={128}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
        />
        <button
          type="button"
          onClick={clear}
          className="absolute top-2 right-2 p-1 bg-slate-200 text-slate-600 rounded hover:bg-red-100 hover:text-red-500"
          title="Clear Signature"
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>
      {hasSignature && (
        <div className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
          <CheckCircle className="w-3 h-3" /> Signature Captured
        </div>
      )}
    </div>
  );
};

export const BolGenerator: React.FC<Props> = ({ load, onSave, onCancel }) => {
  const [step, setStep] = useState(1);

  // Context
  const [type, setType] = useState<"Pickup" | "Delivery">("Pickup");

  // Signatures
  const [driverSig, setDriverSig] = useState<string>(
    load.generatedBol?.driverSignature || "",
  );
  const [custSig, setCustSig] = useState<string>(
    load.generatedBol?.shipperSignature ||
      load.generatedBol?.receiverSignature ||
      "",
  );
  const [signatoryTitle, setSignatoryTitle] = useState(
    load.generatedBol?.signatoryTitle || "",
  );

  // Operational
  const [sealNumber, setSealNumber] = useState(
    load.generatedBol?.sealNumber || "",
  );
  const [timeArrived, setTimeArrived] = useState(
    load.generatedBol?.timeArrived || "",
  );
  const [timeStart, setTimeStart] = useState(
    load.generatedBol?.timeLoadingStart || "",
  );
  const [timeEnd, setTimeEnd] = useState(
    load.generatedBol?.timeLoadingEnd || "",
  );

  const [terms, setTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bolErrors, setBolErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);

  const markTime = (setter: (t: string) => void) => {
    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5); // HH:MM
    setter(timeStr);
  };

  const isBolValid = !!driverSig && !!terms;

  const handleSave = async () => {
    if (!driverSig) {
      setBolErrors({ driverSig: "Driver signature is required" });
      setToast({ message: "Driver signature is required.", type: "error" });
      return;
    }
    setBolErrors({});

    // Map customer signature to correct field based on type
    const bolData: BolData = {
      generatedAt: new Date().toISOString(),
      type,
      driverSignature: driverSig,
      shipperSignature: type === "Pickup" ? custSig : undefined,
      receiverSignature: type === "Delivery" ? custSig : undefined,
      signatoryTitle,
      sealNumber,
      timeArrived,
      timeLoadingStart: timeStart,
      timeLoadingEnd: timeEnd,
      termsAccepted: terms,
    };
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSave(bolData));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-xl">
          <h3 className="font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-500" /> Electronic Document
          </h3>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          {/* Stepper */}
          <div className="flex justify-between items-center mb-6 text-xs font-bold text-slate-500 relative">
            <div
              className={`z-10 bg-slate-800 px-2 ${step >= 1 ? "text-blue-400" : ""}`}
            >
              1. Operations
            </div>
            <div
              className={`z-10 bg-slate-800 px-2 ${step >= 2 ? "text-blue-400" : ""}`}
            >
              2. Signatures
            </div>
            <div
              className={`z-10 bg-slate-800 px-2 ${step >= 3 ? "text-blue-400" : ""}`}
            >
              3. Review
            </div>
            <div className="absolute top-1/2 w-full h-px bg-slate-700 -z-0"></div>
          </div>

          {step === 1 && (
            <div className="space-y-6 animate-fade-in">
              {/* Context Switch */}
              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setType("Pickup")}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${type === "Pickup" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  Origin (Pickup)
                </button>
                <button
                  onClick={() => setType("Delivery")}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${type === "Delivery" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  Destination (Delivery)
                </button>
              </div>

              {/* Timestamps */}
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" /> Operational
                  Times
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label htmlFor="bolArrivalTimeHitDock" className="text-[10px] text-slate-500 block">
                        Arrival Time (Hit Dock)
                      </label>
                      <input id="bolArrivalTimeHitDock"
                        type="time"
                        className="input-field py-1"
                        value={timeArrived}
                        onChange={(e) => setTimeArrived(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => markTime(setTimeArrived)}
                      className="mt-4 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white"
                    >
                      Mark Now
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label htmlFor="bolStartLoadingUnloading" className="text-[10px] text-slate-500 block">
                        Start Loading/Unloading
                      </label>
                      <input id="bolStartLoadingUnloading"
                        type="time"
                        className="input-field py-1"
                        value={timeStart}
                        onChange={(e) => setTimeStart(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => markTime(setTimeStart)}
                      className="mt-4 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white"
                    >
                      Mark Now
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label htmlFor="bolFinishLoadingUnloading" className="text-[10px] text-slate-500 block">
                        Finish Loading/Unloading
                      </label>
                      <input id="bolFinishLoadingUnloading"
                        type="time"
                        className="input-field py-1"
                        value={timeEnd}
                        onChange={(e) => setTimeEnd(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => markTime(setTimeEnd)}
                      className="mt-4 px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-white"
                    >
                      Mark Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Seal & Equipment Verify */}
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-orange-400" /> Security &
                  Freight
                </h4>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="bolDroppedWithSealNumber" className="text-xs text-slate-400 block mb-1">
                      Dropped with Seal Number
                    </label>
                    <input id="bolDroppedWithSealNumber"
                      className="input-field"
                      placeholder="Enter Seal #"
                      value={sealNumber}
                      onChange={(e) => setSealNumber(e.target.value)}
                    />
                  </div>
                  <div className="text-xs text-slate-500 bg-slate-900 p-2 rounded">
                    Confirming: {load.palletCount} Pallets, {load.pieceCount}{" "}
                    Pieces. {load.weight} lbs.
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-xs text-slate-400 mb-2">
                Capture signatures using touchscreen or mouse.
              </p>

              <SignatureCanvas
                label="Driver Signature (Required)"
                onSave={setDriverSig}
                existingSignature={driverSig}
              />

              <div className="pt-4 border-t border-slate-700">
                <label htmlFor="bolRepresentative" className="block text-xs font-bold text-slate-400 mb-1 uppercase">
                  {type === "Pickup" ? "Shipper" : "Consignee"} Representative
                </label>
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-slate-500" />
                  <input id="bolRepresentative"
                    className="input-field"
                    placeholder="Signatory Name / Title (e.g. John Doe, Supervisor)"
                    value={signatoryTitle}
                    onChange={(e) => setSignatoryTitle(e.target.value)}
                  />
                </div>
                <SignatureCanvas
                  label={`${type === "Pickup" ? "Shipper" : "Receiver"} Signature`}
                  onSave={setCustSig}
                  existingSignature={custSig}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center animate-fade-in">
              <div className="w-16 h-16 bg-blue-900/50 rounded-full flex items-center justify-center mx-auto border border-blue-500/50">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Generate Document
              </h3>
              <p className="text-slate-400 text-sm">
                Creating{" "}
                {type === "Pickup" ? "Bill of Lading" : "Proof of Delivery"}.
              </p>

              <div className="text-left bg-slate-900 p-4 rounded border border-slate-700 text-xs space-y-2">
                <div className="flex justify-between">
                  <span>Seal Number:</span>{" "}
                  <span className="text-white font-mono">
                    {sealNumber || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Arrived:</span>{" "}
                  <span className="text-white">{timeArrived || "--:--"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Finished:</span>{" "}
                  <span className="text-white">{timeEnd || "--:--"}</span>
                </div>
                <div className="border-t border-slate-700 my-2"></div>
                <div className="flex justify-between">
                  <span>Driver Signed:</span>{" "}
                  {driverSig ? (
                    <span className="text-green-400">Yes</span>
                  ) : (
                    <span className="text-red-400">No</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span>
                    {type === "Pickup" ? "Shipper" : "Receiver"} Signed:
                  </span>{" "}
                  {custSig ? (
                    <span className="text-green-400">Yes</span>
                  ) : (
                    <span className="text-slate-500">No</span>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 p-3 bg-slate-900/50 rounded border border-slate-700 cursor-pointer text-left">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  className="accent-blue-500 w-4 h-4 mt-0.5"
                />
                <span className="text-xs text-slate-300">
                  I certify the cargo is loaded/unloaded as specified and seal
                  is intact (if applicable). This document serves as the
                  official {type === "Pickup" ? "Origin" : "POD"} record.
                </span>
              </label>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900/50 rounded-b-xl flex justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Back
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-sm"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!isBolValid || isSubmitting}
              className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />{" "}
              {isSubmitting ? "Saving..." : "Save & Attach"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
