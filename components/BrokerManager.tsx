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
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { Broker, Contract, ApprovedChassis } from "../types";
import {
  getBrokers,
  saveBroker,
  getContracts,
  saveContract,
} from "../services/brokerService";

interface Props {
  brokers?: Broker[];
  onUpdate?: () => void;
  onSave?: (broker: Broker) => void;
  onAddLoad?: (brokerId: string) => void;
}

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
}) => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingBroker, setEditingBroker] = useState<Partial<Broker> | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<"My" | "All">("My");

  // New State for Chassis Form
  const [chassisForm, setChassisForm] = useState<Partial<ApprovedChassis>>({
    provider: "",
    type: CHASSIS_TYPES[0],
    prefixes: [],
  });
  const [prefixInput, setPrefixInput] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const b = await getBrokers();
    setBrokers(b);
  };

  const filteredBrokers = useMemo(() => {
    let list = brokers || [];
    return list.filter(
      (b) =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.mcNumber?.includes(searchTerm),
    );
  }, [brokers, searchTerm]);

  const handleSave = async (broker: Broker) => {
    await saveBroker(broker);
    loadData();
    if (onSave) onSave(broker);
    setShowForm(false);
  };

  const handleAddChassis = () => {
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
      {/* Header - High Density Version */}
      <div className="bg-[#0a0f1e]/80 backdrop-blur-md border-b border-white/5 px-8 py-6 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-widest uppercase">
                Partner Network
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Commercial Entity & Managed Registry
              </p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button className="bg-slate-900/50 border border-slate-800 text-slate-400 p-2.5 rounded-xl hover:text-white hover:border-slate-700 transition-all active:scale-95">
              <Scan className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setEditingBroker({
                  id: uuidv4(),
                  name: "",
                  mcNumber: "",
                  clientType: "Broker",
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
      <div className="flex-1 overflow-y-auto p-8 pt-6 no-scrollbar grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
        {filteredBrokers.map((broker) => (
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
                  <Building2 className="w-6 h-6 text-slate-600 group-hover:text-blue-500 transition-colors" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white uppercase tracking-tight line-clamp-1">
                      {broker.name}
                    </h3>
                    <span
                      className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${broker.clientType === "Broker" ? "bg-blue-600/10 text-blue-500 border border-blue-500/20" : "bg-purple-600/10 text-purple-500 border border-purple-500/20"}`}
                    >
                      {broker.clientType}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1">
                      <Info className="w-3 h-3" /> MC:{" "}
                      {broker.mcNumber || "N/A"}
                    </span>
                    <span className="flex items-center gap-1 text-blue-500/80">
                      <ShieldCheck className="w-3 h-3" /> Score:{" "}
                      {broker.safetyScore || 85}
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

              {broker.approvedChassis && broker.approvedChassis.length > 0 && (
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
        ))}
      </div>

      {/* High-Fidelity Add/Edit Form Modal (Matches Mockups) */}
      {showForm && editingBroker && (
        <div className="fixed inset-0 z-[100] bg-[#020617]/90 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0a0f1e] rounded-[2.5rem] border border-white/10 w-full max-w-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-10 py-8 border-b border-white/5 flex justify-between items-center bg-[#0d1428]/50">
              <div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  {editingBroker.name ? "Edit Client" : "Add New Client"}
                </h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">
                  Registry Entity Configuration
                </p>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800 transition-all border border-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body - Matching Image 1/2 */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 no-scrollbar">
              {/* Type & Visibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Client Type
                  </label>
                  <div className="relative">
                    <select
                      className="w-full bg-[#020617] border border-white/5 rounded-2xl px-5 py-4 text-sm text-white font-bold appearance-none outline-none focus:border-blue-500 transition-all"
                      value={editingBroker.clientType}
                      onChange={(e) =>
                        setEditingBroker({
                          ...editingBroker,
                          clientType: e.target.value as any,
                        })
                      }
                    >
                      <option value="Broker">Broker / 3PL</option>
                      <option value="Direct Customer">Direct Customer</option>
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Legal Entity Name *
                </label>
                <input
                  className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-700 outline-none focus:border-blue-500 transition-all"
                  placeholder="ENTER FULL REGISTERED COMPANY NAME"
                  value={editingBroker.name}
                  onChange={(e) =>
                    setEditingBroker({ ...editingBroker, name: e.target.value })
                  }
                />
              </div>

              {/* MC & DOT Numbers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    MC Number
                  </label>
                  <input
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-800 outline-none focus:border-blue-500 transition-all"
                    placeholder="e.g. MC123456"
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    DOT Number
                  </label>
                  <input
                    className="w-full bg-[#020617] border border-white/5 rounded-2xl px-6 py-4 text-sm text-white font-bold placeholder:text-slate-800 outline-none focus:border-blue-500 transition-all"
                    placeholder="e.g. 1928374"
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Primary Email
                  </label>
                  <input
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
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Central Phone
                  </label>
                  <input
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
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Mailing Address / City / State
                </label>
                <input
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

              {/* Approved Chassis List Section - High Fidelity Version */}
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
                    </div>
                    <div className="relative">
                      <select
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
                className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.2rem] text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-blue-900/20 transition-all active:scale-95"
              >
                Save Entity Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
