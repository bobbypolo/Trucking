import React from "react";
import { User, Quote, Lead } from "../../types";
import { CheckCircle2, Sparkles, MapPin, Target, Phone } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface QuoteIntakeFormProps {
  user: User;
  selectedQuote: Quote | null;
  setSelectedQuote: React.Dispatch<React.SetStateAction<Quote | null>>;
  leads: Lead[];
  isSubmitting: boolean;
  onPhoneInteraction: (phoneNumber: string, context: string) => Promise<void>;
  onDiscard: () => void;
  onSaveAndReveal: (quote: Quote) => Promise<void>;
}

export const QuoteIntakeForm: React.FC<QuoteIntakeFormProps> = ({
  user,
  selectedQuote,
  setSelectedQuote,
  leads,
  isSubmitting,
  onPhoneInteraction,
  onDiscard,
  onSaveAndReveal,
}) => {
  return (
    <div className="h-full flex flex-col bg-slate-950 p-8 animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
      <div className="max-w-5xl mx-auto w-full space-y-10 pb-20">
        {/* Header Section */}
        <div className="flex justify-between items-end border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-8 bg-blue-600 rounded-full" />
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                New Opportunity Intake
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 font-bold uppercase tracking-[0.2em]">
              High-Density Command Lead Entry • v{selectedQuote?.version || 1}
            </p>
          </div>
          {import.meta.env.DEV && (
            <button
              onClick={() =>
                setSelectedQuote({
                  id: uuidv4(),
                  companyId: user.companyId,
                  status: "Draft",
                  version: 1,
                  ownerId: user.id,
                  validUntil: new Date(
                    Date.now() + 7 * 24 * 3600000,
                  ).toISOString(),
                  createdAt: new Date().toISOString(),
                  pickup: {
                    city: "Chicago",
                    state: "IL",
                    facilityName: "Logistics Hub A",
                  },
                  dropoff: {
                    city: "Dallas",
                    state: "TX",
                    facilityName: "Distribution Center B",
                  },
                  equipmentType: "Dry Van",
                  linehaul: 2400,
                  fuelSurcharge: 450,
                  accessorials: [],
                  totalRate: 2850,
                  notes:
                    "Urgent move. Customer requesting team drivers if possible.",
                })
              }
              className="px-6 py-3 bg-blue-600/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 hover:text-white transition-all duration-300 shadow-lg shadow-blue-500/5 flex items-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" /> Seed Intelligence Demo
            </button>
          )}
        </div>

        {/* Main Form Body */}
        <div className="bg-slate-900 border border-white/5 rounded-[2.5rem] p-10 shadow-3xl space-y-12">
          {/* Section 1: Source & Customer Identity */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Identity
              & Source
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <label
                  htmlFor="qmInquiryChannel"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                >
                  Inquiry Channel
                </label>
                <select
                  id="qmInquiryChannel"
                  className="w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-xs text-white font-bold outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer hover:border-white/20"
                >
                  <option>Phone Interaction</option>
                  <option>Direct Email</option>
                  <option>DAT / Truckstop Direct</option>
                  <option>Strategic Website Portal</option>
                </select>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="qmCompanyEntityName"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                >
                  Company / Entity Name
                </label>
                <input
                  id="qmCompanyEntityName"
                  className="w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-xs text-white font-bold outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-800"
                  placeholder="Enter Prospect or Customer Name"
                  value={
                    selectedQuote?.leadId
                      ? leads.find((l) => l.id === selectedQuote.leadId)
                          ?.customerName || ""
                      : ""
                  }
                  readOnly={!!selectedQuote?.notes}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="qmContactIntelligence"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
                >
                  Contact Intelligence
                </label>
                <div className="flex gap-2">
                  <input
                    id="qmContactIntelligence"
                    className="flex-1 bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-xs text-white font-bold outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-800"
                    placeholder="Enter phone number"
                    value={
                      selectedQuote?.leadId
                        ? leads.find((l) => l.id === selectedQuote.leadId)
                            ?.callerPhone || ""
                        : ""
                    }
                    readOnly={!!selectedQuote?.notes}
                  />
                  <button
                    className="bg-blue-600 hover:bg-blue-500 text-white w-12 rounded-2xl flex items-center justify-center transition-all shadow-lg shadow-blue-500/20 active:scale-90"
                    onClick={() =>
                      onPhoneInteraction(
                        (selectedQuote?.leadId
                          ? leads.find((l) => l.id === selectedQuote.leadId)
                              ?.callerPhone
                          : "") || "",
                        "New Opportunity Intake",
                      )
                    }
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* Section 2: Lane Dynamics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Origin Card */}
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] flex items-center gap-3">
                <MapPin className="w-4 h-4" /> Origin Matrix
              </h3>
              <div className="bg-[#020617]/50 border border-white/5 rounded-3xl p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="qmCityHub"
                      className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1"
                    >
                      City Hub
                    </label>
                    <input
                      id="qmCityHub"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none focus:border-blue-500/50 transition-all font-mono tracking-tight"
                      placeholder="CHICAGO"
                      value={selectedQuote?.pickup?.city || ""}
                      onChange={(e) =>
                        selectedQuote &&
                        setSelectedQuote({
                          ...selectedQuote,
                          pickup: {
                            ...selectedQuote.pickup,
                            city: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="qmStateProv"
                      className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1"
                    >
                      State / Prov
                    </label>
                    <input
                      id="qmStateProv"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none focus:border-blue-500/50 transition-all font-mono"
                      placeholder="IL"
                      maxLength={2}
                      value={selectedQuote?.pickup?.state || ""}
                      onChange={(e) =>
                        selectedQuote &&
                        setSelectedQuote({
                          ...selectedQuote,
                          pickup: {
                            ...selectedQuote.pickup,
                            state: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Destination Card */}
            <div className="space-y-6">
              <h3 className="text-[10px] font-black text-purple-500 uppercase tracking-[0.3em] flex items-center gap-3">
                <Target className="w-4 h-4" /> Destination Matrix
              </h3>
              <div className="bg-[#020617]/50 border border-white/5 rounded-3xl p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="qmCityHub2"
                      className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1"
                    >
                      City Hub
                    </label>
                    <input
                      id="qmCityHub2"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none focus:border-purple-500/50 transition-all font-mono tracking-tight"
                      placeholder="DALLAS"
                      value={selectedQuote?.dropoff?.city || ""}
                      onChange={(e) =>
                        selectedQuote &&
                        setSelectedQuote({
                          ...selectedQuote,
                          dropoff: {
                            ...selectedQuote.dropoff,
                            city: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="qmStateProv2"
                      className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1"
                    >
                      State / Prov
                    </label>
                    <input
                      id="qmStateProv2"
                      className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-xs text-white font-bold outline-none focus:border-purple-500/50 transition-all font-mono"
                      placeholder="TX"
                      maxLength={2}
                      value={selectedQuote?.dropoff?.state || ""}
                      onChange={(e) =>
                        selectedQuote &&
                        setSelectedQuote({
                          ...selectedQuote,
                          dropoff: {
                            ...selectedQuote.dropoff,
                            state: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5" />

          {/* Section 3: Operational Requirements */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-2">
              <label
                htmlFor="qmEquipmentConfiguration"
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
              >
                Equipment Configuration
              </label>
              <select
                id="qmEquipmentConfiguration"
                className="w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-xs text-white font-bold outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer hover:border-white/20"
                value={selectedQuote?.equipmentType || "Dry Van"}
                onChange={(e) =>
                  selectedQuote &&
                  setSelectedQuote({
                    ...selectedQuote,
                    equipmentType: e.target.value as any,
                  })
                }
              >
                <option value="Dry Van">53' DRY VAN (Standard)</option>
                <option value="Reefer">TEMPERATURE CONTROLLED (Reefer)</option>
                <option value="Flatbed">OPEN DECK / FLATBED</option>
                <option value="Intermodal">INTERMODAL / CONTAINER</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label
                htmlFor="qmMissionNotesRiskFactors"
                className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1"
              >
                Mission Notes / Risk Factors
              </label>
              <input
                id="qmMissionNotesRiskFactors"
                className="w-full bg-[#020617] border border-white/10 rounded-2xl px-5 py-4 text-xs text-white font-bold outline-none focus:border-blue-500/50 transition-all placeholder:text-slate-800"
                placeholder="Specify high-value cargo, appointments, or specialized handling..."
                value={selectedQuote?.notes || ""}
                onChange={(e) =>
                  selectedQuote &&
                  setSelectedQuote({
                    ...selectedQuote,
                    notes: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex justify-end items-center gap-8 pt-6">
          <button
            onClick={onDiscard}
            className="px-8 py-4 text-[11px] font-black text-slate-500 hover:text-red-400 uppercase tracking-[0.3em] transition-all hover:translate-x-[-4px]"
          >
            Discard Entry
          </button>
          <button
            onClick={() => {
              if (selectedQuote) {
                onSaveAndReveal(selectedQuote);
              }
            }}
            disabled={isSubmitting}
            className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-4 group disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {isSubmitting ? "Saving..." : "Initialize & Engineering Reveal"}
          </button>
        </div>
      </div>
    </div>
  );
};
