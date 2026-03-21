import React, { useState, useMemo, useEffect } from "react";
import {
  User,
  LoadData,
  LoadStatus,
  Company,
  ChangeRequest,
  VaultDoc,
  LOAD_STATUS,
} from "../types";
import {
  Truck,
  MapPin,
  CheckCircle2,
  MessageSquare,
  User as UserIcon,
  LogOut,
  Clock,
  Calendar,
  Info,
  FileText,
  Camera,
  AlertTriangle,
  Plus,
  ChevronRight,
  Shield,
  DollarSign,
  Settings,
  X,
  Zap,
  ArrowLeft,
  Map as MapIcon,
  Navigation,
  Phone,
} from "lucide-react";
import { GlobalMapViewEnhanced } from "./GlobalMapViewEnhanced";
import { Scanner } from "./Scanner";
import { Toast } from "./Toast";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { InputDialog } from "./ui/InputDialog";
import { v4 as uuidv4 } from "uuid";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  user: User;
  company?: Company;
  loads: LoadData[];
  isLoading?: boolean;
  loadError?: string | null;
  onRetry?: () => void;
  onLogout: () => void;
  onSaveLoad: (load: LoadData) => Promise<void>;
  onOpenHub?: (tab?: "feed" | "messaging" | "intelligence" | "reports") => void;
}

type ActiveTab =
  | "today"
  | "loads"
  | "documents"
  | "changes"
  | "profile"
  | "map";

interface ToastState {
  message: string;
  type: "success" | "error" | "info";
}

export const DriverMobileHome: React.FC<Props> = ({
  user,
  company,
  loads,
  isLoading,
  loadError,
  onRetry,
  onLogout,
  onSaveLoad,
  onOpenHub,
}) => {
  // --- localStorage persistence (R-P4-09, R-P4-10) ---
  const tabKey = `driver_${user.id}_activeTab`;
  const loadKey = `driver_${user.id}_selectedLoadId`;

  const getStoredTab = (): ActiveTab => {
    try {
      const val = localStorage.getItem(tabKey);
      if (
        val === "today" ||
        val === "loads" ||
        val === "documents" ||
        val === "changes" ||
        val === "profile" ||
        val === "map"
      ) {
        return val;
      }
    } catch {
      // quota or security error — fall through
    }
    return "today";
  };

  const getStoredLoadId = (): string | null => {
    try {
      return localStorage.getItem(loadKey);
    } catch {
      return null;
    }
  };

  const [activeTab, setActiveTabState] = useState<ActiveTab>(getStoredTab);
  const [selectedLoadId, setSelectedLoadIdState] = useState<string | null>(
    getStoredLoadId,
  );
  const [isCapturingDoc, setIsCapturingDoc] = useState(false);
  const [isCreatingChange, setIsCreatingChange] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  // Breakdown modal flow state
  const [breakdownStep, setBreakdownStep] = useState<
    "idle" | "notes" | "tow" | "cargo"
  >("idle");
  const [breakdownNotes, setBreakdownNotes] = useState("");
  const [breakdownNeedsTow, setBreakdownNeedsTow] = useState(false);

  // Wrap setters to persist to localStorage (R-P4-10)
  const setActiveTab = (tab: ActiveTab) => {
    try {
      localStorage.setItem(tabKey, tab);
    } catch {
      // quota error — ignore
    }
    setActiveTabState(tab);
  };

  const setSelectedLoadId = (id: string | null) => {
    try {
      if (id === null) {
        localStorage.removeItem(loadKey);
      } else {
        localStorage.setItem(loadKey, id);
      }
    } catch {
      // quota error — ignore
    }
    setSelectedLoadIdState(id);
  };

  // Mock Change Requests & Docs for MVP
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);

  const activeLoads = useMemo(
    () =>
      loads.filter(
        (l) =>
          l.driverId === user.id &&
          !["delivered", "completed"].includes(l.status),
      ),
    [loads, user.id],
  );
  const selectedLoad = useMemo(
    () => loads.find((l) => l.id === selectedLoadId),
    [loads, selectedLoadId],
  );

  // Visibility Logic
  const v = {
    rate: !company?.driverVisibilitySettings?.hideRates,
    brokerContacts: !company?.driverVisibilitySettings?.hideBrokerContacts,
    customerName: !company?.driverVisibilitySettings?.maskCustomerName,
    pay: company?.driverVisibilitySettings?.showDriverPay,
    rateCon: company?.driverVisibilitySettings?.allowRateCon,
  };

  // Status update with toast feedback (R-P4-05, R-P4-06)
  const handleStatusUpdate = async (newStatus: LoadStatus) => {
    if (!selectedLoad) return;
    try {
      await onSaveLoad({ ...selectedLoad, status: newStatus });
      setToast({
        message: `Status updated to ${newStatus}`,
        type: "success",
      });
    } catch {
      setToast({ message: "Failed to update status", type: "error" });
    }
  };

  // Scanner data extracted handler (R-P4-03)
  const handleDataExtracted = (data: unknown) => {
    if (!selectedLoad) return;
    // Attach extracted document metadata to the load
    const docMeta = data as { docType?: string; confidence?: number };
    const updatedLoad: LoadData = {
      ...selectedLoad,
      bolUrls: [
        ...(selectedLoad.bolUrls || []),
        ...(docMeta.docType === "BOL" ? [`scanned_${Date.now()}`] : []),
      ],
      podUrls: [
        ...(selectedLoad.podUrls || []),
        ...(docMeta.docType === "POD" ? [`scanned_${Date.now()}`] : []),
      ],
    };
    onSaveLoad(updatedLoad).catch(() => {
      setToast({ message: "Failed to save document", type: "error" });
    });
    setIsCapturingDoc(false);
  };

  const createChangeRequest = (type: ChangeRequest["type"]) => {
    const newReq: ChangeRequest = {
      id: uuidv4(),
      loadId: selectedLoadId || "GENERAL",
      driverId: user.id,
      type,
      status: "PENDING",
      notes: "",
      isUrgent: false,
      createdAt: new Date().toISOString(),
    };
    setChangeRequests([newReq, ...changeRequests]);
    setIsCreatingChange(false);
  };

  // Sub-components
  const LoadCard: React.FC<{ load: LoadData }> = ({ load }) => (
    <div
      key={load.id}
      onClick={() => {
        setSelectedLoadId(load.id);
        setActiveTab("today");
      }}
      className="bg-[#0a0f1e] border border-white/10 rounded-3xl p-6 space-y-4 shadow-xl active:scale-95 transition-all"
    >
      <div className="flex justify-between items-start">
        <span className="bg-blue-600/10 text-blue-500 text-xs font-black px-2 py-0.5 rounded border border-blue-500/20 uppercase">
          ID: {load.loadNumber}
        </span>
        <div className="text-right">
          <div className="text-xs font-black text-slate-500 uppercase">
            Status
          </div>
          <div className="text-xs font-black text-blue-400 uppercase">
            {load.status}
          </div>
        </div>
      </div>
      <h3 className="text-lg font-black text-white uppercase tracking-tight">
        {load.pickup?.city ?? ""} → {load.dropoff?.city ?? ""}
      </h3>
      <div className="flex items-center gap-4 py-2 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase">
          <Calendar className="w-3 h-3" /> {load.pickupDate}
        </div>
        <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase">
          <Truck className="w-3 h-3" /> {load.freightType}
        </div>
      </div>
    </div>
  );

  // --- MAIN RENDER LOGIC ---

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter p-6">
        <LoadingSkeleton variant="list" count={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter">
        <ErrorState message={loadError} onRetry={onRetry ?? (() => {})} />
      </div>
    );
  }

  if (selectedLoad) {
    return (
      <div className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter">
        <header className="p-4 bg-[#0a0f1e] border-b border-white/5 flex items-center justify-between shrink-0">
          <button
            onClick={() => setSelectedLoadId(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">
              Back
            </span>
          </button>
          <h1 className="text-lg font-black tracking-tighter uppercase">
            Job Detail
          </h1>
          <button
            onClick={() => onOpenHub?.("messaging")}
            className="w-8 h-8 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-32">
          {/* Header Info */}
          <div className="space-y-2">
            <div className="flex justify-between items-start">
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                {v.customerName
                  ? selectedLoad.pickup?.facilityName || "N/A"
                  : "Confidential Facility"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase">
              {selectedLoad.pickup?.city ?? ""},{" "}
              {selectedLoad.pickup?.state ?? ""}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0a0f1e] p-4 rounded-3xl border border-white/5">
              <div className="text-xs font-black text-slate-500 uppercase mb-1">
                Appointment
              </div>
              <div className="text-xs font-black text-white">
                {selectedLoad.pickupDate}
              </div>
            </div>
            <div className="bg-[#0a0f1e] p-4 rounded-3xl border border-white/5">
              <div className="text-xs font-black text-slate-500 uppercase mb-1">
                Unit #
              </div>
              <div className="text-xs font-black text-white">
                {selectedLoad.truckNumber || "Unassigned"}
              </div>
            </div>
          </div>

          {/* Stops Timeline */}
          <div className="space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-3 h-3" /> Stop Route
            </h3>
            <div className="relative pl-6 space-y-12">
              <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-800" />
              {/* Pickup */}
              <div className="relative">
                <div className="absolute -left-[1.35rem] top-1.5 w-4 h-4 rounded-full bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.5)] border-4 border-[#020617]" />
                <div className="space-y-4">
                  <div className="text-sm font-black text-white uppercase flex justify-between">
                    Pickup
                    <span className="text-xs text-blue-500">
                      Scheduled: {selectedLoad.pickupDate}
                    </span>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase">
                      Load #: {selectedLoad.loadNumber}
                    </div>
                    {selectedLoad.specialInstructions && (
                      <div className="text-xs font-bold text-slate-400 uppercase">
                        Instructions: {selectedLoad.specialInstructions}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Dropoff */}
              <div className="relative">
                <div className="absolute -left-[1.35rem] top-1.5 w-4 h-4 rounded-full bg-slate-700 border-4 border-[#020617]" />
                <div className="space-y-4">
                  <div className="text-sm font-black text-white uppercase flex justify-between">
                    Dropoff
                    <span className="text-xs text-slate-600">
                      ETA: {selectedLoad.pickupDate}
                    </span>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                    <div className="text-xs font-bold text-slate-400 uppercase">
                      Destination: {selectedLoad.dropoff?.city ?? ""},{" "}
                      {selectedLoad.dropoff?.state ?? ""}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Documents Checklist */}
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-3 h-3" /> Required Documents
              </h3>
              <button
                onClick={() => setIsCapturingDoc(true)}
                className="flex items-center gap-2 text-xs font-black text-blue-500 uppercase"
              >
                <Plus className="w-3 h-3" /> Upload
              </button>
            </div>
            <div className="space-y-2">
              {["BOL (Pickup)", "Weight Scale", "POD (Delivery)"].map((doc) => (
                <div
                  key={doc}
                  className="bg-[#0a0f1e] p-4 rounded-2xl border border-white/5 flex justify-between items-center"
                >
                  <div className="text-xs font-bold text-slate-300 uppercase">
                    {doc}
                  </div>
                  <AlertTriangle className="w-4 h-4 text-orange-500/50" />
                </div>
              ))}
            </div>
          </section>

          {/* Financial Visibility (Masked) */}
          {v.pay && (
            <section className="bg-emerald-600/5 rounded-3xl p-6 border border-emerald-500/20">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest">
                  Est. Trip Pay
                </h3>
                <DollarSign className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-white">
                ${selectedLoad.driverPay || "0.00"}
              </div>
              <p className="text-xs text-emerald-700 font-bold uppercase mt-2">
                Calculated by {user.payModel || "Percentage"}
              </p>
            </section>
          )}
        </main>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex gap-4">
          <button
            onClick={() => setIsCreatingChange(true)}
            className="flex-1 py-4 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/5 transition-all"
          >
            Report Issue
          </button>
          {selectedLoad.status === "planned" && (
            <button
              onClick={() => handleStatusUpdate(LOAD_STATUS.Active)}
              className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 transition-all"
            >
              Start Trip
            </button>
          )}
          {selectedLoad.status === "in_transit" && (
            <button
              onClick={() => handleStatusUpdate(LOAD_STATUS.Arrived)}
              className="flex-[2] py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-green-900/40 transition-all"
            >
              Arrived At Stop
            </button>
          )}
        </div>

        {/* Toast notification */}
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onDismiss={() => setToast(null)}
          />
        )}

        {/* Breakdown flow — step 1: describe issue */}
        <InputDialog
          open={breakdownStep === "notes"}
          title="Report Breakdown"
          message="Describe the breakdown (Engine, Tire, Reefer, etc):"
          placeholder="e.g. Right rear tire blow-out on I-40"
          onSubmit={(notes) => {
            setBreakdownNotes(notes);
            setBreakdownStep("tow");
          }}
          onCancel={() => setBreakdownStep("idle")}
          submitLabel="Next"
        />
        {/* Breakdown flow — step 2: tow needed? */}
        <ConfirmDialog
          open={breakdownStep === "tow"}
          title="Tow Truck Required?"
          message="Is a TOW TRUCK required immediately?"
          confirmLabel="Yes — Tow Needed"
          cancelLabel="No Tow"
          danger
          onConfirm={() => {
            setBreakdownNeedsTow(true);
            setBreakdownStep("cargo");
          }}
          onCancel={() => {
            setBreakdownNeedsTow(false);
            setBreakdownStep("cargo");
          }}
        />
        {/* Breakdown flow — step 3: cargo at risk? */}
        <ConfirmDialog
          open={breakdownStep === "cargo"}
          title="Cargo at Risk?"
          message="Is the CARGO at risk (Temp/Security)?"
          confirmLabel="Yes — High Risk"
          cancelLabel="No Risk"
          danger
          onConfirm={() => {
            onSaveLoad({
              ...selectedLoad,
              status: LOAD_STATUS.Active,
              issues: [
                ...(selectedLoad.issues || []),
                {
                  id: uuidv4(),
                  category: "Maintenance",
                  description: `BREAKDOWN: ${breakdownNotes} | Tow: ${breakdownNeedsTow ? "YES" : "NO"} | Risk: HIGH`,
                  status: "Open",
                  reportedBy: user?.id || "driver",
                  reportedAt: new Date().toISOString(),
                },
              ],
              isActionRequired: true,
            });
            setIsCreatingChange(false);
            setBreakdownStep("idle");
            setToast({
              message:
                "EMERGENCY PROTOCOL ACTIVATED. Safety and Dispatch have been alerted.",
              type: "error",
            });
          }}
          onCancel={() => {
            onSaveLoad({
              ...selectedLoad,
              status: LOAD_STATUS.Active,
              issues: [
                ...(selectedLoad.issues || []),
                {
                  id: uuidv4(),
                  category: "Maintenance",
                  description: `BREAKDOWN: ${breakdownNotes} | Tow: ${breakdownNeedsTow ? "YES" : "NO"} | Risk: LOW`,
                  status: "Open",
                  reportedBy: user?.id || "driver",
                  reportedAt: new Date().toISOString(),
                },
              ],
              isActionRequired: true,
            });
            setIsCreatingChange(false);
            setBreakdownStep("idle");
            setToast({
              message:
                "EMERGENCY PROTOCOL ACTIVATED. Safety and Dispatch have been alerted.",
              type: "error",
            });
          }}
        />

        {/* Scanner Modal Overlay (R-P4-02) */}
        {isCapturingDoc && (
          <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="w-full max-w-sm bg-[#0a0f1e] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b border-white/5">
                <h2 className="text-base font-black text-white uppercase tracking-tight">
                  Scan Document
                </h2>
                <button
                  onClick={() => setIsCapturingDoc(false)}
                  className="text-slate-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Scanner
                onDataExtracted={handleDataExtracted}
                onCancel={() => setIsCapturingDoc(false)}
                onDismiss={() => setIsCapturingDoc(false)}
                mode="load"
              />
            </div>
          </div>
        )}

        {/* Change Request Modal */}
        {isCreatingChange && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end sm:items-center justify-center p-6">
            <div className="w-full max-w-sm bg-[#0a0f1e] rounded-[2.5rem] p-8 space-y-6 border border-white/10 shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  Request Extra
                </h2>
                <button onClick={() => setIsCreatingChange(false)}>
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["DETENTION", "LUMPER", "LAYOVER", "TONU"].map((type) => (
                  <button
                    key={type}
                    onClick={() =>
                      createChangeRequest(type as ChangeRequest["type"])
                    }
                    className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-xs font-black text-slate-300 hover:bg-blue-600 hover:text-white transition-all uppercase"
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <h3 className="text-xs font-black text-red-500 uppercase tracking-widest">
                  Emergency / Breakdown
                </h3>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => setBreakdownStep("notes")}
                    className="w-full p-4 bg-red-600/10 border border-red-500/20 rounded-2xl text-xs font-black text-red-500 hover:bg-red-600 hover:text-white transition-all uppercase flex items-center justify-between"
                  >
                    Report Breakdown
                    <AlertTriangle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter">
      {/* Standard Header */}
      <header className="p-4 bg-[#0a0f1e] border-b border-white/5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter uppercase leading-none">
              LoadPilot
            </h1>
            <p className="text-xs text-slate-500 font-black uppercase tracking-[0.2em] mt-1">
              Driver
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          {/* Phone link (R-P4-08) */}
          {company?.phone && (
            <a
              href={`tel:${company.phone}`}
              aria-label="Call Dispatch"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-600/10 text-emerald-500 border border-emerald-500/20"
            >
              <Phone className="w-4 h-4" />
            </a>
          )}
          <button onClick={() => onOpenHub?.("messaging")} className="relative">
            <MessageSquare className="w-5 h-5 text-slate-400" />
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0a0f1e]" />
          </button>
          <button
            onClick={onLogout}
            className="text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Sub-Views Content */}
      <main className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-24">
        {activeTab === "today" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Today Status Bar */}
            <div className="bg-[#0a0f1e] p-6 rounded-[2.5rem] border border-white/5 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest">
                  Active Dispatch
                </h2>
                <p className="text-lg font-black text-white uppercase mt-1">
                  {activeLoads.length > 0
                    ? `${activeLoads.length} Load(s) In Queue`
                    : "No Assignments"}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
            </div>

            {/* Message Dispatch button (R-P4-07) */}
            {activeLoads.length > 0 && (
              <button
                onClick={() => onOpenHub?.("messaging")}
                className="w-full py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 rounded-2xl text-xs font-black uppercase tracking-widest border border-blue-500/20 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Message Dispatch
              </button>
            )}

            {/* Active Load List */}
            <div className="space-y-4">
              {activeLoads.map((load) => (
                <LoadCard key={load.id} load={load} />
              ))}
              {activeLoads.length === 0 && (
                <EmptyState
                  icon={<Truck className="w-12 h-12" />}
                  title="No Active Loads"
                  description="You have no loads currently assigned. Check back soon for new dispatch assignments."
                />
              )}
            </div>
          </div>
        )}

        {activeTab === "loads" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
              Load History
            </h2>
            {loads.length === 0 ? (
              <EmptyState
                icon={<Clock className="w-12 h-12" />}
                title="No Load History"
                description="Your completed and past loads will appear here."
              />
            ) : (
              <div className="space-y-4">
                {loads.map((load) => (
                  <LoadCard key={load.id} load={load} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-6">
            <h2 className="text-xl font-black text-white uppercase tracking-tighter">
              My Documents
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <button className="h-32 bg-[#0a0f1e] border border-blue-500/20 rounded-[2rem] flex flex-col items-center justify-center gap-3">
                <Camera className="w-6 h-6 text-blue-500" />
                <span className="text-xs font-black text-white uppercase">
                  Scan New
                </span>
              </button>
              <button className="h-32 bg-slate-900 border border-white/5 rounded-[2rem] flex flex-col items-center justify-center gap-3">
                <FileText className="w-6 h-6 text-slate-500" />
                <span className="text-xs font-black text-white uppercase">
                  Vault Access
                </span>
              </button>
            </div>
          </div>
        )}

        {activeTab === "changes" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                Change Requests
              </h2>
              <button
                onClick={() => setIsCreatingChange(true)}
                className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"
              >
                <Plus />
              </button>
            </div>
            <div className="space-y-4">
              {changeRequests.map((req) => (
                <div
                  key={req.id}
                  className="bg-[#0a0f1e] p-5 rounded-2xl border border-white/5 flex justify-between items-center"
                >
                  <div>
                    <div className="text-xs font-black text-white uppercase tracking-tight">
                      {req.type}
                    </div>
                    <div className="text-xs text-slate-500 font-bold uppercase mt-1">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-black uppercase ${req.status === "PENDING" ? "bg-orange-500/10 text-orange-500" : "bg-green-500/10 text-green-500"}`}
                  >
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-2xl shadow-blue-900/40">
                {user.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase">
                  {user.name}
                </h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                  {user.role.replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0a0f1e] p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                    <Truck className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white uppercase">
                      Assigned Truck
                    </div>
                    <div className="text-xs text-slate-600 font-bold uppercase">
                      {activeLoads.length > 0 && activeLoads[0].truckNumber
                        ? `Unit: ${activeLoads[0].truckNumber}`
                        : "No truck assigned"}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-800" />
              </div>
              <div className="bg-[#0a0f1e] p-6 rounded-[2rem] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white uppercase">
                      Compliance Tasks
                    </div>
                    <div className="text-xs text-emerald-500 font-bold uppercase">
                      All Records Pass
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-800" />
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full py-5 bg-red-600/10 hover:bg-red-600 hover:text-white text-red-600 rounded-3xl text-xs font-black uppercase tracking-[0.2em] border border-red-500/20 transition-all"
            >
              Sign Out
            </button>
          </div>
        )}

        {activeTab === "map" && (
          <div className="h-full -mx-6 -my-8 animate-in fade-in duration-300 relative border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <GlobalMapViewEnhanced
              loads={loads.filter((l) => l.driverId === user.id)}
              users={[user]}
            />
            <div className="absolute top-4 left-4 right-4 p-4 bg-[#0a0f1e]/80 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-widest">
                  Fleet Tracking
                </h3>
                <p className="text-xs text-emerald-500 font-bold uppercase mt-1 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 fill-emerald-500" />
                  GPS Connection Stable
                </p>
              </div>
              <Navigation className="w-5 h-5 text-blue-500 animate-pulse" />
            </div>
          </div>
        )}
      </main>

      {/* Toast notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Breakdown flow modals (used from overlay too) */}
      <InputDialog
        open={breakdownStep === "notes"}
        title="Report Breakdown"
        message="Describe the breakdown (Engine, Tire, Reefer, etc):"
        placeholder="e.g. Right rear tire blow-out on I-40"
        onSubmit={(notes) => {
          setBreakdownNotes(notes);
          setBreakdownStep("tow");
        }}
        onCancel={() => setBreakdownStep("idle")}
        submitLabel="Next"
      />
      <ConfirmDialog
        open={breakdownStep === "tow"}
        title="Tow Truck Required?"
        message="Is a TOW TRUCK required immediately?"
        confirmLabel="Yes — Tow Needed"
        cancelLabel="No Tow"
        danger
        onConfirm={() => {
          setBreakdownNeedsTow(true);
          setBreakdownStep("cargo");
        }}
        onCancel={() => {
          setBreakdownNeedsTow(false);
          setBreakdownStep("cargo");
        }}
      />
      <ConfirmDialog
        open={breakdownStep === "cargo"}
        title="Cargo at Risk?"
        message="Is the CARGO at risk (Temp/Security)?"
        confirmLabel="Yes — High Risk"
        cancelLabel="No Risk"
        danger
        onConfirm={() => {
          if (selectedLoad) {
            onSaveLoad({
              ...selectedLoad,
              status: LOAD_STATUS.Active,
              issues: [
                ...(selectedLoad.issues || []),
                {
                  id: uuidv4(),
                  category: "Maintenance",
                  description: `BREAKDOWN: ${breakdownNotes} | Tow: ${breakdownNeedsTow ? "YES" : "NO"} | Risk: HIGH`,
                  status: "Open",
                  reportedBy: user?.id || "driver",
                  reportedAt: new Date().toISOString(),
                },
              ],
              isActionRequired: true,
            });
          }
          setIsCreatingChange(false);
          setBreakdownStep("idle");
          setToast({
            message:
              "EMERGENCY PROTOCOL ACTIVATED. Safety and Dispatch have been alerted.",
            type: "error",
          });
        }}
        onCancel={() => {
          if (selectedLoad) {
            onSaveLoad({
              ...selectedLoad,
              status: LOAD_STATUS.Active,
              issues: [
                ...(selectedLoad.issues || []),
                {
                  id: uuidv4(),
                  category: "Maintenance",
                  description: `BREAKDOWN: ${breakdownNotes} | Tow: ${breakdownNeedsTow ? "YES" : "NO"} | Risk: LOW`,
                  status: "Open",
                  reportedBy: user?.id || "driver",
                  reportedAt: new Date().toISOString(),
                },
              ],
              isActionRequired: true,
            });
          }
          setIsCreatingChange(false);
          setBreakdownStep("idle");
          setToast({
            message:
              "EMERGENCY PROTOCOL ACTIVATED. Safety and Dispatch have been alerted.",
            type: "error",
          });
        }}
      />

      {/* Global Sticky Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#0a0f1e]/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-around px-4">
        <button
          onClick={() => {
            setActiveTab("today");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "today" ? "text-blue-500" : "text-slate-500"}`}
        >
          <Clock className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Today
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("loads");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "loads" ? "text-blue-500" : "text-slate-500"}`}
        >
          <Truck className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Loads
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("map");
            setSelectedLoadId(null);
          }}
          className={`flex-1 flex flex-col items-center gap-1 transition-all ${activeTab === "map" ? "text-blue-500" : "text-slate-500"}`}
        >
          <div
            className={`p-2 rounded-2xl ${activeTab === "map" ? "bg-blue-600/20" : ""}`}
          >
            <MapIcon className="w-6 h-6" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest">
            Live Map
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("documents");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "documents" ? "text-blue-500" : "text-slate-500"}`}
        >
          <FileText className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Docs
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("changes");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "changes" ? "text-blue-500" : "text-slate-500"}`}
        >
          <Zap className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Alerts
          </span>
        </button>
        <button
          onClick={() => {
            setActiveTab("profile");
            setSelectedLoadId(null);
          }}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === "profile" ? "text-blue-500" : "text-slate-500"}`}
        >
          <UserIcon className="w-6 h-6" />
          <span className="text-xs font-black uppercase tracking-widest">
            Me
          </span>
        </button>
      </nav>
    </div>
  );
};
