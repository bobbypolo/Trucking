import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Plus,
  Building2,
  ShieldCheck,
  CreditCard,
  Activity,
  FileText,
  Search,
  Filter,
  ChevronRight,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  ArrowRight,
  X,
  UserPlus,
  Zap,
  Truck,
  Database,
  Table,
  Settings,
  Calendar,
  HardDrive,
  List,
  DollarSign,
  Briefcase,
  Ruler,
  Map,
  Layout,
  Trash2,
  Info,
  Layers,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import {
  NetworkParty,
  PartyType,
  OnboardingStatus,
  PartyContact,
  RateRow,
  ConstraintSet,
  CatalogItem,
  CatalogCategory,
  CustomFieldDefinition,
  CustomFieldValue,
  EquipmentAsset,
} from "../types";
import { getParties, saveParty } from "../services/networkService";
import { Toast } from "./Toast";

interface Props {
  companyId: string;
  onNavigateToLoad?: (partyId: string) => void;
}

export const NetworkPortal: React.FC<Props> = ({
  companyId,
  onNavigateToLoad,
}) => {
  const [parties, setParties] = useState<NetworkParty[]>([]);
  const [view, setView] = useState<"dashboard" | "wizard" | "profile">(
    "dashboard",
  );
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);
  const [selectedParty, setSelectedParty] = useState<NetworkParty | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<
    "IDENTITY" | "CONTACTS" | "RATES" | "CONSTRAINTS" | "DOCS" | "CATALOG"
  >("IDENTITY");

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<PartyType | "ALL">("ALL");
  const [activeModal, setActiveModal] = useState<
    "NONE" | "QUICK_VENDOR" | "QUICK_EQUIP"
  >("NONE");
  const [quickFormData, setQuickFormData] = useState<any>({});

  // Engine Data (Fetched once or mocked for MVP)
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>(
    [],
  );

  // Wizard State
  const [wizardStep, setWizardStep] = useState(1);
  const [formData, setFormData] = useState<Partial<NetworkParty>>({
    id: uuidv4(),
    type: "Shipper",
    status: "Draft",
    isCustomer: true,
    isVendor: false,
    contacts: [],
    documents: [],
    rates: [],
    constraintSets: [],
    catalogLinks: [],
  });

  const [equipmentAssets, setEquipmentAssets] = useState<EquipmentAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const data = await getParties(companyId);
    setParties(data);
  };

  const handleSave = async (dataToSave: Partial<NetworkParty>) => {
    setIsSubmitting(true);
    try {
      await saveParty({ ...dataToSave, company_id: companyId } as any);
      await loadData();
      setView("dashboard");
      setWizardStep(1);
      setToast({ message: "Party saved successfully.", type: "success" });
    } catch (e) {
      console.error("[NetworkPortal] Save party failed:", e);
      setToast({ message: "Failed to save party", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const addCatalogItem = () => {
    const newItem: CatalogItem = {
      id: uuidv4(),
      tenantId: "DEFAULT",
      itemName: "NEW CATALOG ITEM",
      itemCode: "NEW_CODE",
      categoryId: "SERVICE",
      kind: "Service",
      active: true,
    };
    setCatalogItems([...catalogItems, newItem]);
  };

  const filteredParties = useMemo(() => {
    return parties.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.mcNumber?.includes(searchQuery);
      const matchesType = filterType === "ALL" || p.type === filterType;
      return matchesSearch && matchesType;
    });
  }, [parties, searchQuery, filterType]);

  const stats = useMemo(() => {
    return {
      total: parties.length,
      active: parties.filter((p) => p.status === "Approved").length,
      onHold: parties.filter((p) => p.status === "On_Hold").length,
      inReview: parties.filter((p) => p.status === "In_Review").length,
    };
  }, [parties]);

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100 font-inter overflow-hidden">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      {/* GLOBAL HEADER */}
      <div className="bg-[#0a0f1e]/80 backdrop-blur-md border-b border-white/5 px-10 py-8 shrink-0">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-600 rounded-[1.25rem] flex items-center justify-center shadow-2xl shadow-blue-500/20">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-widest uppercase">
                Partner Network Registry
              </h1>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">
                Universal Onboarding & Relationship Matrix
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
              {(["total", "active", "onHold", "inReview"] as const).map(
                (key) => (
                  <div
                    key={key}
                    className="px-5 py-2 border-r last:border-0 border-white/5"
                  >
                    <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                      {key.replace(/([A-Z])/g, " $1")}
                    </div>
                    <div className="text-xl font-black text-white">
                      {(stats as any)[key]}
                    </div>
                  </div>
                ),
              )}
            </div>
            <button
              onClick={() => setView("wizard")}
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-blue-900/20"
            >
              <UserPlus className="w-4 h-4" /> Start Onboarding
            </button>
          </div>
        </div>

        <div className="flex gap-8 items-center">
          <div className="flex-1 relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-blue-500 transition-colors" />
            <input
              className="w-full bg-[#020617] border border-white/10 rounded-2xl pl-16 pr-6 py-4 text-[12px] text-white font-bold outline-none focus:border-blue-500/50 focus:ring-8 focus:ring-blue-500/5 transition-all placeholder:text-slate-800"
              placeholder="SEARCH BY PARTY NAME, MC#, DOT# OR CONTACT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2">
            {[
              "ALL",
              "Shipper",
              "Broker",
              "Vendor_Service",
              "Vendor_Equipment",
              "Facility",
            ].map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t as any)}
                className={`px-5 py-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${filterType === t ? "bg-blue-600 text-white border-blue-500 shadow-lg" : "bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/20"}`}
              >
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-10 no-scrollbar">
        {view === "dashboard" && (
          <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
            {filteredParties.map((party) => (
              <div
                key={party.id}
                onClick={() => {
                  setSelectedParty(party);
                  setView("profile");
                }}
                className="group bg-[#0a0f1e]/40 border border-white/5 rounded-[2.5rem] p-8 hover:bg-blue-600/[0.03] hover:border-blue-500/30 transition-all cursor-pointer relative overflow-hidden"
              >
                {/* Status Indicator */}
                <div
                  className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl text-[8px] font-black uppercase tracking-widest ${
                    party.status === "Approved"
                      ? "bg-green-500/10 text-green-500"
                      : party.status === "On_Hold"
                        ? "bg-red-500/10 text-red-500"
                        : party.status === "In_Review"
                          ? "bg-blue-500/10 text-blue-500"
                          : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {party.status.replace("_", " ")}
                </div>

                <div className="space-y-6">
                  <div className="flex items-start gap-5">
                    <div className="w-16 h-16 bg-slate-950 rounded-2xl flex items-center justify-center border border-white/5 group-hover:border-blue-500/20 transition-all">
                      {party.type === "Shipper" && (
                        <Globe className="w-8 h-8 text-blue-500" />
                      )}
                      {party.type === "Broker" && (
                        <Building2 className="w-8 h-8 text-purple-500" />
                      )}
                      {party.type === "Vendor_Service" && (
                        <Zap className="w-8 h-8 text-orange-500" />
                      )}
                      {party.type === "Vendor_Equipment" && (
                        <ShieldCheck className="w-8 h-8 text-teal-500" />
                      )}
                      {party.type === "Facility" && (
                        <MapPin className="w-8 h-8 text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight truncate mb-1">
                        {party.name}
                      </h3>
                      <div className="flex gap-4 items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase">
                          {party.type.replace("_", " ")}
                        </span>
                        <div className="h-1 w-1 rounded-full bg-slate-800" />
                        <span className="text-[10px] font-bold text-slate-600">
                          ID: {party.id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                      <div className="text-[8px] font-black text-slate-600 uppercase mb-2">
                        Compliance Rating
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs font-black text-white uppercase">
                          {party.rating || "N/A"} Score
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-950/50 rounded-2xl border border-white/5">
                      <div className="text-[8px] font-black text-slate-600 uppercase mb-2">
                        Billing Status
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-black text-white uppercase">
                          {party.billingProfile?.paymentTerms ||
                            "Terms Pending"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                    <div className="flex -space-x-3">
                      {party.contacts?.slice(0, 3).map((c, i) => (
                        <div
                          key={i}
                          className="w-8 h-8 rounded-full bg-slate-900 border-2 border-[#020617] flex items-center justify-center text-[10px] font-black text-slate-500"
                          title={c.name}
                        >
                          {c.name.charAt(0)}
                        </div>
                      ))}
                      {(party.contacts?.length || 0) > 3 && (
                        <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#020617] flex items-center justify-center text-[8px] font-black text-white">
                          +{(party.contacts?.length || 0) - 3}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 group-hover:text-white transition-colors">
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        Manage Matrix
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === "wizard" && (
          <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-5 duration-500">
            <div className="bg-[#0a0f1e] rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl relative">
              {/* Wizard Progress */}
              <div className="flex border-b border-white/5 bg-[#0d1428]/50 p-6 px-10">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex-1 flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] font-black transition-all ${
                        wizardStep === step
                          ? "bg-blue-600 text-white shadow-xl shadow-blue-500/30"
                          : wizardStep > step
                            ? "bg-green-600/20 text-green-500 border border-green-500/30"
                            : "bg-slate-900 text-slate-600"
                      }`}
                    >
                      {wizardStep > step ? (
                        <CheckCircle className="w-5 h-5" />
                      ) : (
                        step
                      )}
                    </div>
                    {step < 5 && (
                      <div
                        className={`flex-1 h-0.5 rounded-full ${wizardStep > step ? "bg-green-600/30" : "bg-slate-900"}`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-16 space-y-12 min-h-[500px]">
                {wizardStep === 1 && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                          Identity & Strategy
                        </h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                          Define the foundational core and financial roles
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() =>
                            setFormData({
                              ...formData,
                              isCustomer: !formData.isCustomer,
                            })
                          }
                          className={`px-6 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${formData.isCustomer ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-900 border-white/5 text-slate-500"}`}
                        >
                          {formData.isCustomer ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-current" />
                          )}
                          Customer (A/R)
                        </button>
                        <button
                          onClick={() =>
                            setFormData({
                              ...formData,
                              isVendor: !formData.isVendor,
                            })
                          }
                          className={`px-6 py-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-3 transition-all ${formData.isVendor ? "bg-orange-600 border-orange-500 text-white" : "bg-slate-900 border-white/5 text-slate-500"}`}
                        >
                          {formData.isVendor ? (
                            <CheckCircle className="w-4 h-4" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-current" />
                          )}
                          Vendor (A/P)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-10">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Universal Entity Type
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {(
                            [
                              "Shipper",
                              "Broker",
                              "Vendor_Service",
                              "Vendor_Equipment",
                              "Vendor_Product",
                              "Facility",
                            ] as PartyType[]
                          ).map((t) => (
                            <button
                              key={t}
                              onClick={() => {
                                const isVendorType = t.startsWith("Vendor_");
                                setFormData({
                                  ...formData,
                                  type: t,
                                  isVendor: isVendorType || formData.isVendor,
                                  isCustomer:
                                    t === "Shipper" ||
                                    t === "Broker" ||
                                    formData.isCustomer,
                                });
                              }}
                              className={`p-4 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all text-left ${formData.type === t ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-inner" : "bg-slate-950 border-white/5 text-slate-600 hover:border-slate-700"}`}
                            >
                              {t.replace("_", " ")}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                            Entity Legal Name
                          </label>
                          <input
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white font-black uppercase placeholder:text-slate-800 outline-none focus:border-blue-500/50"
                            placeholder="FULL REGISTERED NAME"
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                              {formData.type === "Shipper"
                                ? "Internal Client Ref"
                                : "MC Number"}
                            </label>
                            <input
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-5 py-3 text-xs text-white outline-none focus:border-blue-500/50"
                              placeholder="IDENTIFIER"
                              value={formData.mcNumber}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  mcNumber: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                              EIN / Tax ID
                            </label>
                            <input
                              className="w-full bg-slate-950 border border-white/10 rounded-xl px-5 py-3 text-xs text-white outline-none focus:border-blue-500/50"
                              placeholder="00-0000000"
                              value={formData.vendorProfile?.taxId}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  vendorProfile: {
                                    ...formData.vendorProfile!,
                                    taxId: e.target.value,
                                  },
                                })
                              }
                            />
                          </div>
                        </div>
                        {formData.type === "Shipper" && (
                          <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                              Client Classification
                            </label>
                            <select className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white font-black uppercase outline-none appearance-none">
                              <option>RETAIL / E-COMMERCE</option>
                              <option>MANUFACTURING</option>
                              <option>WAREHOUSE / DISTRIBUTION</option>
                              <option>CONSTRUCTION / INDUSTRIAL</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                    <div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                        Financial Infrastructure
                      </h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                        Configure A/R and A/P protocols based on relationship
                        architecture
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      {/* CUSTOMER SECTION (AR) */}
                      {formData.isCustomer && (
                        <div className="p-8 bg-blue-600/5 border border-blue-500/20 rounded-[2rem] space-y-6">
                          <div className="flex items-center gap-3 mb-2">
                            <CreditCard className="w-5 h-5 text-blue-500" />
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">
                              Accounts Receivable (A/R)
                            </h3>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                Default Terms
                              </label>
                              <select
                                className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none"
                                value={formData.mcNumber} // Temporary hijacking for MVP
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    mcNumber: e.target.value,
                                  })
                                }
                              >
                                <option value="NET30">NET 30</option>
                                <option value="NET15">NET 15</option>
                                <option value="DUE_UPON">
                                  DUE UPON RECEIPT
                                </option>
                              </select>
                            </div>
                            <div className="bg-blue-600/10 p-4 rounded-2xl border border-blue-500/20">
                              <p className="text-[9px] text-blue-400 font-bold uppercase leading-relaxed">
                                A/R Engine (Engine 2) will auto-generate
                                invoices based on linked Rate Tables defined in
                                Phase 3.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* VENDOR SECTION (AP) */}
                      {formData.isVendor && (
                        <div className="p-8 bg-orange-600/5 border border-orange-500/20 rounded-[2rem] space-y-6">
                          <div className="flex items-center gap-3 mb-2">
                            <Activity className="w-5 h-5 text-orange-500" />
                            <h3 className="text-xs font-black text-white uppercase tracking-widest">
                              Accounts Payable (A/P)
                            </h3>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                                Settlement Method
                              </label>
                              <select
                                className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none"
                                value={formData.dotNumber} // Temporary hijacking
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    dotNumber: e.target.value,
                                  })
                                }
                              >
                                <option value="ACH">ACH TRANSFER</option>
                                <option value="CHECK">MANUAL CHECK</option>
                                <option value="WIRE">WIRE SERVICE</option>
                              </select>
                            </div>
                            <div className="bg-orange-600/10 p-4 rounded-2xl border border-orange-500/20">
                              <p className="text-[9px] text-orange-400 font-bold uppercase leading-relaxed">
                                Bills will be checked against agreed pricing
                                during settlement.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {!formData.isCustomer && !formData.isVendor && (
                        <div className="col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                          <AlertTriangle className="w-10 h-10 text-slate-800 mx-auto mb-4" />
                          <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                            Select at least one financial role in Identity Phase
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                          Registry Tables & Engines
                        </h2>
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                          Define unit pricing and operational constraints
                          (Engine 2)
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            const newRate: RateRow = {
                              id: uuidv4(),
                              tenantId: "DEFAULT",
                              partyId: formData.id!,
                              catalogItemId: "SERVICE_GENERAL",
                              direction: formData.isVendor ? "AP" : "AR",
                              currency: "USD",
                              priceType: "Flat",
                              effectiveStart: new Date().toISOString(),
                              taxableFlag: false,
                              roundingRule: "Nearest Cent",
                              approvalRequired: false,
                            };
                            setFormData({
                              ...formData,
                              rates: [...(formData.rates || []), newRate],
                            });
                          }}
                          className="px-6 py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Add Rate Row
                        </button>
                        <button
                          onClick={() => {
                            const newSet: ConstraintSet = {
                              id: uuidv4(),
                              tenantId: "DEFAULT",
                              partyId: formData.id!,
                              appliesTo: "Party",
                              priority: 0,
                              status: "Active",
                              effectiveStart: new Date().toISOString(),
                              rules: [],
                            };
                            setFormData({
                              ...formData,
                              constraintSets: [
                                ...(formData.constraintSets || []),
                                newSet,
                              ],
                            });
                          }}
                          className="px-6 py-4 bg-slate-900 border border-white/5 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:text-white transition-all"
                        >
                          <ShieldCheck className="w-4 h-4" /> New Constraint Set
                        </button>
                      </div>
                    </div>

                    <div className="space-y-12">
                      {/* ENGINE 2: RATE TABLES */}
                      <section className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                            <DollarSign className="w-4 h-4 text-blue-500" />{" "}
                            Unit Pricing Engine
                          </h3>
                          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                            <Info className="w-3 h-3 text-blue-400" />
                            <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">
                              Pricing defined here is filtered via Constraints
                              below
                            </span>
                          </div>
                        </div>
                        <div className="bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-black/20 border-b border-white/5">
                              <tr>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                                  Item Identifier
                                </th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                                  Direction
                                </th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                                  Model
                                </th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                                  Base Amount
                                </th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                                  Unit Amount
                                </th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                                  Units
                                </th>
                                <th className="px-6 py-4 w-12"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-[10px]">
                              {(formData.rates || []).map((rate, idx) => (
                                <tr key={idx} className="hover:bg-white/[0.02]">
                                  <td className="px-6 py-4">
                                    <input
                                      className="bg-transparent border-0 font-black text-blue-400 uppercase outline-none w-full"
                                      value={rate.catalogItemId}
                                      onChange={(e) => {
                                        const next = [
                                          ...(formData.rates || []),
                                        ];
                                        next[idx].catalogItemId =
                                          e.target.value.toUpperCase();
                                        setFormData({
                                          ...formData,
                                          rates: next,
                                        });
                                      }}
                                    />
                                  </td>
                                  <td className="px-6 py-4">
                                    <select
                                      className="bg-transparent border-0 font-black text-slate-400 outline-none"
                                      value={rate.direction}
                                      onChange={(e) => {
                                        const next = [
                                          ...(formData.rates || []),
                                        ];
                                        next[idx].direction = e.target
                                          .value as any;
                                        setFormData({
                                          ...formData,
                                          rates: next,
                                        });
                                      }}
                                    >
                                      <option value="AR">A/R</option>
                                      <option value="AP">A/P</option>
                                    </select>
                                  </td>
                                  <td className="px-6 py-4">
                                    <select
                                      className="bg-transparent border-0 font-black text-slate-400 outline-none"
                                      value={rate.priceType}
                                      onChange={(e) => {
                                        const next = [
                                          ...(formData.rates || []),
                                        ];
                                        next[idx].priceType = e.target
                                          .value as any;
                                        setFormData({
                                          ...formData,
                                          rates: next,
                                        });
                                      }}
                                    >
                                      <option value="Flat">Flat</option>
                                      <option value="Per_Unit">Per Unit</option>
                                      <option value="Base_Plus_Variable">
                                        Base + Var
                                      </option>
                                      <option value="Tiered">Tiered</option>
                                    </select>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {rate.priceType === "Flat" ||
                                    rate.priceType === "Base_Plus_Variable" ? (
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="text-slate-600 font-bold">
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          className="bg-transparent border-0 font-black text-white text-right outline-none w-20"
                                          value={rate.baseAmount || 0}
                                          onChange={(e) => {
                                            const next = [
                                              ...(formData.rates || []),
                                            ];
                                            next[idx].baseAmount = Number(
                                              e.target.value,
                                            );
                                            setFormData({
                                              ...formData,
                                              rates: next,
                                            });
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-slate-800">--</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    {rate.priceType !== "Flat" ? (
                                      <div className="flex items-center justify-end gap-2">
                                        <span className="text-slate-600 font-bold">
                                          $
                                        </span>
                                        <input
                                          type="number"
                                          className="bg-transparent border-0 font-black text-blue-400 text-right outline-none w-20"
                                          value={rate.unitAmount || 0}
                                          onChange={(e) => {
                                            const next = [
                                              ...(formData.rates || []),
                                            ];
                                            next[idx].unitAmount = Number(
                                              e.target.value,
                                            );
                                            setFormData({
                                              ...formData,
                                              rates: next,
                                            });
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-slate-800">--</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 uppercase">
                                    <select
                                      className="bg-transparent border-0 font-black text-slate-400 outline-none"
                                      value={rate.unitType || "Flat"}
                                      onChange={(e) => {
                                        const next = [
                                          ...(formData.rates || []),
                                        ];
                                        next[idx].unitType = e.target
                                          .value as any;
                                        setFormData({
                                          ...formData,
                                          rates: next,
                                        });
                                      }}
                                    >
                                      <option value="Event">Flat</option>
                                      <option value="Mile">Mile</option>
                                      <option value="Hour">Hour</option>
                                      <option value="Stop">Stop</option>
                                      <option value="Load">Load</option>
                                    </select>
                                  </td>
                                  <td className="px-6 py-4">
                                    <button
                                      onClick={() => {
                                        const next = (
                                          formData.rates || []
                                        ).filter((_, i) => i !== idx);
                                        setFormData({
                                          ...formData,
                                          rates: next,
                                        });
                                      }}
                                      className="text-slate-800 hover:text-red-500 transition-all"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {(formData.rates || []).length === 0 && (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="px-6 py-12 text-center text-slate-700 font-black uppercase tracking-widest italic"
                                  >
                                    No rate rows generated. Tables are sparse.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      {/* CONSTRAINT ENGINE */}
                      <section className="space-y-6">
                        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                          <Ruler className="w-4 h-4 text-orange-500" />{" "}
                          Operational Constraints
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {(formData.constraintSets || []).map((set, sIdx) => (
                            <div
                              key={sIdx}
                              className="bg-[#0a0f1e] border border-white/10 rounded-[2rem] p-8 space-y-6"
                            >
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                  <div className="px-3 py-1 bg-orange-600/10 text-orange-500 border border-orange-500/20 rounded-lg text-[8px] font-black uppercase">
                                    SET #{sIdx + 1}
                                  </div>
                                  <select
                                    className="bg-transparent border-0 text-[10px] font-black text-white uppercase outline-none"
                                    value={set.appliesTo}
                                    onChange={(e) => {
                                      const next = [
                                        ...(formData.constraintSets || []),
                                      ];
                                      next[sIdx].appliesTo = e.target
                                        .value as any;
                                      setFormData({
                                        ...formData,
                                        constraintSets: next,
                                      });
                                    }}
                                  >
                                    <option value="Party">Global Party</option>
                                    <option value="Catalog_Item">
                                      Specific Service
                                    </option>
                                    <option value="Equipment_Type">
                                      Equipment Type
                                    </option>
                                    <option value="Lane">Fixed Lane</option>
                                  </select>
                                </div>
                                <button
                                  onClick={() => {
                                    const next = (
                                      formData.constraintSets || []
                                    ).filter((_, i) => i !== sIdx);
                                    setFormData({
                                      ...formData,
                                      constraintSets: next,
                                    });
                                  }}
                                  className="text-slate-700 hover:text-red-500 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="space-y-3">
                                {(set.rules ?? []).map((rule, rIdx) => (
                                  <div
                                    key={rIdx}
                                    className="p-4 bg-slate-950 border border-white/5 rounded-2xl flex items-center gap-4 text-[10px]"
                                  >
                                    <select
                                      className="bg-transparent border-0 text-slate-500 font-black uppercase outline-none"
                                      value={rule.type}
                                      onChange={(e) => {
                                        const next = [
                                          ...(formData.constraintSets || []),
                                        ];
                                        next[sIdx].rules[rIdx].type = e.target
                                          .value as any;
                                        setFormData({
                                          ...formData,
                                          constraintSets: next,
                                        });
                                      }}
                                    >
                                      <option value="Geo">Geo</option>
                                      <option value="Time">Time</option>
                                      <option value="Capacity">Load/Cap</option>
                                      <option value="Equipment">Equip</option>
                                      <option value="Compliance">Safety</option>
                                    </select>
                                    <input
                                      list="constraint-fields"
                                      className="bg-transparent border-0 font-bold text-slate-400 uppercase outline-none w-24"
                                      placeholder="FIELD"
                                      value={rule.field}
                                      onChange={(e) => {
                                        const next = [
                                          ...(formData.constraintSets || []),
                                        ];
                                        next[sIdx].rules[rIdx].field =
                                          e.target.value.toUpperCase();
                                        setFormData({
                                          ...formData,
                                          constraintSets: next,
                                        });
                                      }}
                                    />
                                    <select
                                      className="bg-transparent border-0 font-black text-orange-500 uppercase outline-none"
                                      value={rule.operator}
                                      onChange={(e) => {
                                        const next = [
                                          ...(formData.constraintSets || []),
                                        ];
                                        next[sIdx].rules[rIdx].operator = e
                                          .target.value as any;
                                        setFormData({
                                          ...formData,
                                          constraintSets: next,
                                        });
                                      }}
                                    >
                                      <option value="=">=</option>
                                      <option value="!=">!=</option>
                                      <option value="IN">IN</option>
                                      <option value=">=">&gt;=</option>
                                      <option value="<=">&lt;=</option>
                                      <option value="EXISTS">EXISTS</option>
                                    </select>
                                    <input
                                      list="constraint-values"
                                      className="bg-transparent border-0 font-black text-white truncate outline-none flex-1"
                                      placeholder="VALUE"
                                      value={rule.value}
                                      onChange={(e) => {
                                        const next = [
                                          ...(formData.constraintSets || []),
                                        ];
                                        next[sIdx].rules[rIdx].value =
                                          e.target.value;
                                        setFormData({
                                          ...formData,
                                          constraintSets: next,
                                        });
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        const next = [
                                          ...(formData.constraintSets || []),
                                        ];
                                        next[sIdx].rules = (
                                          next[sIdx].rules ?? []
                                        ).filter((_, i) => i !== rIdx);
                                        setFormData({
                                          ...formData,
                                          constraintSets: next,
                                        });
                                      }}
                                      className="text-slate-800 hover:text-slate-400"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                                <datalist id="constraint-fields">
                                  <option value="WEIGHT_LBS">WEIGHT_LBS</option>
                                  <option value="DIM_HEIGHT">DIM_HEIGHT</option>
                                  <option value="TEMP_SETPOINT">
                                    TEMP_SETPOINT
                                  </option>
                                  <option value="DAY_OF_WEEK">
                                    DAY_OF_WEEK
                                  </option>
                                  <option value="STATE_CODE">STATE_CODE</option>
                                  <option value="HAZARDOUS_FLAG">
                                    HAZARDOUS_FLAG
                                  </option>
                                </datalist>
                                <datalist id="constraint-values">
                                  <option value="TRUE">TRUE</option>
                                  <option value="FALSE">FALSE</option>
                                  <option value="MONDAY">MONDAY</option>
                                  <option value="SUNDAY">SUNDAY</option>
                                  <option value="US_CA">US_CA</option>
                                  <option value="US_TX">US_TX</option>
                                </datalist>
                                <button
                                  onClick={() => {
                                    const nextSets = [
                                      ...(formData.constraintSets || []),
                                    ];
                                    if (!nextSets[sIdx].rules)
                                      nextSets[sIdx].rules = [];
                                    nextSets[sIdx].rules.push({
                                      id: uuidv4(),
                                      constraintSetId: set.id,
                                      type: "Time",
                                      field: "AFTER_HOURS",
                                      operator: "=",
                                      value: "TRUE",
                                      enforcement: "Block",
                                    });
                                    setFormData({
                                      ...formData,
                                      constraintSets: nextSets,
                                    });
                                  }}
                                  className="w-full py-3 border border-dashed border-white/5 rounded-2xl text-[9px] font-black text-slate-700 uppercase tracking-widest hover:border-slate-700 hover:text-slate-500 transition-all"
                                >
                                  + Append Global Rule
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>
                  </div>
                )}

                {wizardStep === 4 && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                    <div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                        Broker Network
                      </h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                        Establish authoritative contacts and link preferred
                        operational partners
                      </p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
                      {/* Contacts Column */}
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                            Command Contacts
                          </h3>
                          <button
                            onClick={() => {
                              const newContact: PartyContact = {
                                id: uuidv4(),
                                partyId: formData.id!,
                                name: "NEW CONTACT",
                                role: "General",
                                email: "PENDING@MAIL.COM",
                                phone: "000-000-000",
                                isPrimary:
                                  (formData.contacts || []).length === 0,
                              };
                              setFormData({
                                ...formData,
                                contacts: [
                                  ...(formData.contacts || []),
                                  newContact,
                                ],
                              });
                            }}
                            className="text-[9px] font-black text-blue-500 uppercase tracking-[0.2em] hover:text-white transition-all"
                          >
                            + Inject Contact
                          </button>
                        </div>
                        <div className="bg-slate-950 border border-white/5 rounded-3xl overflow-hidden">
                          <table className="w-full text-left">
                            <thead className="bg-[#020617] border-b border-white/5">
                              <tr>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                  Identity
                                </th>
                                <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                  Role
                                </th>
                                <th className="px-6 py-4 w-12 text-center">
                                  P
                                </th>
                                <th className="px-6 py-4 w-12 text-center"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {(formData.contacts || []).map((c, i) => (
                                <tr key={i} className="group">
                                  <td className="px-6 py-4">
                                    <input
                                      className="bg-transparent border-0 text-[11px] font-black text-white uppercase outline-none w-full"
                                      value={c.name}
                                      onChange={(e) => {
                                        const newContacts = [
                                          ...(formData.contacts || []),
                                        ];
                                        newContacts[i].name = e.target.value;
                                        setFormData({
                                          ...formData,
                                          contacts: newContacts,
                                        });
                                      }}
                                    />
                                    <div className="text-[9px] text-slate-600 font-bold">
                                      {c.email}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <select
                                      className="bg-transparent border-0 text-[9px] font-black text-blue-500 uppercase outline-none"
                                      value={c.role}
                                      onChange={(e) => {
                                        const newContacts = [
                                          ...(formData.contacts || []),
                                        ];
                                        newContacts[i].role = e.target
                                          .value as any;
                                        setFormData({
                                          ...formData,
                                          contacts: newContacts,
                                        });
                                      }}
                                    >
                                      <option>Operations</option>
                                      <option>Billing</option>
                                      <option>After-hours</option>
                                      <option>Claims</option>
                                      <option>General</option>
                                    </select>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <button
                                      onClick={() => {
                                        const newContacts = (
                                          formData.contacts || []
                                        ).map((cx, idx) => ({
                                          ...cx,
                                          isPrimary: i === idx,
                                        }));
                                        setFormData({
                                          ...formData,
                                          contacts: newContacts,
                                        });
                                      }}
                                    >
                                      {c.isPrimary ? (
                                        <CheckCircle className="w-4 h-4 text-green-500" />
                                      ) : (
                                        <div className="w-4 h-4 rounded-full border border-slate-800 mx-auto" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <button
                                      onClick={() =>
                                        setFormData({
                                          ...formData,
                                          contacts: (
                                            formData.contacts || []
                                          ).filter((_, idx) => idx !== i),
                                        })
                                      }
                                      className="text-slate-800 hover:text-red-500"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Preferred Partners Column (For Broker/Shipper) */}
                      <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                            Preferred Network Nodes
                          </h3>
                          <div className="flex gap-4">
                            <button
                              onClick={() => setActiveModal("QUICK_VENDOR")}
                              className="text-[9px] font-black text-orange-500 uppercase tracking-[0.2em] hover:text-white transition-all"
                            >
                              + Quick Vendor
                            </button>
                            <button
                              onClick={() => setActiveModal("QUICK_EQUIP")}
                              className="text-[9px] font-black text-teal-500 uppercase tracking-[0.2em] hover:text-white transition-all"
                            >
                              + Quick Equip
                            </button>
                          </div>
                        </div>
                        <div className="bg-slate-900/30 border border-white/5 rounded-[2.5rem] p-8 space-y-6">
                          <div className="space-y-4">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">
                              Bound Service Vendors
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {parties
                                .filter((p) => p.isVendor)
                                .slice(0, 6)
                                .map((v) => (
                                  <button
                                    key={v.id}
                                    onClick={() => {
                                      const current =
                                        formData.preferredPartners || [];
                                      const exists = current.some(
                                        (p) => p.partnerId === v.id,
                                      );
                                      const next = exists
                                        ? current.filter(
                                            (p) => p.partnerId !== v.id,
                                          )
                                        : [
                                            ...current,
                                            {
                                              id: uuidv4(),
                                              partyId: formData.id!,
                                              partnerId: v.id,
                                              partnerType: "Vendor",
                                            },
                                          ];
                                      setFormData({
                                        ...formData,
                                        preferredPartners: next,
                                      });
                                    }}
                                    className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${formData.preferredPartners?.some((p) => p.partnerId === v.id) ? "bg-orange-600 border-orange-500 text-white" : "bg-slate-950 border-white/5 text-slate-500"}`}
                                  >
                                    {v.name}
                                  </button>
                                ))}
                            </div>
                          </div>
                          <div className="h-px bg-white/5" />
                          <div className="space-y-4">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">
                              Pinned Equipment Assets
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                "Dry Van",
                                "Reefer",
                                "Flatbed",
                                "Box Truck",
                              ].map((type) => (
                                <div
                                  key={type}
                                  className="p-4 bg-slate-950 rounded-2xl border border-white/5 flex items-center justify-between"
                                >
                                  <span className="text-[9px] font-black text-slate-400 font-mono uppercase">
                                    {type}
                                  </span>
                                  <CheckCircle className="w-4 h-4 text-slate-800" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 5 && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-left-4">
                    <div>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-4">
                        Final Validation & Network Commit
                      </h2>
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">
                        Review relationship matrix telemetry before node
                        activation
                      </p>
                    </div>

                    <div className="grid grid-cols-12 gap-10">
                      <div className="col-span-12 xl:col-span-7 bg-slate-950/50 border border-white/5 rounded-[3rem] p-10 space-y-8">
                        <div className="flex items-center gap-6">
                          <div className="w-20 h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center border border-blue-500/20">
                            <Activity className="w-10 h-10 text-blue-500" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black text-white uppercase truncate">
                              {formData.name}
                            </h3>
                            <div className="flex gap-4 mt-1">
                              <span className="text-[10px] font-black text-slate-500 uppercase">
                                {formData.type?.replace("_", " ")}
                              </span>
                              {formData.isCustomer && (
                                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                  A/R ENABLED
                                </span>
                              )}
                              {formData.isVendor && (
                                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">
                                  A/P ENABLED
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-white/5">
                          <div className="space-y-4">
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                              <span className="text-slate-600">Remittance</span>
                              <span className="text-white">
                                {formData.billingProfile?.paymentTerms ||
                                  "PENDING"}
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                              <span className="text-slate-600">
                                Exposure Limit
                              </span>
                              <span className="text-white">
                                $
                                {formData.billingProfile?.creditLimit?.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                              <span className="text-slate-600">
                                QuickPay Rate
                              </span>
                              <span className="text-white">
                                {formData.billingProfile?.quickPayFee || 0}%
                              </span>
                            </div>
                          </div>
                          <div className="space-y-4">
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                              <span className="text-slate-600">Contacts</span>
                              <span className="text-white">
                                {(formData.contacts || []).length} Units
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                              <span className="text-slate-600">Partners</span>
                              <span className="text-white">
                                {(formData.preferredPartners || []).length}{" "}
                                Links
                              </span>
                            </div>
                            <div className="flex justify-between text-[10px] font-bold uppercase">
                              <span className="text-slate-600">Offering</span>
                              <span className="text-white">
                                {formData.vendorProfile?.offeringTypes?.join(
                                  ", ",
                                ) || "NONE"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="col-span-12 xl:col-span-5 flex flex-col gap-6">
                        <div className="bg-orange-600/5 border border-orange-500/20 rounded-[2.5rem] p-8 text-center space-y-4">
                          <AlertTriangle className="w-10 h-10 text-orange-500 mx-auto" />
                          <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed">
                            Activating this node will bridge its operational and
                            financial telemetry across the global matrix.
                          </p>
                          <select
                            className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs text-white font-black uppercase outline-none"
                            value={formData.status}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                status: e.target.value as any,
                              })
                            }
                          >
                            <option value="Approved">Live / Approved</option>
                            <option value="In_Review">
                              Submission / Review
                            </option>
                            <option value="On_Hold">On Hold / Audit</option>
                          </select>
                        </div>
                        <div className="bg-blue-600/5 border border-blue-500/20 rounded-[2.5rem] p-8 flex items-center gap-6">
                          <div className="p-4 bg-blue-600/10 rounded-2xl">
                            <ShieldCheck className="w-8 h-8 text-blue-500" />
                          </div>
                          <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest leading-loose">
                            Compliance verification queued automatically upon
                            Registry Commit.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Wizard Footer */}
              <div className="p-10 border-t border-white/5 bg-[#0d1428]/50 flex justify-between items-center">
                <button
                  onClick={() =>
                    wizardStep === 1
                      ? setView("dashboard")
                      : setWizardStep(wizardStep - 1)
                  }
                  className="px-10 py-5 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
                >
                  {wizardStep === 1 ? "Discard & Return" : "Backtrack Step"}
                </button>
                <div className="flex gap-4">
                  {wizardStep < 5 ? (
                    <button
                      onClick={() => setWizardStep(wizardStep + 1)}
                      className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-3"
                    >
                      Next Phase <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSave(formData)}
                      disabled={isSubmitting}
                      className="px-12 py-5 bg-green-600 hover:bg-green-500 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-green-900/20 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Saving..." : "Commit to Registry"}{" "}
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {view === "profile" && selectedParty && (
          <div className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-500">
            {/* SQL-Style Header */}
            <div className="flex justify-between items-center bg-[#0a0f1e]/80 backdrop-blur-md border-b border-white/5 px-8 py-6 sticky top-0 z-40">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setView("dashboard")}
                  className="p-3 bg-slate-900 border border-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
                >
                  <ChevronRight className="w-5 h-5 rotate-180" />
                </button>
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                      {selectedParty.name}
                    </h2>
                    <span className="px-3 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg text-[9px] font-black uppercase tracking-widest">
                      {selectedParty.type}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    ID: {selectedParty.id}
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-3">
                  <Plus className="w-4 h-4" /> New Relation
                </button>
                <button className="px-6 py-3 bg-slate-900 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
                  Export SQL
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Left Navigation: Relationship Browser */}
              <div className="w-64 bg-[#0a0f1e]/50 border-r border-white/5 flex flex-col p-4 space-y-2">
                <label className="text-[9px] font-black text-slate-600 uppercase tracking-[0.2em] mb-2 px-4">
                  Registry Tables
                </label>
                {[
                  { id: "IDENTITY", label: "Party Identity", icon: Building2 },
                  { id: "CONTACTS", label: "Auth Contacts", icon: Users },
                  { id: "CATALOG", label: "Services", icon: List },
                  { id: "RATES", label: "Pricing", icon: DollarSign },
                  {
                    id: "CONSTRAINTS",
                    label: "Rules",
                    icon: ShieldCheck,
                  },
                  { id: "DOCS", label: "Compliance Docs", icon: FileText },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveProfileTab(tab.id as any)}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                      activeProfileTab === tab.id
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                        : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {tab.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Center: Grid-First Content */}
              <div className="flex-1 bg-slate-950 overflow-auto p-10">
                {activeProfileTab === "IDENTITY" && (
                  <div className="max-w-4xl space-y-12">
                    <section className="space-y-6">
                      <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                        <Layout className="w-4 h-4 text-blue-500" /> Core
                        Attributes
                      </h3>
                      <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                            Base Identity Name
                          </label>
                          <div className="p-4 bg-[#0a0f1e] border border-white/5 rounded-2xl text-xs font-bold text-white">
                            {selectedParty.name}
                          </div>
                        </div>
                        <div className="space-y-4">
                          <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                            A/R Customer Flag
                          </label>
                          <div
                            className={`p-4 rounded-2xl border flex items-center justify-between ${selectedParty.isCustomer ? "bg-green-600/5 border-green-500/20" : "bg-slate-900 border-white/5 opacity-50"}`}
                          >
                            <span className="text-[10px] font-black text-white">
                              ENABLED
                            </span>
                            <CheckCircle
                              className={`w-4 h-4 ${selectedParty.isCustomer ? "text-green-500" : "text-slate-800"}`}
                            />
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {activeProfileTab === "RATES" && (
                  <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                          Unified Rate Table
                        </h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                          Universal Unit Pricing Engine (Engine 2)
                        </p>
                      </div>
                      <div className="flex gap-4">
                        <button className="px-4 py-2 bg-slate-900 border border-white/5 rounded-lg text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all">
                          + Add Rate Row
                        </button>
                      </div>
                    </div>
                    <div className="bg-[#0a0f1e] border border-white/10 rounded-[2rem] overflow-hidden">
                      <table className="w-full text-left">
                        <thead className="bg-black/20 border-b border-white/5">
                          <tr>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                              Item ID
                            </th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                              Direction
                            </th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                              Pricing Model
                            </th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                              Unit Rate
                            </th>
                            <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                              Units
                            </th>
                            <th className="px-6 py-4 text-center w-12"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {selectedParty.rates?.map((rate, i) => (
                            <tr
                              key={i}
                              className="hover:bg-white/[0.02] transition-colors group"
                            >
                              <td className="px-6 py-4 text-[10px] font-bold text-blue-400 uppercase">
                                {rate.catalogItemId}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`px-2 py-1 rounded text-[8px] font-black ${rate.direction === "AR" ? "bg-green-600/10 text-green-500" : "bg-purple-600/10 text-purple-500"}`}
                                >
                                  {rate.direction}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-[10px] font-bold text-slate-300 uppercase">
                                {rate.priceType}
                              </td>
                              <td className="px-6 py-4 text-[10px] font-black text-white text-right">
                                ${rate.unitAmount || rate.baseAmount}
                              </td>
                              <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">
                                {rate.unitType || "FLAT"}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button className="text-slate-800 group-hover:text-slate-400 transition-all">
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {(!selectedParty.rates ||
                            selectedParty.rates.length === 0) && (
                            <tr>
                              <td
                                colSpan={6}
                                className="px-6 py-20 text-center text-[10px] text-slate-700 font-black uppercase italic tracking-widest"
                              >
                                No unified rates currently mapped for this node.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeProfileTab === "CATALOG" && (
                  <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                          Authorized Service Catalog
                        </h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                          Directly Mapped Enterprise Offerings
                        </p>
                      </div>
                      <button
                        onClick={addCatalogItem}
                        className="px-4 py-2 bg-slate-900 border border-white/5 rounded-lg text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all"
                      >
                        + Add Item
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {catalogItems.length > 0 ? (
                        catalogItems.map((item) => (
                          <div
                            key={item.id}
                            className="p-6 bg-[#0a0f1e] border border-white/5 rounded-3xl flex justify-between items-center group hover:border-blue-500/30 transition-all"
                          >
                            <div>
                              <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">
                                {item.kind}
                              </div>
                              <div className="text-sm font-black text-white uppercase">
                                {item.itemName}
                              </div>
                              <div className="text-[9px] text-slate-600 font-bold mt-1">
                                CODE: {item.itemCode}
                              </div>
                            </div>
                            <div
                              className={`w-3 h-3 rounded-full ${item.active ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-slate-800"}`}
                            />
                          </div>
                        ))
                      ) : (
                        <div className="col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                          <List className="w-10 h-10 text-slate-800 mx-auto mb-4" />
                          <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                            No catalog items mapped to this node
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeProfileTab === "CONSTRAINTS" && (
                  <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                          Operational Logic Constraints
                        </h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                          Rule-Based Filtering & Validation Engine
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6">
                      {selectedParty.constraintSets?.map((set, idx) => (
                        <div
                          key={set.id}
                          className="p-8 bg-[#0a0f1e] border border-white/5 rounded-[2rem] space-y-6"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="px-3 py-1 bg-orange-600/10 text-orange-500 border border-orange-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest">
                                SET {idx + 1}
                              </div>
                              <span className="text-[10px] font-black text-white uppercase">
                                Applies to: {set.appliesTo}
                              </span>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border ${set.status === "Active" ? "text-green-400 border-green-400/20 bg-green-400/5" : "text-slate-500 border-white/10 bg-white/5"}`}
                            >
                              {set.status}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(set.rules ?? []).length > 0 ? (
                              (set.rules ?? []).map((rule, rIdx) => (
                                <div
                                  key={rIdx}
                                  className="p-4 bg-slate-950 border border-white/5 rounded-2xl flex items-center justify-between"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-orange-600/10 flex items-center justify-center">
                                      <ShieldCheck className="w-4 h-4 text-orange-500" />
                                    </div>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                      {rule.type} {rule.operator} {rule.value}
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[8px] font-black uppercase ${rule.action === "Allow" ? "text-green-500" : "text-red-500"}`}
                                  >
                                    {rule.action}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <div className="col-span-2 text-center py-6 text-[10px] text-slate-700 font-black uppercase italic">
                                No rules defined in this set. Global permissions
                                apply.
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {(!selectedParty.constraintSets ||
                        selectedParty.constraintSets.length === 0) && (
                        <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                          <ShieldCheck className="w-10 h-10 text-slate-800 mx-auto mb-4" />
                          <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                            No rules set. Full flexibility.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeProfileTab === "DOCS" && (
                  <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                          Compliance & Legal Artifacts
                        </h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                          Audit-Ready Documentation Vault
                        </p>
                      </div>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all">
                        + Upload Document
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedParty.documents?.map((doc) => (
                        <div
                          key={doc.id}
                          className="p-6 bg-[#0a0f1e] border border-white/5 rounded-3xl flex items-center gap-6 group hover:border-blue-500/30 transition-all cursor-pointer"
                        >
                          <div className="w-14 h-14 bg-slate-950 border border-white/10 rounded-2xl flex items-center justify-center group-hover:bg-blue-600/10 transition-colors">
                            <FileText className="w-7 h-7 text-slate-600 group-hover:text-blue-500 transition-colors" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
                                {doc.type}
                              </span>
                              <span className="text-[8px] font-bold text-slate-600 uppercase">
                                EXP:{" "}
                                {new Date(doc.expiryDate).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="text-sm font-black text-white uppercase truncate">
                              {doc.name}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span
                                className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${doc.status === "Verified" ? "text-green-400 bg-green-900/20 border-green-500/20" : "text-orange-400 bg-orange-900/20 border-orange-500/20"}`}
                              >
                                {doc.status}
                              </span>
                              <button className="text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest">
                                View PDF
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!selectedParty.documents ||
                        selectedParty.documents.length === 0) && (
                        <div className="col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                          <FileText className="w-10 h-10 text-slate-800 mx-auto mb-4" />
                          <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                            No documents uploaded yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeProfileTab === "CONTACTS" && (
                  <div className="space-y-8 animate-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-tighter">
                          Authorized Contacts
                        </h3>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                          Personnel Permissions & Comms Matrix
                        </p>
                      </div>
                      <button className="px-4 py-2 bg-slate-900 border border-white/5 rounded-lg text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-white transition-all">
                        + Add Contact
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedParty.contacts?.map((contact) => (
                        <div
                          key={contact.id}
                          className="p-8 bg-[#0a0f1e] border border-white/5 rounded-[2rem] space-y-6 relative overflow-hidden group"
                        >
                          <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity">
                            <Users className="w-20 h-20 text-white" />
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center text-xl font-black text-blue-500 border border-white/5">
                              {contact.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-lg font-black text-white uppercase tracking-tighter">
                                {contact.name}
                              </div>
                              <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {contact.role}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-3 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-3 text-slate-400">
                              <Phone className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-black tracking-widest">
                                {contact.phone}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-400">
                              <Mail className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-black lowercase tracking-tight">
                                {contact.email}
                              </span>
                            </div>
                          </div>
                          <div className="pt-6 flex gap-3">
                            <button className="flex-1 py-3 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                              Dial
                            </button>
                            <button className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all">
                              Email
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!selectedParty.contacts ||
                        selectedParty.contacts.length === 0) && (
                        <div className="col-span-2 py-20 text-center border-2 border-dashed border-white/5 rounded-[2rem]">
                          <Users className="w-10 h-10 text-slate-800 mx-auto mb-4" />
                          <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                            No contacts added yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Context & Validation Panel */}
              <div className="w-80 bg-[#0a0f1e]/80 border-l border-white/5 p-8 flex flex-col space-y-10">
                <div>
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">
                    Commercial Signals
                  </h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-950 border border-white/5 rounded-2xl flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-600/10 rounded-xl flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-white uppercase">
                          Identity Verified
                        </div>
                        <div className="text-[9px] font-bold text-slate-600 uppercase">
                          SECURE REGISTRY PK
                        </div>
                      </div>
                    </div>
                    {selectedParty.isVendor && (
                      <div className="p-4 bg-orange-600/10 border border-orange-500/20 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-600/10 rounded-xl flex items-center justify-center">
                          <Zap className="w-5 h-5 text-orange-500" />
                        </div>
                        <div>
                          <div className="text-[10px] font-black text-white uppercase">
                            AP Workflow Active
                          </div>
                          <div className="text-[9px] font-bold text-slate-600 uppercase">
                            AUTOMATED SETTLEMENT
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-1">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-6">
                    Quick Actions
                  </h4>
                  <div className="grid grid-cols-1 gap-3">
                    <button className="w-full text-left p-4 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all group">
                      <div className="text-[9px] font-black text-blue-500 uppercase mb-1">
                        Safety Log
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 group-hover:text-white">
                        View Violation History
                      </div>
                    </button>
                    <button className="w-full text-left p-4 bg-slate-900 hover:bg-slate-800 border border-white/5 rounded-2xl transition-all group">
                      <div className="text-[9px] font-black text-purple-500 uppercase mb-1">
                        Financial Check
                      </div>
                      <div className="text-[10px] font-bold text-slate-300 group-hover:text-white">
                        Verify Credit Matrix
                      </div>
                    </button>
                  </div>
                </div>

                <div className="p-6 bg-red-600/5 border border-red-500/20 rounded-[2rem]">
                  <h5 className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-3">
                    Critical Warning
                  </h5>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                    COI expiries within 12 days. Automated lockout will trigger
                    at T-0.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QUICK CREATE MODALS */}
      {activeModal !== "NONE" && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/90 backdrop-blur-xl p-10">
          <div className="bg-[#0a0f1e] border border-white/10 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-8 border-b border-white/5 bg-white/[0.02]">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tighter">
                  {activeModal.replace("_", " ")}
                </h3>
                <p className="text-[9px] text-slate-500 font-black uppercase mt-1">
                  Lightweight Injection Matrix
                </p>
              </div>
              <button
                onClick={() => setActiveModal("NONE")}
                className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-slate-500 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  Legal Name
                </label>
                <input
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white font-black"
                  placeholder="ENTITY NAME"
                  value={quickFormData.name}
                  onChange={(e) =>
                    setQuickFormData({ ...quickFormData, name: e.target.value })
                  }
                />
              </div>
              {activeModal === "QUICK_VENDOR" ? (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Offering
                    </label>
                    <select
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white font-black appearance-none"
                      value={quickFormData.offering}
                      onChange={(e) =>
                        setQuickFormData({
                          ...quickFormData,
                          offering: e.target.value,
                        })
                      }
                    >
                      <option>SERVICE</option>
                      <option>PRODUCT</option>
                      <option>EQUIPMENT</option>
                    </select>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Tax ID
                    </label>
                    <input
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white"
                      placeholder="00-0000000"
                      value={quickFormData.taxId}
                      onChange={(e) =>
                        setQuickFormData({
                          ...quickFormData,
                          taxId: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Unit #
                    </label>
                    <input
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white font-black"
                      placeholder="TRK-99"
                      value={quickFormData.unitNumber}
                      onChange={(e) =>
                        setQuickFormData({
                          ...quickFormData,
                          unitNumber: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Plate / VIN
                    </label>
                    <input
                      className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white"
                      placeholder="VIN..."
                      value={quickFormData.vin}
                      onChange={(e) =>
                        setQuickFormData({
                          ...quickFormData,
                          vin: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end">
              <button
                onClick={async () => {
                  if (activeModal === "QUICK_VENDOR") {
                    const newVendor: NetworkParty = {
                      id: uuidv4(),
                      companyId: companyId,
                      tenantId: "DEFAULT",
                      name: quickFormData.name || "UNNAMED VENDOR",
                      type: "Vendor",
                      status: "Approved",
                      isVendor: true,
                      isCustomer: false,
                      rates: [],
                      constraintSets: [],
                      catalogLinks: [],
                      contacts: [],
                      documents: [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    await handleSave(newVendor);
                    // Auto-link to parent if in wizard
                    setFormData((prev) => ({
                      ...prev,
                      catalogLinks: [
                        ...(prev.catalogLinks || []),
                        newVendor.id,
                      ],
                    }));
                  } else if (activeModal === "QUICK_EQUIP") {
                    // Asset logic here
                    const newAsset: EquipmentAsset = {
                      id: uuidv4(),
                      tenantId: "DEFAULT",
                      unitNumber: quickFormData.unitNumber || "UNIT-X",
                      vin: quickFormData.vin,
                      typeId: "UNKNOWN",
                      providerId: formData.id!,
                      status: "Available",
                      capabilities: [],
                    };
                    setEquipmentAssets([...equipmentAssets, newAsset]);
                  }
                  setActiveModal("NONE");
                  setQuickFormData({});
                }}
                disabled={isSubmitting}
                className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Saving..." : "Confirm Injection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
