import React, { useState, useEffect } from "react";
import {
  Shield,
  Map,
  Activity,
  CheckCircle,
  AlertTriangle,
  Lock,
  ChevronRight,
  MapPin,
  Fuel,
  ArrowRight,
  Search,
  Filter,
  Info,
  Eye,
  Download,
  FileText,
  History,
} from "lucide-react";
import { IFTATripEvidence, IFTATripAudit, LoadData } from "../types";
import {
  getIFTAEvidence,
  analyzeIFTA,
  lockIFTATrip,
} from "../services/financialService";
import { Toast } from "./Toast";

interface Props {
  load: LoadData;
  onClose: () => void;
  onLocked: () => void;
}

export const IFTAEvidenceReview: React.FC<Props> = ({
  load,
  onClose,
  onLocked,
}) => {
  const [evidence, setEvidence] = useState<IFTATripEvidence[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attested, setAttested] = useState(false);
  const [viewMode, setViewMode] = useState<"GPS" | "ROUTES">("GPS");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    const loadEvidence = async () => {
      const data = await getIFTAEvidence(load.id);
      setEvidence(data);

      // Auto-analyze
      if (data.length > 0) {
        const res = await analyzeIFTA({ pings: data, mode: "GPS" });
        setAnalysis(res);
      }
      setLoading(false);
    };
    loadEvidence();
  }, [load.id]);

  const handleLock = async () => {
    if (!attested || !analysis) return;

    const audit: Partial<IFTATripAudit> = {
      truckId: load.driver_id || "UNKNOWN",
      loadId: load.id,
      tripDate: new Date().toISOString().split("T")[0],
      totalTotalMiles: Object.values(analysis.jurisdictionMiles || {}).reduce(
        (s: any, v: any) => s + v,
        0,
      ) as number,
      method: analysis.method,
      confidenceLevel: analysis.confidence,
      jurisdictionMiles: analysis.jurisdictionMiles,
      attestedBy: "System Admin",
      status: "LOCKED",
    };

    try {
      await lockIFTATrip(audit);
      setToast({
        message: "Trip evidence locked and synced to IFTA ledger",
        type: "success",
      });
      onLocked();
      onClose();
    } catch (e) {
      setToast({ message: "Failed to lock trip", type: "error" });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-2xl z-[150] flex items-center justify-center p-10">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      <div className="bg-[#020617] border border-white/10 w-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        {/* HEADER */}
        <div className="p-10 border-b border-white/5 bg-slate-900/20 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                IFTA Trip Review{" "}
                <span className="text-blue-500/50">
                  #{load.loadNumber || load.id.slice(0, 6)}
                </span>
              </h2>
              <span
                className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${analysis?.confidence === "HIGH" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-orange-500/10 text-orange-500 border border-orange-500/20"}`}
              >
                {analysis?.confidence || "Pending"} Confidence
              </span>
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
              Audit Evidence Pipeline • {evidence.length} Data Points Collected
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl transition-all"
          >
            <Lock className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* TIMELINE (Step 0) */}
          <div className="w-1/3 border-r border-white/5 p-10 overflow-auto bg-black/20">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-8 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Evidence Timeline
            </h4>
            <div className="space-y-6 relative border-l-2 border-white/5 ml-2 pl-8">
              {evidence.map((ev, i) => (
                <div key={ev.id} className="relative">
                  <div className="absolute -left-10 top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-slate-950 flex items-center justify-center">
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${ev.eventType === "GPS_PING" ? "bg-blue-500" : "bg-emerald-500"}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-white uppercase">
                        {ev.eventType.replace("_", " ")}
                      </span>
                      <span className="text-[9px] font-bold text-slate-600">
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500 font-mono">
                      {ev.lat.toFixed(4)}, {ev.lng.toFixed(4)}
                      {ev.stateCode && ` • ${ev.stateCode}`}
                    </div>
                    <div className="text-[8px] text-slate-700 uppercase font-black">
                      {ev.source}
                    </div>
                  </div>
                </div>
              ))}
              {evidence.length === 0 && (
                <div className="text-slate-700 text-center py-10 uppercase font-black text-[10px] italic">
                  No raw evidence found for this trip
                </div>
              )}
            </div>
          </div>

          {/* ANALYSIS (Step 1-2) */}
          <div className="flex-1 p-10 overflow-auto space-y-10">
            {/* DECISION TREE SELECTOR */}
            <div className="grid grid-cols-3 gap-6">
              {[
                {
                  tier: "Tier A",
                  label: "Actual GPS",
                  desc: "Breadcrumb Summation",
                  icon: Map,
                  color: "blue",
                  disabled: evidence.length < 5,
                  mode: "GPS",
                },
                {
                  tier: "Tier B",
                  label: "Hybrid Recon",
                  desc: "GPS + Google Gaps",
                  icon: History,
                  color: "indigo",
                  disabled: false,
                  mode: "HYBRID",
                },
                {
                  tier: "Tier C",
                  label: "Route Estimate",
                  desc: "Google Maps Path",
                  icon: Shield,
                  color: "slate",
                  disabled: false,
                  mode: "ROUTES",
                },
              ].map((tier) => (
                <button
                  key={tier.tier}
                  disabled={tier.disabled}
                  onClick={() => setViewMode(tier.mode as any)}
                  className={`p-6 rounded-3xl border text-left transition-all ${viewMode === tier.mode ? `bg-blue-600/10 border-blue-500/50 ring-1 ring-blue-500/50` : "bg-slate-900/50 border-white/5 opacity-50"}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`text-[9px] font-black uppercase tracking-widest ${viewMode === tier.mode ? "text-blue-500" : "text-slate-600"}`}
                    >
                      {tier.tier}
                    </div>
                    <tier.icon
                      className={`w-5 h-5 ${viewMode === tier.mode ? "text-blue-500" : "text-slate-600"}`}
                    />
                  </div>
                  <div className="text-lg font-black text-white uppercase tracking-tighter">
                    {tier.label}
                  </div>
                  <div className="text-[9px] text-slate-500 font-black uppercase mt-1">
                    {tier.desc}
                  </div>
                </button>
              ))}
            </div>

            {/* MAP PREVIEW PLACEHOLDER */}
            <div className="aspect-video bg-slate-950 border border-white/5 rounded-[2.5rem] relative overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
              <div className="relative text-center">
                <MapPin className="w-12 h-12 text-slate-800 mb-4 mx-auto" />
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  Interactive Audit Map Pipeline
                </div>
                <div className="text-[9px] text-slate-700 uppercase mt-2">
                  {viewMode} Mode Visualization
                </div>
              </div>
            </div>

            {/* RESULTS TABLE */}
            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Computed Jurisdiction Split
              </h4>
              <div className="bg-slate-950 border border-white/5 rounded-[2.5rem] overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-black/20 border-b border-white/5">
                    <tr>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase">
                        State
                      </th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase text-right">
                        Miles
                      </th>
                      <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase text-right">
                        Percentage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {analysis?.jurisdictionMiles &&
                      Object.entries(analysis.jurisdictionMiles).map(
                        ([state, miles]: any) => (
                          <tr key={state}>
                            <td className="px-8 py-6 font-black text-white text-lg">
                              {state}
                            </td>
                            <td className="px-8 py-6 text-right font-black text-blue-500">
                              {miles.toFixed(2)} MI
                            </td>
                            <td className="px-8 py-6 text-right">
                              <div className="text-[10px] font-black text-slate-500">
                                {(() => {
                                  const total = Object.values(
                                    analysis.jurisdictionMiles,
                                  ).reduce(
                                    (a: any, b: any) => a + b,
                                    0,
                                  ) as number;
                                  return total > 0
                                    ? ((miles / total) * 100).toFixed(1) + "%"
                                    : "0%";
                                })()}
                              </div>
                            </td>
                          </tr>
                        ),
                      )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* AUDIT ATTESTATION */}
            <div className="bg-blue-600/5 border border-blue-500/10 rounded-[2.5rem] p-10 space-y-6">
              <div className="flex items-start gap-6">
                <div className="p-4 bg-blue-500/10 rounded-2xl">
                  <CheckCircle className="w-6 h-6 text-blue-500" />
                </div>
                <div className="space-y-4 flex-1">
                  <h4 className="text-xl font-black text-white uppercase tracking-tighter">
                    Audit Attestation
                  </h4>
                  <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                    I hereby attest that the distance records for this trip have
                    been reviewed and verified against available evidence. I
                    understand these records will be locked as immutable audit
                    documentation for IFTA compliance.
                  </p>
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <input
                      type="checkbox"
                      className="w-6 h-6 rounded-lg bg-slate-900 border-white/10 text-blue-600 focus:ring-blue-500/50"
                      checked={attested}
                      onChange={(e) => setAttested(e.target.checked)}
                    />
                    <span className="text-[11px] font-black text-white uppercase group-hover:text-blue-500 transition-colors">
                      Confirm and Attest Evidence
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-10 border-t border-white/5 bg-slate-900/20 shrink-0 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            Discard Changes
          </button>
          <button
            disabled={!attested || loading}
            onClick={handleLock}
            className={`px-12 py-5 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl flex items-center gap-3 font-inter ${attested ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20" : "bg-slate-900 text-slate-700 cursor-not-allowed"}`}
          >
            Lock Trip for Audit <Lock className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
