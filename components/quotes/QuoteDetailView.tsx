import React from "react";
import { Quote, QuoteStatus, Lead, WorkItem, FreightType } from "../../types";
import {
  ArrowRight,
  FileText,
  Send,
  Zap,
  Clock,
  CheckCircle2,
  Phone,
  MoreHorizontal,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { saveWorkItem } from "../../services/storageService";

interface QuoteDetailViewProps {
  selectedQuote: Quote;
  setSelectedQuote: React.Dispatch<React.SetStateAction<Quote | null>>;
  leads: Lead[];
  workItems: WorkItem[];
  quoteErrors: Record<string, string>;
  isSubmitting: boolean;
  isSelectedQuoteValid: boolean;
  percentDriverPay: boolean;
  setPercentDriverPay: React.Dispatch<React.SetStateAction<boolean>>;
  getQuoteColor: (status: QuoteStatus) => string;
  onSaveQuote: (data: Quote) => Promise<void>;
  onConvert: (quote: Quote) => Promise<void>;
  onPhoneInteraction: (phoneNumber: string, context: string) => Promise<void>;
  onBackToPipeline: () => void;
  onAddWorkItem: (item: WorkItem) => Promise<void>;
  onLoadData: () => Promise<void>;
  onToast: (
    toast: { message: string; type: "success" | "error" | "info" } | null,
  ) => void;
}

export const QuoteDetailView: React.FC<QuoteDetailViewProps> = ({
  selectedQuote,
  setSelectedQuote,
  leads,
  workItems,
  quoteErrors,
  isSubmitting,
  isSelectedQuoteValid,
  percentDriverPay,
  setPercentDriverPay,
  getQuoteColor,
  onSaveQuote,
  onConvert,
  onPhoneInteraction,
  onBackToPipeline,
  onLoadData,
  onToast,
}) => {
  return (
    <div className="h-full bg-slate-950 animate-in slide-in-from-right-4 duration-300 flex">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Detail Header */}
        <div className="px-10 py-8 bg-slate-900 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={onBackToPipeline}
              className="p-3 bg-slate-950 border border-white/5 rounded-xl text-slate-500 hover:text-white transition-all"
            >
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                  Quote Review
                </h2>
                <div
                  className={`px-3 py-1 rounded-full ${getQuoteColor(selectedQuote.status)}/10 border border-${getQuoteColor(selectedQuote.status)}/20`}
                >
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest text-${getQuoteColor(selectedQuote.status).replace("bg-", "")}`}
                  >
                    {selectedQuote.status}
                  </span>
                </div>
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
                Transaction ID: {selectedQuote.id.split("-")[0]}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              disabled
              title="Feature not yet available"
              className="bg-slate-950 border border-white/5 text-slate-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest opacity-50 cursor-not-allowed flex items-center gap-2"
            >
              <FileText className="w-4 h-4" /> Version History
            </button>
            <button
              disabled
              title="Feature not yet available"
              className="bg-slate-950 border border-white/5 text-slate-500 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest opacity-50 cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Send Update
            </button>
            {selectedQuote.status === "Accepted" && (
              <button
                onClick={() => onConvert(selectedQuote)}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Zap className="w-4 h-4 fill-current" />{" "}
                {isSubmitting ? "Converting..." : "Convert to Load"}
              </button>
            )}
          </div>
        </div>

        {/* Deep Editing Space */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-10 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left: Lane & Requirements */}
            <div className="lg:col-span-2 space-y-10">
              <section className="space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />{" "}
                  Operational Matrix
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 text-blue-500 font-black text-xs uppercase">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center font-black">
                        A
                      </div>{" "}
                      ORIGIN HUB
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="qmFacilityDesignation"
                          className="text-[10px] text-slate-600 font-black uppercase mb-1.5 block"
                        >
                          Facility Designation
                        </label>
                        <input
                          id="qmFacilityDesignation"
                          className="w-full bg-slate-950 border border-white/5 rounded-xl p-3.5 text-sm text-white font-black uppercase tracking-tight"
                          placeholder="Location Alpha"
                          value={selectedQuote.pickup?.facilityName || ""}
                          onChange={(e) =>
                            setSelectedQuote({
                              ...selectedQuote,
                              pickup: {
                                ...selectedQuote.pickup,
                                facilityName: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input
                            aria-label="City"
                            className={`w-full bg-slate-950 border ${quoteErrors.pickupCity ? "border-red-500" : "border-white/5"} rounded-xl p-3.5 text-sm text-white font-black uppercase`}
                            placeholder="City *"
                            value={selectedQuote.pickup?.city ?? ""}
                            onChange={(e) =>
                              setSelectedQuote({
                                ...selectedQuote,
                                pickup: {
                                  ...selectedQuote.pickup,
                                  city: e.target.value,
                                },
                              })
                            }
                          />
                          {quoteErrors.pickupCity && (
                            <p className="text-red-400 text-xs mt-1">
                              {quoteErrors.pickupCity}
                            </p>
                          )}
                        </div>
                        <input
                          aria-label="State"
                          className="bg-slate-950 border border-white/5 rounded-xl p-3.5 text-sm text-white font-black uppercase"
                          placeholder="State"
                          value={selectedQuote.pickup?.state ?? ""}
                          onChange={(e) =>
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
                  <div className="bg-slate-900 border border-white/5 rounded-3xl p-8 space-y-6 shadow-xl">
                    <div className="flex items-center gap-3 text-purple-500 font-black text-xs uppercase">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center font-black">
                        B
                      </div>{" "}
                      DESTINATION HUB
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="qmFacilityDesignation2"
                          className="text-[10px] text-slate-600 font-black uppercase mb-1.5 block"
                        >
                          Facility Designation
                        </label>
                        <input
                          id="qmFacilityDesignation2"
                          className="w-full bg-slate-950 border border-white/5 rounded-xl p-3.5 text-sm text-white font-black uppercase tracking-tight"
                          placeholder="Location Omega"
                          value={selectedQuote.dropoff?.facilityName || ""}
                          onChange={(e) =>
                            setSelectedQuote({
                              ...selectedQuote,
                              dropoff: {
                                ...selectedQuote.dropoff,
                                facilityName: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <input
                            aria-label="City"
                            className={`w-full bg-slate-950 border ${quoteErrors.dropoffCity ? "border-red-500" : "border-white/5"} rounded-xl p-3.5 text-sm text-white font-black uppercase`}
                            placeholder="City *"
                            value={selectedQuote.dropoff?.city ?? ""}
                            onChange={(e) =>
                              setSelectedQuote({
                                ...selectedQuote,
                                dropoff: {
                                  ...selectedQuote.dropoff,
                                  city: e.target.value,
                                },
                              })
                            }
                          />
                          {quoteErrors.dropoffCity && (
                            <p className="text-red-400 text-xs mt-1">
                              {quoteErrors.dropoffCity}
                            </p>
                          )}
                        </div>
                        <input
                          aria-label="State"
                          className="bg-slate-950 border border-white/5 rounded-xl p-3.5 text-sm text-white font-black uppercase"
                          placeholder="State"
                          value={selectedQuote.dropoff?.state ?? ""}
                          onChange={(e) =>
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
              </section>

              <section className="space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                  Strategic Assumptions
                </h3>
                <div className="bg-slate-900 border border-white/5 rounded-[2rem] p-8 shadow-xl space-y-6">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label
                        htmlFor="qmValidThrough"
                        className="text-[10px] text-slate-500 font-black uppercase tracking-widest block"
                      >
                        Valid Through
                      </label>
                      <div className="flex items-center gap-4">
                        <Clock className="w-5 h-5 text-blue-500" />
                        <input
                          id="qmValidThrough"
                          type="date"
                          className="flex-1 bg-slate-950 border border-white/5 rounded-xl p-4 text-sm text-white font-black outline-none focus:border-blue-500/50 transition-all"
                          value={(selectedQuote.validUntil ?? "").split("T")[0]}
                          onChange={(e) =>
                            setSelectedQuote({
                              ...selectedQuote,
                              validUntil: new Date(
                                e.target.value,
                              ).toISOString(),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label
                        htmlFor="qmEquipmentProfile"
                        className="text-[10px] text-slate-500 font-black uppercase tracking-widest block"
                      >
                        Equipment Profile
                      </label>
                      <div className="flex items-center gap-4">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        <select
                          id="qmEquipmentProfile"
                          className="flex-1 bg-slate-950 border border-white/5 rounded-xl p-4 text-sm text-white font-black outline-none appearance-none"
                          value={selectedQuote.equipmentType}
                          onChange={(e) =>
                            setSelectedQuote({
                              ...selectedQuote,
                              equipmentType: e.target.value as FreightType,
                            })
                          }
                        >
                          <option value="Dry Van">Dry Van Service</option>
                          <option value="Reefer">Temperature Controlled</option>
                          <option value="Intermodal">
                            Intermodal / drayage
                          </option>
                          <option value="Flatbed">Open Deck / Flatbed</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label
                      htmlFor="qmContractualConstraintsNotes"
                      className="text-[10px] text-slate-500 font-black uppercase tracking-widest block"
                    >
                      Contractual Constraints / Notes
                    </label>
                    <textarea
                      id="qmContractualConstraintsNotes"
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl p-6 text-sm text-white font-bold h-32 outline-none focus:border-blue-500/50 transition-all no-scrollbar"
                      placeholder="Specify any equipment age requirements, insurance mandates, or special handling instructions..."
                      value={selectedQuote.notes || ""}
                      onChange={(e) =>
                        setSelectedQuote({
                          ...selectedQuote,
                          notes: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-10">
              <section className="space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />{" "}
                  Commercial Estimates (Non-Binding)
                </h3>
                <div className="bg-slate-900 border border-yellow-500/20 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                  <div className="space-y-6 relative z-10">
                    {/* Top Line Revenue */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] text-yellow-500 font-black uppercase tracking-[0.3em] ml-1">
                          Linehaul & Revenue
                        </label>
                        <div className="text-[11px] font-bold text-slate-500 uppercase">
                          Gross: $
                          {(
                            selectedQuote.linehaul + selectedQuote.fuelSurcharge
                          ).toLocaleString()}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative group">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-600">
                            $
                          </span>
                          <input
                            aria-label="Linehaul"
                            type="number"
                            className={`w-full bg-slate-950 border ${quoteErrors.rate ? "border-red-500" : "border-white/10"} rounded-xl pl-8 pr-4 py-3 text-lg font-black text-white outline-none focus:border-yellow-500/50 transition-all font-mono`}
                            placeholder="Linehaul *"
                            value={selectedQuote.linehaul}
                            onChange={(e) => {
                              const lh = parseFloat(e.target.value) || 0;
                              const fsc = selectedQuote.fuelSurcharge || 0;
                              const disc = selectedQuote.discount || 0;
                              const driverPay = percentDriverPay
                                ? lh * 0.7
                                : selectedQuote.estimatedDriverPay || 0;
                              const comm = selectedQuote.commission || lh * 0.1;

                              const net = lh + fsc - disc;
                              const margin =
                                net -
                                (driverPay +
                                  comm +
                                  (selectedQuote.companyCostFactor || 0));

                              setSelectedQuote({
                                ...selectedQuote,
                                linehaul: lh,
                                estimatedDriverPay: driverPay,
                                commission: comm,
                                totalRate: net,
                                margin: margin,
                              });
                            }}
                          />
                          <span className="absolute right-3 top-[-8px] bg-slate-900 px-1 text-[10px] font-bold text-slate-500">
                            BASE
                          </span>
                          {quoteErrors.rate && (
                            <p className="text-red-400 text-xs mt-1">
                              {quoteErrors.rate}
                            </p>
                          )}
                        </div>
                        <div className="relative group">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-600">
                            $
                          </span>
                          <input
                            aria-label="FSC"
                            type="number"
                            className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-lg font-black text-white outline-none focus:border-yellow-500/50 transition-all font-mono"
                            placeholder="FSC"
                            value={selectedQuote.fuelSurcharge}
                            onChange={(e) => {
                              const fsc = parseFloat(e.target.value) || 0;
                              const lh = selectedQuote.linehaul || 0;
                              const disc = selectedQuote.discount || 0;
                              const net = lh + fsc - disc;
                              const cost =
                                (selectedQuote.estimatedDriverPay || 0) +
                                (selectedQuote.commission || 0) +
                                (selectedQuote.companyCostFactor || 0);

                              setSelectedQuote({
                                ...selectedQuote,
                                fuelSurcharge: fsc,
                                totalRate: net,
                                margin: net - cost,
                              });
                            }}
                          />
                          <span className="absolute right-3 top-[-8px] bg-slate-900 px-1 text-[10px] font-bold text-slate-500">
                            FUEL
                          </span>
                        </div>
                      </div>

                      {/* Adjustments */}
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-red-500/50">
                          - $
                        </span>
                        <input
                          aria-label="Disconnect / Adjustment"
                          type="number"
                          className="w-full bg-slate-950/50 border border-red-500/10 rounded-xl pl-8 pr-4 py-2 text-sm font-bold text-red-400 outline-none focus:border-red-500/50 transition-all font-mono"
                          placeholder="Disconnect / Adjustment"
                          value={selectedQuote.discount || ""}
                          onChange={(e) => {
                            const disc = parseFloat(e.target.value) || 0;
                            const lh = selectedQuote.linehaul || 0;
                            const fsc = selectedQuote.fuelSurcharge || 0;
                            const net = lh + fsc - disc;
                            const cost =
                              (selectedQuote.estimatedDriverPay || 0) +
                              (selectedQuote.commission || 0) +
                              (selectedQuote.companyCostFactor || 0);
                            setSelectedQuote({
                              ...selectedQuote,
                              discount: disc,
                              totalRate: net,
                              margin: net - cost,
                            });
                          }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-red-500/50 uppercase">
                          Discount
                        </span>
                      </div>
                    </div>

                    <div className="h-px bg-white/5" />

                    {/* Cost Breakdown */}
                    <div className="space-y-3">
                      <label
                        htmlFor="qmCostStructure"
                        className="text-[11px] text-slate-500 font-black uppercase tracking-widest ml-1"
                      >
                        Cost Structure
                      </label>
                      <div className="bg-slate-950/50 rounded-xl p-4 space-y-3 border border-white/5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-400">
                            Driver Pay (Est.)
                          </span>
                          <input
                            id="qmCostStructure"
                            type="number"
                            className="w-24 bg-transparent text-right font-mono font-bold text-white border-b border-dashed border-slate-700 outline-none focus:border-blue-500 p-1"
                            value={selectedQuote.estimatedDriverPay || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const net = selectedQuote.totalRate;
                              const cost =
                                val +
                                (selectedQuote.commission || 0) +
                                (selectedQuote.companyCostFactor || 0);
                              setSelectedQuote({
                                ...selectedQuote,
                                estimatedDriverPay: val,
                                margin: net - cost,
                              });
                              setPercentDriverPay(false);
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-400">
                            Sales Commission
                          </span>
                          <input
                            aria-label="Sales commission"
                            type="number"
                            className="w-24 bg-transparent text-right font-mono font-bold text-white border-b border-dashed border-slate-700 outline-none focus:border-blue-500 p-1"
                            value={selectedQuote.commission || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const net = selectedQuote.totalRate;
                              const cost =
                                (selectedQuote.estimatedDriverPay || 0) +
                                val +
                                (selectedQuote.companyCostFactor || 0);
                              setSelectedQuote({
                                ...selectedQuote,
                                commission: val,
                                margin: net - cost,
                              });
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-400">
                            Fixed Overhead
                          </span>
                          <span className="font-mono font-bold text-slate-500">
                            ${selectedQuote.companyCostFactor}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Line */}
                    <div className="pt-6 border-t border-white/10 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Estimated Net Revenue
                        </span>
                        <span className="text-xl font-black text-white tracking-tighter">
                          ${(selectedQuote.totalRate ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                          Projected Margin
                        </span>
                        <span className="text-3xl font-black text-emerald-400 tracking-tighter">
                          ${(selectedQuote.margin || 0).toLocaleString()}
                          <span className="text-sm text-emerald-600/70 ml-1">
                            (
                            {(
                              ((selectedQuote.margin || 0) /
                                (selectedQuote.totalRate || 1)) *
                              100
                            ).toFixed(1)}
                            %)
                          </span>
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => onSaveQuote(selectedQuote)}
                      disabled={isSubmitting || !isSelectedQuoteValid}
                      className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-black uppercase tracking-[0.3em] text-[10px] shadow-lg hover:shadow-yellow-500/20 active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Saving..." : "Save & Update"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-3 px-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />{" "}
                  Active Triage
                </h3>
                <div className="bg-slate-900 border border-white/5 rounded-[2rem] p-6 space-y-4">
                  {workItems
                    .filter((i) => i.entityId === selectedQuote.id)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-4 bg-slate-950 border border-white/5 rounded-2xl group"
                      >
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center border ${item.priority === "High" ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-blue-500/10 border-blue-500/20 text-blue-500"}`}
                        >
                          <Zap className="w-5 h-5 fill-current" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-black text-white uppercase truncate">
                            {item.label}
                          </div>
                          <div className="text-[11px] text-slate-600 font-bold uppercase mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                            {item.description}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            onToast({
                              message: `Work item "${item.label}" marked complete`,
                              type: "success",
                            })
                          }
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:text-white transition-all"
                          aria-label="Mark as complete"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  {workItems.filter((i) => i.entityId === selectedQuote.id)
                    .length === 0 && (
                    <div className="py-4 text-center">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                        No Active Work Items
                      </span>
                    </div>
                  )}
                  <button
                    onClick={async () => {
                      const newItem: WorkItem = {
                        id: uuidv4(),
                        companyId: selectedQuote.companyId,
                        type: "QUOTE_FOLLOWUP",
                        priority: "High",
                        label: "Scheduled Callback",
                        description: "Follow up with customer regarding quote",
                        entityId: selectedQuote.id,
                        entityType: "Quote",
                        status: "Open",
                        createdAt: new Date().toISOString(),
                        dueDate: new Date(
                          Date.now() + 2 * 60 * 60 * 1000,
                        ).toISOString(),
                      };
                      await saveWorkItem(newItem);
                      onLoadData();
                    }}
                    className="w-full py-3 border border-dashed border-white/10 hover:border-blue-500/40 rounded-xl text-[11px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    <Clock className="w-3 h-3" /> Schedule Callback (+2h)
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* Comms Sidebar */}
      <div className="w-96 bg-slate-900 border-l border-white/5 flex flex-col shrink-0">
        <div className="p-8 border-b border-white/5">
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-500" /> Interaction Log
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-4">
            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  Incoming Call
                </span>
                <span className="text-[10px] font-bold text-slate-600">
                  Today, 2:45 PM
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-300">
                Negotiated higher linehaul for special handling.
              </p>
            </div>
            <div className="bg-slate-950 p-4 rounded-2xl border border-white/5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">
                  Email Sent
                </span>
                <span className="text-[10px] font-bold text-slate-600">
                  Jan 22, 10:15 AM
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-300">
                Quote Version 1 dispatched to client.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-slate-950/50 border-t border-white/5 space-y-4">
          <textarea
            aria-label="Quick note for call log..."
            className="w-full bg-slate-950 border border-white/5 rounded-xl p-4 text-xs text-white font-bold h-24 outline-none no-scrollbar"
            placeholder="Quick note for call log..."
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                const leadId = selectedQuote?.leadId;
                const phone = leadId
                  ? leads.find((l) => l.id === leadId)?.callerPhone
                  : undefined;
                if (phone) {
                  onPhoneInteraction(phone, "Quote Detail");
                }
              }}
              disabled={
                !selectedQuote?.leadId ||
                !leads.find((l) => l.id === selectedQuote?.leadId)?.callerPhone
              }
              title={
                !selectedQuote?.leadId ||
                !leads.find((l) => l.id === selectedQuote?.leadId)?.callerPhone
                  ? "No phone on file"
                  : undefined
              }
              className="flex-1 py-3 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 text-[11px] font-black uppercase rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600/10 disabled:hover:text-blue-500"
            >
              Log Contact
            </button>
            <button
              disabled
              title="Feature not yet available"
              className="p-3 bg-slate-800 text-slate-500 rounded-lg opacity-50 cursor-not-allowed"
              aria-label="More options (not yet available)"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
