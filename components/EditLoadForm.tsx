import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  LoadData,
  LOAD_STATUS,
  FreightType,
  Broker,
  User,
  LoadLeg,
  UserRole,
  LoadStatus,
} from "../types";
import {
  Save,
  Truck,
  MapPin,
  X,
  AlertTriangle,
  DollarSign,
  ShieldCheck,
  UserCheck,
  Zap,
  Navigation,
  Calendar,
  Hash,
  Container,
  Plus,
  Trash2,
  Clock,
  Phone,
  Mail,
  Lock,
  Unlock,
  ChevronDown,
  FileText,
  Printer,
  Calculator,
  MoreHorizontal,
} from "lucide-react";
import { getBrokers } from "../services/brokerService";
import { getCompany, getCompanyUsers } from "../services/authService";
import { generateBolPDF } from "../services/storageService";
import { api } from "../services/api";
import { v4 as uuidv4 } from "uuid";
import { Headset, AlertCircle, MessageSquare } from "lucide-react";
import { Toast } from "./Toast";

interface Props {
  initialData: Partial<LoadData>;
  onSave: (data: LoadData) => void;
  onCancel: () => void;
  currentUser: User;
  users?: User[];
  canViewRates?: boolean;
  existingLoads?: LoadData[];
  canManageLegs?: boolean;
  showBrokerDetails?: boolean;
  canCreateBroker?: boolean;
  isRestrictedDriver?: boolean;
  potentialBroker?: any;
  onOpenHub?: (
    tab: "feed" | "messaging" | "intelligence" | "reports",
    showCallForm?: boolean,
  ) => void;
}

export const EditLoadForm: React.FC<Props> = ({
  initialData,
  onSave,
  onCancel,
  currentUser,
  users: propUsers = [],
  canViewRates = true,
  onOpenHub,
}) => {
  const [formData, setFormData] = useState<Partial<LoadData>>({
    ...initialData,
    legs: initialData.legs || [],
    carrierRate: initialData.carrierRate || 0,
    driverPay: initialData.driverPay || 0,
    status: initialData.status || LOAD_STATUS.Planned,
    isLocked: initialData.isLocked || false,
  });

  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [users, setUsers] = useState<User[]>(propUsers);
  const [showUtilities, setShowUtilities] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showRateCard, setShowRateCard] = useState(false);
  const stopMatrixRef = useRef<HTMLDivElement>(null);
  const settlementRef = useRef<HTMLDivElement>(null);
  const hasGoogleMapsKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const bList = await getBrokers();
        if (controller.signal.aborted) return;
        setBrokers(bList);
        if (propUsers.length === 0) {
          const coUsers = await getCompanyUsers(currentUser.companyId);
          if (controller.signal.aborted) return;
          setUsers(coUsers);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    };
    load();
    return () => controller.abort();
  }, [currentUser]);

  const margins = useMemo(() => {
    const gross = formData.carrierRate || 0;
    const expense = formData.driverPay || 0;
    const margin = gross - expense;
    const percentage = gross > 0 ? (margin / gross) * 100 : 0;
    return { margin, percentage };
  }, [formData.carrierRate, formData.driverPay]);

  const handleUpdateLeg = (idx: number, updates: Partial<LoadLeg>) => {
    const newLegs = [...(formData.legs || [])];
    newLegs[idx] = { ...newLegs[idx], ...updates };
    setFormData({ ...formData, legs: newLegs });
  };

  const addLeg = (type: "Pickup" | "Dropoff" = "Dropoff") => {
    const newLeg: LoadLeg = {
      id: uuidv4(),
      type: type as any,
      location: { city: "", state: "", facilityName: "", address: "", zip: "" },
      date: new Date().toISOString().split("T")[0],
      completed: false,
      pallets: 0,
      weight: 0,
    };
    setFormData({ ...formData, legs: [...(formData.legs || []), newLeg] });
  };

  const removeLeg = (id: string) => {
    setFormData({
      ...formData,
      legs: (formData.legs || []).filter((l) => l.id !== id),
    });
  };

  const validateForm = (): string[] => {
    const errors: string[] = [];
    const legs = formData.legs || [];
    const pickups = legs.filter((l) => l.type === "Pickup");
    const dropoffs = legs.filter((l) => l.type === "Dropoff");
    const hasPickupLocation = pickups.some(
      (l) => l.location?.city || l.location?.address,
    );
    const hasDropoffLocation = dropoffs.some(
      (l) => l.location?.city || l.location?.address,
    );
    if (
      !hasPickupLocation &&
      !formData.pickup?.city &&
      !formData.pickup?.facilityName
    ) {
      errors.push("Pickup location must have at least a city or facility name");
    }
    if (
      !hasDropoffLocation &&
      !formData.dropoff?.city &&
      !formData.dropoff?.facilityName
    ) {
      errors.push(
        "Dropoff location must have at least a city or facility name",
      );
    }
    if (!formData.status) {
      errors.push("Load status is required");
    }
    return errors;
  };

  const handleSave = async () => {
    if (isSubmitting || formData.isLocked) return;
    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      setToast({ message: errors[0], type: "error" });
      return;
    }
    setValidationErrors([]);
    setIsSubmitting(true);
    try {
      await onSave(formData as LoadData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUtilityClick = useCallback(
    async (util: string) => {
      setShowUtilities(false);
      switch (util) {
        case "Print BOL":
          if (formData.id) {
            generateBolPDF(formData as LoadData);
            setToast({ message: "BOL PDF generated", type: "success" });
          } else {
            setToast({
              message: "Save load first to generate BOL",
              type: "info",
            });
          }
          break;
        case "Carrier Rates":
          setShowRateCard((prev) => !prev);
          settlementRef.current?.scrollIntoView({ behavior: "smooth" });
          break;
        case "Load Stops":
          stopMatrixRef.current?.scrollIntoView({ behavior: "smooth" });
          break;
        case "Documents":
          if (formData.id) {
            try {
              await api.get(`/api/documents?loadId=${formData.id}`);
              setToast({ message: "Documents loaded", type: "success" });
            } catch {
              setToast({ message: "Failed to load documents", type: "error" });
            }
          } else {
            setToast({
              message: "Save load first to view documents",
              type: "info",
            });
          }
          break;
        case "Show Route":
          if (hasGoogleMapsKey) {
            const pickupLeg = (formData.legs || []).find(
              (l) => l.type === "Pickup",
            );
            const dropoffLeg = (formData.legs || []).find(
              (l) => l.type === "Dropoff",
            );
            const pickupLoc = pickupLeg?.location || formData.pickup;
            const dropoffLoc = dropoffLeg?.location || formData.dropoff;
            const origin = pickupLoc
              ? `${pickupLoc.city}, ${pickupLoc.state}`
              : "";
            const dest = dropoffLoc
              ? `${dropoffLoc.city}, ${dropoffLoc.state}`
              : "";
            if (origin && dest) {
              window.open(
                `https://www.google.com/maps/dir/${encodeURIComponent(origin)}/${encodeURIComponent(dest)}`,
                "_blank",
              );
            } else {
              setToast({
                message: "Missing origin or destination for route",
                type: "error",
              });
            }
          }
          break;
      }
    },
    [formData, hasGoogleMapsKey],
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0f18] text-white rounded-2xl shadow-3xl overflow-hidden border border-slate-800">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      {/* Top Breadcrumb/Status Row */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4 text-xs font-bold text-slate-400">
          <button
            onClick={onCancel}
            className="hover:text-white transition-colors flex items-center gap-1"
          >
            <ChevronDown className="w-4 h-4 rotate-90" /> Back
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <span className="text-slate-300 uppercase tracking-widest">
            Manifest: {formData.loadNumber || "NEW_MANIFEST"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setShowUtilities(!showUtilities)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-slate-700 transition-all"
            >
              Utilities <ChevronDown className="w-3 h-3" />
            </button>
            {showUtilities && (
              <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 p-2 py-3 animate-in fade-in slide-in-from-top-2">
                {[
                  "Print BOL",
                  "Carrier Rates",
                  "Load Stops",
                  "Documents",
                  ...(hasGoogleMapsKey ? ["Show Route"] : []),
                ].map((util) => (
                  <button
                    key={util}
                    onClick={() => handleUtilityClick(util)}
                    className="w-full text-left px-4 py-2 hover:bg-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
                  >
                    {util}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() =>
              setFormData({
                ...formData,
                isActionRequired: !formData.isActionRequired,
              })
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.isActionRequired ? "bg-yellow-900/20 border-yellow-500/50 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]" : "bg-slate-800 border-slate-700 text-slate-400"}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {formData.isActionRequired ? "Action Tagged" : "Tag for Action"}
          </button>
          <button
            onClick={() =>
              setFormData({ ...formData, isLocked: !formData.isLocked })
            }
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${formData.isLocked ? "bg-red-900/20 border-red-500/30 text-red-500" : "bg-green-900/20 border-green-500/30 text-green-500"}`}
          >
            {formData.isLocked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            {formData.isLocked ? "Locked" : "Unlocked"}
          </button>
        </div>
      </div>

      {/* Lock Warning */}
      {formData.isLocked && (
        <div className="bg-red-500/10 border-b border-red-500/20 py-2 text-center text-[10px] font-black uppercase text-red-500 tracking-[0.2em] animate-pulse">
          Manifest synchronized and locked for invoicing. Edits require
          supervisor override.
        </div>
      )}

      {/* Action Required Banner */}
      {formData.isActionRequired && (
        <div className="bg-yellow-500/5 border-b border-yellow-500/20 p-4 shrink-0">
          <div className="max-w-4xl mx-auto flex gap-4 items-start">
            <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1.5">
                Action Justification Needed
              </div>
              <textarea
                aria-label="Action justification"
                className="w-full bg-slate-950 border border-yellow-500/20 rounded-lg p-2.5 text-[10px] text-white placeholder:text-yellow-900/50 outline-none focus:border-yellow-500 transition-all h-16 resize-none"
                placeholder="PLEASE DOCUMENT THE REASON FOR ESCALATION OR HANDOFF ACTION HERE..."
                value={formData.actionSummary}
                onChange={(e) =>
                  setFormData({ ...formData, actionSummary: e.target.value })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Form Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar scroll-smooth">
        {/* Core Header Grid (3 columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Column 1: Identity & Reference */}
          <div className="space-y-4 bg-slate-900/30 p-6 rounded-2xl border border-slate-800/50">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Hash className="w-4 h-4 text-blue-500" /> Reference Matrix
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="elfProNo"
                  className="text-[11px] font-bold text-slate-500 uppercase"
                >
                  Pro No
                </label>
                <input
                  id="elfProNo"
                  className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg p-2.5 text-xs text-white uppercase font-mono"
                  value={formData.loadNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, loadNumber: e.target.value })
                  }
                  disabled={formData.isLocked}
                  title={
                    formData.isLocked
                      ? "Load is locked for invoicing"
                      : undefined
                  }
                />
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="elfSpecial"
                  className="text-[11px] font-bold text-slate-500 uppercase"
                >
                  Special
                </label>
                <select
                  id="elfSpecial"
                  className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg p-2.5 text-xs text-white"
                  disabled={formData.isLocked}
                  title={
                    formData.isLocked
                      ? "Load is locked for invoicing"
                      : undefined
                  }
                >
                  <option>STANDARD</option>
                  <option>HAZMAT</option>
                  <option>HOT LOAD</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="elfCommodity"
                className="text-[11px] font-bold text-slate-500 uppercase"
              >
                Commodity <span className="text-red-500">*</span>
              </label>
              <input
                id="elfCommodity"
                className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg p-2.5 text-xs text-white uppercase"
                value={formData.commodity}
                onChange={(e) =>
                  setFormData({ ...formData, commodity: e.target.value })
                }
                disabled={formData.isLocked}
                title={
                  formData.isLocked ? "Load is locked for invoicing" : undefined
                }
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="elfLoadStatus"
                className="text-[11px] font-bold text-slate-500 uppercase"
              >
                Load Status <span className="text-red-400">*</span>
              </label>
              <select
                id="elfLoadStatus"
                className={`w-full bg-[#0a0f18] border rounded-lg p-2.5 text-xs font-bold uppercase transition-all ${formData.status === LOAD_STATUS.Active ? "border-blue-500 text-blue-400" : "border-slate-800 text-white"}`}
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as any })
                }
                disabled={formData.isLocked}
                title={
                  formData.isLocked ? "Load is locked for invoicing" : undefined
                }
              >
                {Object.entries(LOAD_STATUS).map(([key, val]) => (
                  <option key={key} value={val}>
                    {key.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="elfEquipment"
                className="text-[11px] font-bold text-slate-500 uppercase"
              >
                Equipment
              </label>
              <select
                id="elfEquipment"
                className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg p-2.5 text-xs text-white uppercase"
                value={formData.freightType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    freightType: e.target.value as any,
                  })
                }
                disabled={formData.isLocked}
                title={
                  formData.isLocked ? "Load is locked for invoicing" : undefined
                }
              >
                <option value="Dry Van">DRY VAN 53'</option>
                <option value="Reefer">REEFER 53'</option>
                <option value="Flatbed">FLATBED</option>
                <option value="Intermodal">INTERMODAL</option>
              </select>
            </div>
          </div>

          {/* Column 2: Customer & Dispatcher */}
          <div className="space-y-4 bg-slate-900/30 p-6 rounded-2xl border border-slate-800/50">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <MapPin className="w-4 h-4 text-purple-500" /> Relationships
            </h2>
            <div className="space-y-1">
              <label
                htmlFor="elfCustomerBroker"
                className="text-[11px] font-bold text-slate-500 uppercase"
              >
                Customer / Broker <span className="text-red-500">*</span>
              </label>
              <select
                id="elfCustomerBroker"
                className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg p-2.5 text-xs text-white uppercase"
                value={formData.brokerId}
                onChange={(e) =>
                  setFormData({ ...formData, brokerId: e.target.value })
                }
                disabled={formData.isLocked}
                title={
                  formData.isLocked ? "Load is locked for invoicing" : undefined
                }
              >
                <option value="">-- SELECT CUSTOMER --</option>
                {brokers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  htmlFor="elfDispatcher"
                  className="text-[11px] font-bold text-slate-500 uppercase"
                >
                  Dispatcher
                </label>
                <select
                  id="elfDispatcher"
                  className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg p-2.5 text-xs text-white uppercase"
                  value={formData.dispatcherId}
                  onChange={(e) =>
                    setFormData({ ...formData, dispatcherId: e.target.value })
                  }
                  disabled={formData.isLocked}
                  title={
                    formData.isLocked
                      ? "Load is locked for invoicing"
                      : undefined
                  }
                >
                  <option value="">-- UNASSIGNED --</option>
                  {users
                    .filter((u) => u.role !== "driver")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-1">
                <label
                  htmlFor="elfSalesman"
                  className="text-[11px] font-bold text-slate-500 uppercase"
                >
                  Salesman
                </label>
                <input
                  id="elfSalesman"
                  className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg p-2.5 text-xs text-white uppercase"
                  placeholder="Enter Sales Rep"
                  disabled={formData.isLocked}
                  title={
                    formData.isLocked
                      ? "Load is locked for invoicing"
                      : undefined
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="elfDispatchNotesInternal"
                className="text-[11px] font-bold text-slate-500 uppercase"
              >
                Dispatch Notes (Internal)
              </label>
              <textarea
                id="elfDispatchNotesInternal"
                className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg p-2.5 text-xs text-white h-12"
                value={formData.dispatchNotes}
                onChange={(e) =>
                  setFormData({ ...formData, dispatchNotes: e.target.value })
                }
                disabled={formData.isLocked}
                title={
                  formData.isLocked ? "Load is locked for invoicing" : undefined
                }
              />
            </div>
          </div>

          {/* Column 3: Financial Synthesis */}
          <div
            ref={settlementRef}
            className="space-y-4 bg-slate-900/30 p-6 rounded-2xl border border-slate-800/50"
          >
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" /> Settlement
              Deepening
            </h2>
            <div className="space-y-1">
              <label
                htmlFor="elfGrossPayRevenue"
                className="text-[11px] font-bold text-slate-500 uppercase"
              >
                Gross Pay (Revenue)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                <input
                  id="elfGrossPayRevenue"
                  className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white font-mono font-bold"
                  type="number"
                  value={formData.carrierRate}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      carrierRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={formData.isLocked}
                  title={
                    formData.isLocked
                      ? "Load is locked for invoicing"
                      : undefined
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <label
                htmlFor="elfCarrierPayExp"
                className="text-[11px] font-bold text-slate-500 uppercase"
              >
                Carrier Pay (Exp)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-600" />
                <input
                  id="elfCarrierPayExp"
                  className="w-full bg-[#0a0f18] border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-sm text-white font-mono font-bold"
                  type="number"
                  value={formData.driverPay}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      driverPay: parseFloat(e.target.value) || 0,
                    })
                  }
                  disabled={formData.isLocked}
                  title={
                    formData.isLocked
                      ? "Load is locked for invoicing"
                      : undefined
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a0f18] border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] font-black text-slate-600 uppercase">
                  Profit Margin
                </div>
                <div
                  className={`text-sm font-bold mt-1 ${margins.margin >= 0 ? "text-green-500" : "text-red-500"}`}
                >
                  ${margins.margin.toLocaleString()}
                </div>
              </div>
              <div className="bg-[#0a0f18] border border-slate-800 rounded-xl p-3">
                <div className="text-[10px] font-black text-slate-600 uppercase">
                  Margin %
                </div>
                <div
                  className={`text-sm font-bold mt-1 ${margins.percentage >= 15 ? "text-blue-500" : "text-slate-400"}`}
                >
                  {margins.percentage.toFixed(1)}%
                </div>
              </div>
            </div>
            {/* Rate Card (toggled from Carrier Rates utility) */}
            {showRateCard && (
              <div className="bg-[#0a0f18] border border-blue-500/20 rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-black text-blue-400 uppercase tracking-widest">
                  Rate Card Summary
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <span className="text-slate-500 font-bold">
                      Carrier Rate:
                    </span>{" "}
                    <span className="text-white font-mono">
                      ${(formData.carrierRate || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold">
                      Driver Pay:
                    </span>{" "}
                    <span className="text-white font-mono">
                      ${(formData.driverPay || 0).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold">
                      Net Margin:
                    </span>{" "}
                    <span
                      className={`font-mono font-bold ${margins.margin >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      ${margins.margin.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold">Margin %:</span>{" "}
                    <span
                      className={`font-mono font-bold ${margins.percentage >= 15 ? "text-blue-400" : "text-slate-400"}`}
                    >
                      {margins.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Driver Info Sub-Header Bar (Matches Driver Row in Dr. Dispatch) */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex items-center justify-between gap-6 overflow-x-auto no-scrollbar">
          <div className="space-y-1 shrink-0">
            <label
              htmlFor="elfTruck"
              className="text-[10px] font-black text-slate-600 uppercase"
            >
              Truck #
            </label>
            <input
              id="elfTruck"
              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white"
              value={formData.truckNumber}
              onChange={(e) =>
                setFormData({ ...formData, truckNumber: e.target.value })
              }
              placeholder="UNIT-"
              disabled={formData.isLocked}
              title={
                formData.isLocked ? "Load is locked for invoicing" : undefined
              }
            />
          </div>
          <div className="space-y-1 shrink-0">
            <label
              htmlFor="elfTrailer"
              className="text-[10px] font-black text-slate-600 uppercase"
            >
              Trailer #
            </label>
            <input
              id="elfTrailer"
              className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white"
              value={formData.trailerNumber}
              onChange={(e) =>
                setFormData({ ...formData, trailerNumber: e.target.value })
              }
              placeholder="TRL-"
              disabled={formData.isLocked}
              title={
                formData.isLocked ? "Load is locked for invoicing" : undefined
              }
            />
          </div>
          <div className="space-y-1 shrink-0">
            <label
              htmlFor="elfChassis"
              className="text-[10px] font-black text-slate-600 uppercase"
            >
              Chassis
            </label>
            <input
              id="elfChassis"
              className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white"
              value={formData.chassisNumber}
              onChange={(e) =>
                setFormData({ ...formData, chassisNumber: e.target.value })
              }
              disabled={formData.isLocked}
              title={
                formData.isLocked ? "Load is locked for invoicing" : undefined
              }
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[150px]">
            <label
              htmlFor="elfAssignedDriver"
              className="text-[10px] font-black text-slate-600 uppercase"
            >
              Assigned Driver
            </label>
            <select
              id="elfAssignedDriver"
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white"
              value={formData.driverId}
              onChange={(e) =>
                setFormData({ ...formData, driverId: e.target.value })
              }
              disabled={formData.isLocked}
              title={
                formData.isLocked ? "Load is locked for invoicing" : undefined
              }
            >
              <option value="">Assign Member...</option>
              {users
                .filter(
                  (u) => u.role === "driver" || u.role === "owner_operator",
                )
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1 shrink-0">
            <label className="text-[10px] font-black text-slate-600 uppercase">
              Contact Cell
            </label>
            <button
              onClick={() => onOpenHub?.("feed", true)}
              className="flex items-center gap-2 group cursor-pointer text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Headset className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold">Log Call</span>
            </button>
          </div>
        </div>

        {/* Load Stops Execution Table */}
        <div ref={stopMatrixRef} className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-500" /> Stop Matrix
              (Sequential) <span className="text-red-400">*</span>
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => addLeg("Pickup")}
                className="px-3 py-1 bg-slate-800 border border-slate-700 text-[11px] font-black uppercase rounded text-slate-400 hover:text-white transition-all"
              >
                + Add Pickup
              </button>
              <button
                onClick={() => addLeg("Dropoff")}
                className="px-3 py-1 bg-blue-600 text-[11px] font-black uppercase rounded text-white"
              >
                + Add Drop
              </button>
            </div>
          </div>

          <div className="bg-[#0a0f18] border border-slate-800 rounded-xl overflow-hidden shadow-inner">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    Facility / Address
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    City / ST / Zip
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    Seal #
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    Pallets
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    Weight
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase">
                    Date/Time
                  </th>
                  <th className="px-4 py-1"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {formData.legs?.map((leg, idx) => (
                  <tr
                    key={leg.id}
                    className="hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${leg.type === "Pickup" ? "bg-green-600/10 text-green-500" : "bg-blue-600/10 text-blue-500"}`}
                      >
                        {leg.type.charAt(0)}
                      </span>
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <input
                        aria-label="Facility Name"
                        className="w-full bg-transparent border-none p-0 text-[10px] text-white font-bold focus:ring-0 placeholder:text-slate-500"
                        placeholder="Facility Name"
                        value={leg.location.facilityName}
                        onChange={(e) =>
                          handleUpdateLeg(idx, {
                            location: {
                              ...leg.location,
                              facilityName: e.target.value,
                            },
                          })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                      <input
                        aria-label="123 Street Ave"
                        className="w-full bg-transparent border-none p-0 text-[11px] text-slate-500 focus:ring-0 placeholder:text-slate-800"
                        placeholder="123 Street Ave"
                        value={leg.location.address}
                        onChange={(e) =>
                          handleUpdateLeg(idx, {
                            location: {
                              ...leg.location,
                              address: e.target.value,
                            },
                          })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 flex items-center gap-1">
                      <input
                        aria-label="City"
                        className="w-20 bg-transparent border-none p-0 text-[10px] text-white focus:ring-0"
                        placeholder="City"
                        value={leg.location.city}
                        onChange={(e) =>
                          handleUpdateLeg(idx, {
                            location: { ...leg.location, city: e.target.value },
                          })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                      <input
                        aria-label="ST"
                        className="w-8 bg-transparent border-none p-0 text-[10px] text-slate-500 focus:ring-0 text-center"
                        placeholder="ST"
                        value={leg.location.state}
                        onChange={(e) =>
                          handleUpdateLeg(idx, {
                            location: {
                              ...leg.location,
                              state: e.target.value.toUpperCase(),
                            },
                          })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        aria-label="SEAL-"
                        className="w-16 bg-transparent border-none p-0 text-[10px] text-blue-400 font-mono focus:ring-0"
                        placeholder="SEAL-"
                        value={leg.sealNumber}
                        onChange={(e) =>
                          handleUpdateLeg(idx, { sealNumber: e.target.value })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        aria-label="Pallet count"
                        className="w-10 bg-transparent border-none p-0 text-[10px] text-white focus:ring-0 text-center"
                        type="number"
                        value={leg.pallets}
                        onChange={(e) =>
                          handleUpdateLeg(idx, {
                            pallets: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        aria-label="Weight"
                        className="w-16 bg-transparent border-none p-0 text-[10px] text-white focus:ring-0 text-center"
                        type="number"
                        value={leg.weight}
                        onChange={(e) =>
                          handleUpdateLeg(idx, {
                            weight: parseInt(e.target.value) || 0,
                          })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3 space-y-1">
                      <input
                        aria-label="Leg date"
                        className="w-24 bg-transparent border-none p-0 text-[10px] text-white focus:ring-0"
                        type="date"
                        value={leg.date}
                        onChange={(e) =>
                          handleUpdateLeg(idx, { date: e.target.value })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                      <input
                        aria-label="Appointment time"
                        className="w-24 bg-transparent border-none p-0 text-[11px] text-slate-500 focus:ring-0"
                        type="time"
                        value={leg.appointmentTime}
                        onChange={(e) =>
                          handleUpdateLeg(idx, {
                            appointmentTime: e.target.value,
                          })
                        }
                        disabled={formData.isLocked}
                        title={
                          formData.isLocked
                            ? "Load is locked for invoicing"
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      {!formData.isLocked && (
                        <button
                          onClick={() => removeLeg(leg.id)}
                          className="text-slate-600 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!formData.legs || formData.legs.length === 0) && (
              <div className="p-8 text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest italic">
                No stops defined. Use buttons above to sequence.
              </div>
            )}
          </div>
        </div>

        {/* Documents Integration Matrix */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" /> Digital Artifacts
            Matrix
          </h2>
          <div className="bg-[#0a0f18] border border-slate-800 rounded-xl p-8 text-center border-dashed group cursor-pointer hover:border-blue-500 transition-all">
            <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6 text-slate-600" />
            </div>
            <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] group-hover:text-blue-500">
              Inject Electronic Records
            </div>
            <p className="text-[10px] text-slate-500 uppercase mt-2">
              BOL, POD, RATE CON, HAZMAT DOCUMENTS
            </p>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="px-6 py-2 bg-red-500/10 border-t border-red-500/20">
          {validationErrors.map((err, i) => (
            <div
              key={i}
              className="text-[10px] text-red-400 font-bold flex items-center gap-2"
            >
              <AlertTriangle className="w-3 h-3" /> {err}
            </div>
          ))}
        </div>
      )}

      {/* Footer Actions */}
      <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end gap-4 shrink-0 shadow-inner">
        <button
          onClick={onCancel}
          className="px-6 py-3 text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest"
        >
          Discard
        </button>
        <button
          disabled={formData.isLocked || isSubmitting}
          title={
            formData.isLocked
              ? "This load is locked for invoicing. Unlock to make changes."
              : undefined
          }
          onClick={handleSave}
          className="px-12 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
        >
          {isSubmitting
            ? "Saving..."
            : formData.id
              ? "Save Changes"
              : "Initialize Dispatch"}
        </button>
      </div>
    </div>
  );
};
