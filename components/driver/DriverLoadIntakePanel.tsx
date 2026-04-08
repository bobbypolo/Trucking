import React, { useState } from "react";
import { Scanner } from "../Scanner";
import { CheckCircle2, X } from "lucide-react";
import { getIdTokenAsync } from "../../services/authService";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

interface IntakeFields {
  commodity?: string;
  weight?: number;
  bol_number?: string;
  reference_number?: string;
  pickup_date?: string;
  pickup_city?: string;
  pickup_state?: string;
  pickup_facility_name?: string;
  dropoff_city?: string;
  dropoff_state?: string;
  dropoff_facility_name?: string;
}

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

type Step = "scan" | "review" | "success";

/**
 * DriverLoadIntakePanel — driver photographs a Rate Confirmation, OCR extracts
 * fields, and on confirm the load is submitted as status=Draft intake_source=driver.
 */
export const DriverLoadIntakePanel: React.FC<Props> = ({
  onComplete,
  onCancel,
}) => {
  const [step, setStep] = useState<Step>("scan");
  const [fields, setFields] = useState<IntakeFields>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleDataExtracted = (data: any) => {
    const pickup = data?.pickup ?? data?.origin ?? {};
    const dropoff = data?.dropoff ?? data?.destination ?? {};
    setFields({
      commodity: data?.commodity ?? data?.freightDescription,
      weight: data?.weight != null ? Number(data.weight) : undefined,
      bol_number: data?.bolNumber ?? data?.bol_number,
      reference_number:
        (data?.referenceNumbers ?? [])[0] ?? data?.referenceNumber,
      pickup_date: data?.pickupDate ?? data?.date,
      pickup_city: pickup?.city,
      pickup_state: pickup?.state,
      pickup_facility_name: pickup?.facilityName,
      dropoff_city: dropoff?.city,
      dropoff_state: dropoff?.state,
      dropoff_facility_name: dropoff?.facilityName,
    });
    setStep("review");
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const token = (await getIdTokenAsync()) ?? "";
      const res = await fetch(`${API_BASE}/loads/driver-intake`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Request failed: ${res.status}`);
      }
      setStep("success");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "scan") {
    return (
      <Scanner
        autoTrigger="camera"
        mode="intake"
        onDataExtracted={handleDataExtracted}
        onCancel={onCancel}
      />
    );
  }

  if (step === "success") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        <p className="text-sm font-black text-white uppercase tracking-widest">
          Submitted for dispatcher review
        </p>
        <button
          onClick={onComplete}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
        >
          Done
        </button>
      </div>
    );
  }

  // review step
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-black text-white uppercase tracking-widest">
          Review Intake
        </h2>
        <button onClick={onCancel} className="text-slate-500 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2 text-xs text-slate-300">
        {fields.commodity && <p>Commodity: {fields.commodity}</p>}
        {fields.pickup_city && (
          <p>
            Pickup: {fields.pickup_city}, {fields.pickup_state}
          </p>
        )}
        {fields.dropoff_city && (
          <p>
            Dropoff: {fields.dropoff_city}, {fields.dropoff_state}
          </p>
        )}
        {fields.pickup_date && <p>Date: {fields.pickup_date}</p>}
      </div>

      {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}

      <button
        onClick={handleConfirm}
        disabled={submitting}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
        data-testid="intake-confirm-btn"
      >
        {submitting ? "Submitting…" : "Confirm & Submit"}
      </button>
    </div>
  );
};
