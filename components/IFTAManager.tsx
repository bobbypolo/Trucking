import React, { useState, useEffect } from "react";
import {
  Fuel,
  Map,
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Save,
  Plus,
  Trash2,
  Calendar,
  Truck,
  Globe,
  Calculator,
  AlertTriangle,
  CheckCircle,
  Shield,
  ArrowRight,
} from "lucide-react";
import { IFTASummary, MileageEntry, IFTASummaryRow, LoadData } from "../types";
import {
  getIFTASummary,
  getMileageEntries,
  saveMileageEntry,
  postIFTAToLedger,
} from "../services/financialService";
import { exportToExcel, exportToPDF } from "../services/exportService";
import { IFTAEvidenceReview } from "./IFTAEvidenceReview";
import { Toast } from "./Toast";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  loads: LoadData[];
}

export const IFTAManager: React.FC<Props> = ({ loads }) => {
  const [quarter, setQuarter] = useState(1);
  const [year, setYear] = useState(2026);
  const [summary, setSummary] = useState<IFTASummary | null>(null);
  const [mileageEntries, setMileageEntries] = useState<MileageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddMileage, setShowAddMileage] = useState(false);
  const [newEntry, setNewEntry] = useState<Partial<MileageEntry>>({
    date: new Date().toISOString().split("T")[0],
    stateCode: "",
    miles: 0,
    type: "Manual",
  });
  const [reviewLoad, setReviewLoad] = useState<LoadData | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [confirmLedger, setConfirmLedger] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mileageErrors, setMileageErrors] = useState<Record<string, string>>(
    {},
  );
  const US_STATES = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
    "DC",
  ];

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [s, m] = await Promise.all([
        getIFTASummary(quarter, year),
        getMileageEntries(),
      ]);
      setSummary(s);
      setMileageEntries(m);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Failed to load IFTA data. Please try again.",
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [quarter, year]);

  const handlePostToLedger = () => {
    if (!summary) return;
    setConfirmLedger(true);
  };

  const doPostToLedger = async () => {
    setConfirmLedger(false);
    if (!summary) return;
    try {
      await postIFTAToLedger({ quarter, year, netTaxDue: summary.netTaxDue });
      setToast({
        message: "Posted successfully to IFTA Payable",
        type: "success",
      });
    } catch (e) {
      setToast({ message: "Posting failed", type: "error" });
    }
  };

  const validateMileageEntry = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!newEntry.truckId) errs.truckId = "Truck ID is required";
    if (!newEntry.date) {
      errs.date = "Date is required";
    } else if (newEntry.date > new Date().toISOString().split("T")[0]) {
      errs.date = "Date cannot be in the future";
    }
    if (!newEntry.stateCode) errs.stateCode = "State code is required";
    else if (!US_STATES.includes(newEntry.stateCode.toUpperCase()))
      errs.stateCode = "Invalid US state code";
    if (!newEntry.miles || Number(newEntry.miles) <= 0)
      errs.miles = "Miles must be greater than 0";
    return errs;
  };

  const isMileageValid =
    !!newEntry.truckId &&
    !!newEntry.date &&
    !!newEntry.stateCode &&
    US_STATES.includes((newEntry.stateCode || "").toUpperCase()) &&
    !!newEntry.miles &&
    Number(newEntry.miles) > 0;

  const handleSaveMileage = async () => {
    const errs = validateMileageEntry();
    if (Object.keys(errs).length > 0) {
      setMileageErrors(errs);
      return;
    }
    setMileageErrors({});
    setIsSubmitting(true);
    try {
      await saveMileageEntry(newEntry);
      setShowAddMileage(false);
      loadData();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col space-y-6 p-8">
        <LoadingSkeleton variant="card" count={4} />
        <LoadingSkeleton variant="table" count={5} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col">
        <ErrorState message={loadError} onRetry={loadData} />
      </div>
    );
  }

  if (!summary && mileageEntries.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <EmptyState
          icon={<Globe className="w-12 h-12" />}
          title="No IFTA Data Available"
          description="Select a quarter and year to view IFTA compliance data, or add mileage entries to get started."
          action={{
            label: "Add Mileage Entry",
            onClick: () => setShowAddMileage(true),
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-500">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      <ConfirmDialog
        open={confirmLedger}
        title="Post to General Ledger"
        message={`Post IFTA liability of $${summary?.netTaxDue?.toLocaleString() ?? "0"} to General Ledger?`}
        confirmLabel="Post"
        onConfirm={doPostToLedger}
        onCancel={() => setConfirmLedger(false)}
      />
      {/* CONTENT HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
            <Globe className="w-8 h-8 text-blue-500" />
            IFTA Multi-State Compliance
          </h2>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
            Audit-Proof Mileage Logs • Tax-Paid Fuel Reconciliation • Quarterly
            Postings
          </p>
        </div>

        <div className="flex bg-slate-900 border border-white/5 rounded-2xl p-1 shadow-2xl">
          {[1, 2, 3, 4].map((q) => (
            <button
              key={q}
              onClick={() => setQuarter(q)}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${quarter === q ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-white"}`}
            >
              Q{q}
            </button>
          ))}
          <div className="w-px h-6 bg-white/5 mx-2 my-auto" />
          <select
            aria-label="Select year"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-[10px] font-black text-white px-4 outline-none uppercase"
          >
            <option value={2026} className="bg-slate-900">
              2026
            </option>
            <option value={2025} className="bg-slate-900">
              2025
            </option>
          </select>
        </div>
        <button
          onClick={() => {
            setToast({
              message: `Generating IFTA Package for Q${quarter} ${year}...`,
              type: "info",
            });
            exportToPDF(
              ["State", "Miles", "Gallons", "Tax Rate"],
              mileageEntries.map((e) => [
                e.state,
                String(e.miles),
                String(e.gallons || ""),
                "",
              ]),
              `IFTA Package Q${quarter} ${year}`,
              `ifta-q${quarter}-${year}`,
            );
          }}
          className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
        >
          <Download className="w-4 h-4" /> Generate Quarterly Package
        </button>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-4 gap-6">
        {[
          {
            label: "Total Fleet Miles",
            val: (summary?.totalMiles || 0).toLocaleString(),
            unit: "MI",
            icon: Map,
            color: "text-blue-500",
          },
          {
            label: "Fuel Consumed",
            val: (summary?.totalGallons || 0).toLocaleString(),
            unit: "GAL",
            icon: Fuel,
            color: "text-emerald-500",
          },
          {
            label: "Fleet Average MPG",
            val:
              summary?.totalMiles && summary?.totalGallons
                ? (summary.totalMiles / summary.totalGallons).toFixed(2)
                : "0.00",
            unit: "MPG",
            icon: BarChart3,
            color: "text-slate-400",
          },
          {
            label: "Net Tax Position",
            val: `$${(summary?.netTaxDue || 0).toLocaleString()}`,
            unit:
              summary?.netTaxDue && summary.netTaxDue > 0
                ? "PAYABLE"
                : "REFUND",
            icon: Calculator,
            color:
              summary?.netTaxDue && summary.netTaxDue > 0
                ? "text-red-500"
                : "text-emerald-500",
          },
        ].map((kpi, i) => (
          <div
            key={i}
            className="bg-slate-950/50 border border-white/5 rounded-3xl p-8 backdrop-blur-md"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                {kpi.label}
              </span>
              <kpi.icon className={`w-5 h-5 ${kpi.color} opacity-20`} />
            </div>
            <div className="text-4xl font-black text-white tracking-tighter mb-1">
              {kpi.val}
            </div>
            <div
              className={`text-[8px] font-black uppercase tracking-widest ${kpi.color}`}
            >
              {kpi.unit}
            </div>
          </div>
        ))}
      </div>

      {/* TRIP AUDIT QUEUE */}
      <div className="bg-slate-900/30 border border-white/5 rounded-[2.5rem] p-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Trips Pending Audit
            </h4>
            <p className="text-slate-700 text-[8px] font-bold uppercase mt-1">
              Review raw evidence and attest miles-by-state
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {(loads || [])
            .filter((l) => l.status === "delivered")
            .slice(0, 3)
            .map((load) => (
              <div
                key={load.id}
                className="bg-slate-950/50 border border-white/5 p-6 rounded-3xl group hover:border-blue-500/50 transition-all cursor-pointer"
                onClick={() => setReviewLoad(load)}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
                    #{load.loadNumber || load.id.slice(0, 5)}
                  </span>
                  <div className="p-2 bg-white/5 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all text-slate-700">
                    <Shield className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg font-black text-white uppercase tracking-tighter mb-1 truncate">
                  {load.pickup?.facilityName || "En route"}
                </div>
                <div className="text-[9px] text-slate-500 font-bold uppercase mb-4">
                  {load.pickup?.city || "TX"} → {load.delivery?.city || "OK"}
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-white/5">
                  <span className="text-[8px] font-black text-slate-600 uppercase">
                    Evidence Ready
                  </span>
                  <ArrowRight className="w-3 h-3 text-slate-800" />
                </div>
              </div>
            ))}
          {(loads || []).filter((l) => l.status === "delivered").length ===
            0 && (
            <div className="col-span-3 text-center py-10">
              <p className="text-[10px] font-black text-slate-700 uppercase italic">
                No trips currently pending audit attestation
              </p>
            </div>
          )}
        </div>
      </div>

      {/* WORKSHEET TABLE */}
      <div className="flex-1 overflow-auto bg-[#0a0f1e]/50 border border-white/10 rounded-[2.5rem] backdrop-blur-md">
        <div className="p-8 border-b border-white/5 flex justify-between items-center text-white">
          <h3 className="text-xl font-black uppercase tracking-tighter">
            Jurisdiction Worksheet
          </h3>
          <div className="flex gap-4">
            <button
              onClick={() => {
                if (!summary) return;
                exportToExcel(
                  summary.rows,
                  `IFTA_Q${quarter}_${year}_Full_Audit`,
                );
              }}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Export Audit File (Excel)
            </button>
            <button
              onClick={() => {
                if (!summary) return;
                const headers = [
                  "Jurisdiction",
                  "Total Miles",
                  "Gallons",
                  "MPG",
                  "Tax Paid",
                  "Net Due",
                ];
                const data = summary.rows.map((r) => [
                  r.stateCode,
                  r.totalMiles.toLocaleString(),
                  r.totalGallons.toLocaleString(),
                  (r.totalMiles / r.totalGallons).toFixed(2),
                  `$${r.taxPaidAtPump.toLocaleString()}`,
                  `$${r.taxDue?.toLocaleString()}`,
                ]);
                exportToPDF(
                  headers,
                  data,
                  `IFTA Quarterly Worksheet Q${quarter} ${year}`,
                  `IFTA_Report_Q${quarter}_${year}`,
                );
              }}
              className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Generate 101-IFTA (PDF)
            </button>
            <button
              onClick={handlePostToLedger}
              className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Post to Ledger
            </button>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-black/20 border-b border-white/5 sticky top-0 backdrop-blur-lg">
            <tr>
              <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase">
                Jurisdiction
              </th>
              <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase text-right">
                Total Miles
              </th>
              <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase text-right">
                Gallons
              </th>
              <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase text-right">
                MPG
              </th>
              <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase text-right">
                Tax Paid @ Pump
              </th>
              <th className="px-8 py-5 text-[9px] font-black text-slate-600 uppercase text-right">
                Net Tax Due
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {summary?.rows.map((row) => (
              <tr
                key={row.stateCode}
                className="hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-8 py-6 font-black text-white text-lg">
                  {row.stateCode}
                </td>
                <td className="px-8 py-6 text-right font-black text-slate-300">
                  {(row.totalMiles || 0).toLocaleString()}
                </td>
                <td className="px-8 py-6 text-right font-black text-slate-300">
                  {(row.totalGallons || 0).toLocaleString()}
                </td>
                <td className="px-8 py-6 text-right font-black text-slate-500">
                  {(row.totalMiles / row.totalGallons).toFixed(2)}
                </td>
                <td className="px-8 py-6 text-right font-black text-emerald-500">
                  ${(row.taxPaidAtPump || 0).toLocaleString()}
                </td>
                <td className="px-8 py-6 text-right font-black text-red-500">
                  ${(row.taxDue || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MANUAL MILEAGE SECTION */}
      <div className="bg-slate-900/30 border border-white/5 rounded-[2.5rem] p-8">
        <div className="flex justify-between items-center mb-6">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
            Manual Mileage Log & Correction
          </h4>
          <button
            onClick={() => setShowAddMileage(true)}
            className="px-4 py-2 text-[9px] font-black text-blue-500 uppercase flex items-center gap-2 hover:bg-blue-500/10 rounded-xl transition-all"
          >
            <Plus className="w-4 h-4" /> Add Manual Entry
          </button>
        </div>
        <div className="space-y-4">
          {mileageEntries.slice(0, 5).map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between p-4 bg-slate-950/50 rounded-2xl border border-white/5"
            >
              <div className="flex items-center gap-6">
                <div className="text-[10px] font-black text-white uppercase tracking-tighter w-20">
                  {m.stateCode}
                </div>
                <div className="text-[10px] font-black text-slate-500 uppercase">
                  {m.date}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {m.truckId}
                </div>
              </div>
              <div className="flex items-center gap-10">
                <div className="text-right">
                  <div className="text-[11px] font-black text-white">
                    {m.miles} MI
                  </div>
                  <div className="text-[8px] font-black text-blue-500/50 uppercase italic">
                    {m.type}
                  </div>
                </div>
                <button className="text-slate-700 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL */}
      {showAddMileage && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-10">
          <div className="bg-[#020617] border border-white/10 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl space-y-8">
            <div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                Log Manual Mileage
              </h3>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest mt-1">
                Submit corrections or non-ELD trips
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="iftaTruckID"
                  className="text-[8px] font-black text-slate-600 uppercase ml-1"
                >
                  Truck ID *
                </label>
                <input
                  id="iftaTruckID"
                  type="text"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-xs font-black text-white uppercase outline-none"
                  value={newEntry.truckId}
                  onChange={(e) =>
                    setNewEntry({ ...newEntry, truckId: e.target.value })
                  }
                />
                {mileageErrors.truckId && (
                  <p className="text-red-400 text-xs mt-1">
                    {mileageErrors.truckId}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="iftaDate"
                  className="text-[8px] font-black text-slate-600 uppercase ml-1"
                >
                  Date *
                </label>
                <input
                  id="iftaDate"
                  type="date"
                  className={`w-full bg-slate-900 border ${mileageErrors.date ? "border-red-500" : "border-white/5"} rounded-xl p-4 text-xs font-black text-white uppercase outline-none`}
                  value={newEntry.date}
                  onChange={(e) =>
                    setNewEntry({ ...newEntry, date: e.target.value })
                  }
                />
                {mileageErrors.date && (
                  <p className="text-red-400 text-xs mt-1">
                    {mileageErrors.date}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="iftaStateCode"
                  className="text-[8px] font-black text-slate-600 uppercase ml-1"
                >
                  State Code *
                </label>
                <input
                  id="iftaStateCode"
                  type="text"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-xs font-black text-white uppercase outline-none"
                  value={newEntry.stateCode}
                  onChange={(e) =>
                    setNewEntry({
                      ...newEntry,
                      stateCode: e.target.value.toUpperCase(),
                    })
                  }
                />
                {mileageErrors.stateCode && (
                  <p className="text-red-400 text-xs mt-1">
                    {mileageErrors.stateCode}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="iftaMiles"
                  className="text-[8px] font-black text-slate-600 uppercase ml-1"
                >
                  Miles *
                </label>
                <input
                  id="iftaMiles"
                  type="number"
                  className="w-full bg-slate-900 border border-white/5 rounded-xl p-4 text-xs font-black text-white uppercase outline-none"
                  value={newEntry.miles}
                  onChange={(e) =>
                    setNewEntry({ ...newEntry, miles: Number(e.target.value) })
                  }
                />
                {mileageErrors.miles && (
                  <p className="text-red-400 text-xs mt-1">
                    {mileageErrors.miles}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-4 pt-4">
              <button
                onClick={() => setShowAddMileage(false)}
                className="flex-1 py-4 bg-white/5 text-white border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMileage}
                disabled={isSubmitting || !isMileageValid}
                className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Save Record"}
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewLoad && (
        <IFTAEvidenceReview
          load={reviewLoad}
          onClose={() => setReviewLoad(null)}
          onLocked={() => {
            loadData();
            setReviewLoad(null);
          }}
        />
      )}
    </div>
  );
};
