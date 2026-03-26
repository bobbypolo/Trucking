import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  Edit2,
  Trash2,
  MoreVertical,
  Users,
  Check,
  X,
  Info,
  ShieldCheck,
  ArrowRight,
  Scan,
  MapPin,
  Globe,
  ShieldAlert,
  AlertTriangle,
  Truck,
  Zap,
  Tag,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Broker, Contract, ApprovedChassis } from "../types";
import {
  getBrokers,
  saveBroker,
  getContracts,
  saveContract,
} from "../services/brokerService";
import { Toast } from "./Toast";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  brokers?: Broker[];
  onUpdate?: () => void;
  onSave?: (broker: Broker) => void;
  onAddLoad?: (brokerId: string) => void;
  /** When provided, restricts the view to a specific entity class */
  entityClassFilter?: string;
}

/** Unified entity classes supported by the onboarding system */
type EntityClass = "Customer" | "Broker" | "Vendor" | "Facility" | "Contractor";

const ENTITY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "Broker", label: "Broker / 3PL" },
  { value: "Customer", label: "Customer" },
  { value: "Vendor", label: "Vendor" },
  { value: "Facility", label: "Facility" },
  { value: "Contractor", label: "Contractor" },
];

/** Maps legacy clientType values to unified entity classes */
const mapToEntityClass = (clientType?: string): EntityClass => {
  if (!clientType) return "Broker";
  if (clientType === "Direct Customer" || clientType === "Shipper")
    return "Customer";
  if (
    clientType === "Vendor_Service" ||
    clientType === "Vendor_Equipment" ||
    clientType === "Vendor_Product"
  )
    return "Vendor";
  if (clientType === "Carrier") return "Contractor";
  const valid: EntityClass[] = [
    "Customer",
    "Broker",
    "Vendor",
    "Facility",
    "Contractor",
  ];
  if (valid.includes(clientType as EntityClass))
    return clientType as EntityClass;
  return "Broker";
};

const ENTITY_ICONS: Record<EntityClass, React.ElementType> = {
  Customer: Globe,
  Broker: Building2,
  Vendor: Zap,
  Facility: MapPin,
  Contractor: Truck,
};

const CHASSIS_TYPES = [
  "40' Gooseneck",
  "20' Slider",
  "45' Extendable",
  "53' Domestic",
  "Tri-Axle",
  "40' Lightweight",
];

export const BrokerManager: React.FC<Props> = ({
  onUpdate,
  onSave,
  onAddLoad,
  entityClassFilter,
}) => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Partial<Broker> | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"My" | "All">("My");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);

  // New State for Chassis Form
  const [chassisForm, setChassisForm] = useState<Partial<ApprovedChassis>>({
    provider: "",
    type: CHASSIS_TYPES[0],
    prefixes: [],
  });
  const [prefixInput, setPrefixInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const b = await getBrokers();
      setBrokers(b);
    } catch (err) {
      console.error("[BrokerManager] Failed to load entities:", err);
      setLoadError("Failed to load entity data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredBrokers = useMemo(() => {
    let list = brokers || [];
    // Apply entity class filter if provided
    if (entityClassFilter) {
      list = list.filter(
        (b) => mapToEntityClass(b.clientType) === entityClassFilter,
      );
    }
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.mcNumber?.includes(searchTerm),
    );
  }, [brokers, searchTerm, entityClassFilter]);

  const validateBrokerForm = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!editingBroker?.name?.trim()) errs.name = "Entity name is required";
    return errs;
  };

  const isBrokerFormValid = !!editingBroker?.name?.trim();

  const handleSave = async (broker: Broker) => {
    const errs = validateBrokerForm();
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});
    setIsSubmitting(true);
    try {
      await saveBroker(broker);
      loadData();
      if (onSave) onSave(broker);
      setShowForm(false);
      setToast({
        message: "Entity profile saved successfully.",
        type: "success",
      });
    } catch (err) {
      console.error("[BrokerManager] Save failed:", err);
      setToast({
        message: "Failed to save entity. Please try again.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [chassisErrors, setChassisErrors] = useState<Record<string, string>>(
    {},
  );

  const handleAddChassis = () => {
    const errs: Record<string, string> = {};
    if (!chassisForm.provider?.trim()) errs.provider = "Provider is required";
    if (prefixInput.trim() && !/^[a-zA-Z0-9,\s]+$/.test(prefixInput)) {
      errs.prefixes = "Prefixes must be alphanumeric";
    }
    if (Object.keys(errs).length > 0) {
      setChassisErrors(errs);
      return;
    }
    setChassisErrors({});
    if (!chassisForm.provider) return;

    const newChassis: ApprovedChassis = {
      id: uuidv4(),
      provider: chassisForm.provider,
      type: chassisForm.type || CHASSIS_TYPES[0],
      prefixes: prefixInput
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    };

    setEditingBroker((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        approvedChassis: [...(prev.approvedChassis || []), newChassis],
      };
    });

    // Reset chassis form
    setChassisForm({ provider: "", type: CHASSIS_TYPES[0], prefixes: [] });
    setPrefixInput("");
  };

  const handleRemoveChassis = (id: string) => {
    setEditingBroker((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        approvedChassis: (prev.approvedChassis || []).filter(
          (c) => c.id !== id,
        ),
      };
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100 font-inter">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      {/* Header */}
      <div className="bg-[#0a0f1e]/80 backdrop-blur-md border-b border-white/5 px-8 py-6 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase">
                {entityClassFilter
                  ? `${entityClassFilter} Entities`
                  : "Entity Registry"}
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Unified Entity Management
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button
              className="bg-slate-900/50 border border-slate-800 text-slate-400 p-2.5 rounded-xl hover:text-white hover:border-slate-700 transition-all active:scale-95"
              aria-label="Scan entities"
            >
              <Scan className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEditingBroker({
                  id: uuidv4(),
                  name: "",
                  mcNumber: "",
                  clientType: (entityClassFilter || "Broker") as
                    | "Broker"
                    | "Direct Customer",
                  isShared: true,
                  approvedChassis: [],
                });
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
            >
              <Plus className="w-4 h-4" /> Add Entity
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
            <input
              aria-label="Search by entity name, MC#, or contact"
              className="w-full bg-[#020617] border border-slate-800/50 rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none transition-all"
              placeholder="SEARCH BY ENTITY NAME, MC#, OR CONTACT..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800/50">
            <button
              onClick={() => setActiveTab("My")}
              className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "My" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
            >
              My Accounts
            </button>
            <button
              onClick={() => setActiveTab("All")}
              className={`px-6 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "All" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
            >
              Organization
            </button>
          </div>
        </div>
      </div>

      {/* Entity Grid */}
      <div className="flex-1 overflow-y-auto p-8 pt-6 no-scrollbar">
        {isLoading && (
          <div className="py-8">
            <LoadingSkeleton variant="card" count={6} />
          </div>
        )}
        {!isLoading && loadError && (
          <ErrorState message={loadError} onRetry={loadData} />
        )}
        {!isLoading && !loadError && filteredBrokers.length === 0 && (
          <EmptyState
            icon={<Building2 className="w-12 h-12" />}
            title="No entities found"
            description="Add your first entity to build your network."
          />
        )}
        {!isLoading && !loadError && filteredBrokers.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
            {filteredBrokers.map((broker) => {
              const ec = mapToEntityClass(broker.clientType);
              const EntityIcon = ENTITY_ICONS[ec] || Building2;
              return (
                <div
                  key={broker.id}
                  className="bg-[#0a0f1e]/40 border border-white/5 rounded-2xl p-6 transition-all hover:bg-[#0a0f1e]/60 hover:border-blue-500/30 group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onAddLoad && onAddLoad(broker.id)}
                        className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors shadow-lg"
                        title="Create Load"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingBroker(broker);
                          setShowForm(true);
                        }}
                        className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors border border-white/5 shadow-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center border border-white/5">
                        <EntityIcon className="w-6 h-6 text-slate-600 group-hover:text-blue-500 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-white uppercase tracking-tight line-clamp-1">
                            {broker.name}
                          </h3>
                          <span
                            className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                              ec === "Broker"
                                ? "bg-blue-600/10 text-blue-500 border border-blue-500/20"
                                : ec === "Customer"
                                  ? "bg-purple-600/10 text-purple-500 border border-purple-500/20"
                                  : ec === "Vendor"
                                    ? "bg-orange-600/10 text-orange-500 border border-orange-500/20"
                                    : ec === "Contractor"
                                      ? "bg-teal-600/10 text-teal-500 border border-teal-500/20"
                                      : "bg-slate-600/10 text-slate-500 border border-slate-500/20"
                            }`}
                          >
                            {ec}
                          </span>
                        </div>
                        <div className="flex gap-3 text-[10px] font-bold text-slate-500">
                          <span className="flex items-center gap-1">
                            <Info className="w-3 h-3" /> MC:{" "}
                            {broker.mcNumber || "N/A"}
                          </span>
                          <span className="flex items-center gap-1 text-blue-500/80">
                            <ShieldCheck className="w-3 h-3" /> Score:{" "}
                            {broker.safetyScore ?? "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">
                            {broker.email || "CONTACT PENDING"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                          <Phone className="w-3 h-3" />
                          <span>{broker.phone || "NO RECORD"}</span>
                        </div>
                      </div>
                      <div className="flex items-end justify-end">
                        <div className="flex -space-x-2">
                          {[1, 2].map((i) => (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[8px] font-bold text-slate-600"
                            >
                              U{i}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {broker.approvedChassis &&
                      broker.approvedChassis.length > 0 && (
                        <div className="pt-3 flex flex-wrap gap-2">
                          {broker.approvedChassis.slice(0, 2).map((c, idx) => (
                            <span
                              key={idx}
                              className="bg-slate-950 text-[8px] font-black px-2 py-1 rounded-md border border-white/5 uppercase text-slate-400"
                            >
                              {c.provider} {c.type}
                            </span>
                          ))}
                          {broker.approvedChassis.length > 2 && (
                            <span className="text-[8px] font-black text-blue-500 self-center">
                              +{broker.approvedChassis.length - 2} MORE
                            </span>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && editingBroker && (
        <div className="fixed inset-0 z-[100] bg-[#020617]/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0a0f1e] rounded-[2.5rem] border border-white/10 w-full max-w-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-10 py-8 border-b border-white/5 flex justify-between items-center bg-[#0d1428]/50">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {editingBroker.name ? "Edit Entity" : "Add New Entity"}
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">
                  Entity Configuration
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-all border border-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
              {/* Entity Class & Visibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label
                    htmlFor="bmClientType"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
                    Entity Class
                  </label>
                  <div className="relative">
                    <select
                      id="bmClientType"
                      className="w-full bg-[#020617] border border-white/5 rounded-2xl px-5 py-4 text-sm text-white font-bold appearance-none outline-none focus:border-blue-500 transition-all"
                      value={editingBroker.clientType}
                      onChange={(e) =>
                        setEditingBroker({
                          ...editingBroker,
                          clientType: e.target.value as any,
                        })
                      }
                    >
                      {ENTITY_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <MoreVertical className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none rotate-90" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Visibility
                  </label>
                  <div
                    onClick={() =>
                      setEditingBroker({
                        ...editingBroker,
                        isShared: !editingBroker.isShared,
                      })
                    }
                    className="flex items-center gap-4 bg-[#020617] border border-white/5 rounded-2xl px-5 py-3 cursor-pointer hover:border-blue-500/30 transition-all group"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${editingBroker.isShared ? "bg-blue-600 border-blue-500" : "bg-slate-900 border-slate-700 group-hover:border-slate-500"}`}
                    >
                      {editingBroker.isShared && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                    <span className="text-sm font-bold text-slate-400 group-hover:text-slate-200">
                      {editingBroker.isShared
                        ? "Shared (Team)"
                        : "Private (Me)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Name Input */}
              <div className="space-y-3">
                <label
                  htmlFor="bmLegalEntityName"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Legal Entity Name *
                </label>
                <input
                  id="bmLegalEntityName"
                  className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-700 outline-none focus:border-blue-500 transition-all"
                  placeholder="ENTER FULL REGISTERED COMPANY NAME"
                  value={editingBroker.name}
                  onChange={(e) =>
                    setEditingBroker({ ...editingBroker, name: e.target.value })
                  }
                />
                {formErrors.name && (
                  <p className="text-red-400 text-xs mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* MC & DOT Numbers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label
                    htmlFor="bmMcNumber"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
                    MC Number
                  </label>
                  <input
                    id="bmMcNumber"
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-800 outline-none focus:border-blue-500 transition-all"
                    placeholder="e.g., MC-123456"
                    value={editingBroker.mcNumber}
                    onChange={(e) =>
                      setEditingBroker({
                        ...editingBroker,
                        mcNumber: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-3">
                  <label
                    htmlFor="bmDotNumber"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
                    DOT Number
                  </label>
                  <input
                    id="bmDotNumber"
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-800 outline-none focus:border-blue-500 transition-all"
                    placeholder="e.g., 1234567"
                    value={editingBroker.dotNumber}
                    onChange={(e) =>
                      setEditingBroker({
                        ...editingBroker,
                        dotNumber: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label
                    htmlFor="bmPrimaryEmail"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
                    Primary Email
                  </label>
                  <input
                    id="bmPrimaryEmail"
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-800 outline-none focus:border-blue-500 transition-all"
                    placeholder="dispatch@client.com"
                    value={editingBroker.email}
                    onChange={(e) =>
                      setEditingBroker({
                        ...editingBroker,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-3">
                  <label
                    htmlFor="bmCentralPhone"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
                    Central Phone
                  </label>
                  <input
                    id="bmCentralPhone"
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-800 outline-none focus:border-blue-500 transition-all"
                    placeholder="(555) 000-0000"
                    value={editingBroker.phone}
                    onChange={(e) =>
                      setEditingBroker({
                        ...editingBroker,
                        phone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-3">
                <label
                  htmlFor="bmMailingAddressCityState"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Mailing Address / City / State
                </label>
                <input
                  id="bmMailingAddressCityState"
                  className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-800 outline-none focus:border-blue-500 transition-all"
                  placeholder="e.g. 123 Main St, Dallas, TX"
                  value={editingBroker.address}
                  onChange={(e) =>
                    setEditingBroker({
                      ...editingBroker,
                      address: e.target.value,
                    })
                  }
                />
              </div>

              {/* Approved Chassis Section (shown for Broker entities) */}
              {(mapToEntityClass(editingBroker.clientType) === "Broker" ||
                mapToEntityClass(editingBroker.clientType) === "Customer") && (
                <div className="space-y-6 pt-6 border-t border-white/5">
                  <h4 className="text-[10px] font-black text-white flex items-center gap-3 uppercase tracking-widest">
                    <div className="w-7 h-7 bg-blue-600/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                      <ShieldCheck className="w-4 h-4 text-blue-500" />
                    </div>
                    Approved Chassis Requirements
                  </h4>

                  <div className="bg-[#020617] border border-white/5 rounded-2xl p-6 space-y-4 shadow-inner">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <input
                          aria-label="Chassis provider"
                          className="w-full bg-[#0a0f1e] border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder:text-slate-700 outline-none focus:border-blue-500 transition-all font-bold"
                          placeholder="PROVIDER (e.g. TRAC, FLEXI)"
                          value={chassisForm.provider}
                          onChange={(e) =>
                            setChassisForm({
                              ...chassisForm,
                              provider: e.target.value,
                            })
                          }
                        />
                        {chassisErrors.provider && (
                          <p className="text-red-400 text-xs mt-1">
                            {chassisErrors.provider}
                          </p>
                        )}
                      </div>
                      <div className="relative">
                        <select
                          aria-label="Chassis type"
                          className="w-full bg-[#0a0f1e] border border-white/5 rounded-xl px-4 py-3 text-xs text-white font-black uppercase appearance-none outline-none focus:border-blue-500 transition-all"
                          value={chassisForm.type}
                          onChange={(e) =>
                            setChassisForm({
                              ...chassisForm,
                              type: e.target.value,
                            })
                          }
                        >
                          {CHASSIS_TYPES.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                        <MoreVertical className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 rotate-90" />
                      </div>
                    </div>

                    <input
                      aria-label="Chassis prefixes, comma separated"
                      className="w-full bg-[#0a0f1e] border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder:text-slate-700 outline-none focus:border-blue-500 transition-all font-bold"
                      placeholder="PREFIXES (e.g. TRAC, TXZZ, TRLU) - COMMA SEPARATED"
                      value={prefixInput}
                      onChange={(e) => setPrefixInput(e.target.value)}
                    />

                    <button
                      onClick={handleAddChassis}
                      className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] border border-white/5 transition-all active:scale-[0.98]"
                    >
                      Add to Approved List
                    </button>
                  </div>

                  {/* Active Chassis Rules List */}
                  <div className="space-y-3">
                    {!editingBroker.approvedChassis ||
                    editingBroker.approvedChassis.length === 0 ? (
                      <p className="text-[10px] text-slate-600 font-bold italic text-center p-4 bg-slate-950/30 rounded-xl border border-dashed border-white/5">
                        No chassis rules defined for this entity.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {editingBroker.approvedChassis.map((rule) => (
                          <div
                            key={rule.id}
                            className="bg-slate-950 p-4 rounded-xl border border-white/5 flex justify-between items-start group"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                  {rule.provider}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">
                                  •
                                </span>
                                <span className="text-[10px] font-bold text-slate-200">
                                  {rule.type}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {rule.prefixes.map((px, i) => (
                                  <span
                                    key={i}
                                    className="bg-blue-600/10 text-blue-400 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-600/20"
                                  >
                                    {px}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveChassis(rule.id)}
                              className="text-slate-700 hover:text-red-500 p-1 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Section */}
            <div className="px-10 py-8 bg-[#0d1428]/50 border-t border-white/5 flex justify-between items-center">
              <button
                onClick={() => setShowForm(false)}
                className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
              >
                Cancel Changes
              </button>
              <button
                onClick={() => handleSave(editingBroker as Broker)}
                disabled={isSubmitting || !isBrokerFormValid}
                className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Save Entity Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
