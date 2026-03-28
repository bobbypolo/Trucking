import React, { useState, useEffect } from "react";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { Toast } from "./Toast";
import {
  User,
  Company,
  Quote,
  QuoteStatus,
  Lead,
  Booking,
  WorkItem,
  Capability,
  DutyMode,
  PrimaryWorkspace,
  CapabilityPermission,
  FreightType,
} from "../types";
import {
  getQuotes,
  saveQuote,
  getLeads,
  saveLead,
  getBookings,
  saveBooking,
  getWorkItems,
  saveWorkItem,
} from "../services/storageService";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  DollarSign,
  User as UserIcon,
  Building2,
  MapPin,
  ChevronRight,
  X,
  Sparkles,
  Phone,
  Mail,
  ClipboardList,
  Target,
  Zap,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { checkCapability } from "../services/authService";

interface Props {
  user: User;
  company: Company | null;
}

export const QuoteManager: React.FC<Props> = ({ user, company }) => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [percentDriverPay, setPercentDriverPay] = useState(true);

  const [activeView, setActiveView] = useState<
    "pipeline" | "details" | "intake"
  >("pipeline");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);

  useEffect(() => {
    loadData();
  }, [user.companyId]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [q, l, b, w] = await Promise.all([
        getQuotes(),
        getLeads(user.companyId),
        getBookings(user.companyId),
        getWorkItems(user.companyId),
      ]);
      setQuotes(q);
      setLeads(l);
      setBookings(b);
      setWorkItems(w);
    } catch (error) {
      setError("Unable to load pipeline data. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  const statuses: QuoteStatus[] = [
    "Draft",
    "Sent",
    "Negotiating",
    "Accepted",
    "Declined",
    "Expired",
  ];

  const getQuoteColor = (status: QuoteStatus) => {
    switch (status) {
      case "Draft":
        return "bg-slate-500";
      case "Sent":
        return "bg-blue-500";
      case "Negotiating":
        return "bg-purple-500";
      case "Accepted":
        return "bg-emerald-500";
      case "Declined":
        return "bg-red-500";
      case "Expired":
        return "bg-orange-500";
      default:
        return "bg-slate-500";
    }
  };

  const canViewMargin = checkCapability(
    user,
    "QUOTE_VIEW_MARGIN",
    undefined,
    company || undefined,
  );
  const canEditQuote = checkCapability(
    user,
    "QUOTE_EDIT",
    undefined,
    company || undefined,
  );

  const handleCreateQuote = () => {
    if (!canEditQuote) return;
    const newQuote: Quote = {
      id: uuidv4(),
      companyId: user.companyId,
      status: "Draft",
      pickup: { city: "", state: "" },
      dropoff: { city: "", state: "" },
      equipmentType: "Dry Van",
      linehaul: 0,
      fuelSurcharge: 0,
      accessorials: [],
      totalRate: 0,
      version: 1,
      validUntil: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      ownerId: user.id,
      createdAt: new Date().toISOString(),
      // Financial Defaults
      discount: 0,
      commission: 0,
      estimatedDriverPay: 0,
      companyCostFactor: 50,
    };
    setSelectedQuote(newQuote);
    setActiveView("details");
  };

  const validateQuoteForm = (data: Quote): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!data.pickup?.city?.trim()) errs.pickupCity = "Pickup city is required";
    if (!data.dropoff?.city?.trim())
      errs.dropoffCity = "Dropoff city is required";
    if (!data.totalRate || data.totalRate <= 0) errs.rate = "Rate is required";
    return errs;
  };

  const isSelectedQuoteValid = selectedQuote
    ? !!selectedQuote.pickup?.city?.trim() &&
      !!selectedQuote.dropoff?.city?.trim() &&
      !!selectedQuote.totalRate &&
      selectedQuote.totalRate > 0
    : false;

  const handleSaveQuote = async (data: Quote) => {
    const errs = validateQuoteForm(data);
    if (Object.keys(errs).length > 0) {
      setQuoteErrors(errs);
      return;
    }
    setQuoteErrors({});
    setIsSubmitting(true);
    try {
      await saveQuote(data);
      await loadData();
      setActiveView("pipeline");
      setSelectedQuote(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConvert = async (quote: Quote) => {
    if (quote.status !== "Accepted") return;
    setIsSubmitting(true);
    try {
      // Use the canonical conversion endpoint that atomically creates
      // both a booking AND an operational load in a single transaction.
      // Quote financial estimates (driver pay, margin) are NOT passed —
      // the load starts with driver_pay = 0 until settlement is created.
      const { api } = await import("../services/api");
      await api.post("/bookings/convert", {
        quote_id: quote.id,
        customer_id: null,
        status: "Confirmed",
        pickup_date: quote.validUntil ?? null,
        delivery_date: null,
        notes: quote.notes ?? null,
        load_number: `LD-${Date.now()}`,
        freight_type: quote.equipmentType ?? null,
        carrier_rate: quote.totalRate ?? 0,
      });

      await loadData();
      setSelectedQuote(null);
      setActiveView("pipeline");
      setToast({
        message: "Quote converted to booking with operational load created.",
        type: "success",
      });
    } catch (err) {
      setToast({
        message: "Failed to convert quote. Please try again.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnterIntake = () => {
    // Always start with a fresh blank quote for intake to ensure inputs work
    const blankQuote: Quote = {
      id: uuidv4(),
      companyId: user.companyId,
      status: "Draft",
      version: 1,
      ownerId: user.id,
      validUntil: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      createdAt: new Date().toISOString(),
      pickup: { city: "", state: "" },
      dropoff: { city: "", state: "" },
      equipmentType: "Dry Van",
      linehaul: 0,
      fuelSurcharge: 0,
      accessorials: [],
      totalRate: 0,
      discount: 0,
      commission: 0,
      estimatedDriverPay: 0,
      companyCostFactor: 50,
    };
    setSelectedQuote(blankQuote);
    setActiveView("intake");
  };

  const handlePhoneInteraction = async (
    phoneNumber: string,
    context: string,
  ) => {
    // Log the call attempt (non-blocking — don't prevent dialer if logging fails)
    try {
      const { api } = await import("../services/api");
      await api.post("/call-logs", {
        phoneNumber,
        context,
        direction: "outbound",
      });
    } catch (err) {
      console.warn("Failed to log call:", err);
    }
    // Open system dialer
    window.location.href = `tel:${phoneNumber}`;
  };

  const handleQuickCreate = (status: QuoteStatus) => {
    const newQuote: Quote = {
      id: uuidv4(),
      companyId: user.companyId,
      status: status,
      pickup: { city: "", state: "" },
      dropoff: { city: "", state: "" },
      equipmentType: "Dry Van",
      linehaul: 0,
      fuelSurcharge: 0,
      accessorials: [],
      totalRate: 0,
      version: 1,
      validUntil: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      ownerId: user.id,
      createdAt: new Date().toISOString(),
    };
    setSelectedQuote(newQuote);
    setActiveView("details");
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      {/* Header */}
      <div className="px-8 py-6 bg-slate-900 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">
              Intake & Quotes
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mt-1">
              Lead Lifecycle & Revenue Conversion
            </p>
          </div>
          <div className="h-8 w-px bg-white/5 mx-2" />
          <div className="flex bg-slate-950 rounded-xl p-1 border border-white/5">
            <button
              onClick={() => setActiveView("pipeline")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "pipeline" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
            >
              Pipeline View
            </button>
            <button
              onClick={handleEnterIntake}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeView === "intake" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
            >
              Intake Desk
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              aria-label="Find Quote or Lane..."
              type="text"
              placeholder="Find Quote or Lane..."
              className="bg-slate-950 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-blue-500/50 w-64 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={handleCreateQuote}
            className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> New Quote
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden">
        {/* Loading skeleton while fetching */}
        {loading && (
          <div className="p-8">
            <LoadingSkeleton variant="list" count={6} />
          </div>
        )}

        {/* Error state with retry */}
        {!loading && error && <ErrorState message={error} onRetry={loadData} />}

        {activeView === "pipeline" && !loading && !error && (
          <div className="h-full flex gap-6 p-8 overflow-x-auto no-scrollbar">
            {statuses.map((status) => (
              <div key={status} className="w-80 shrink-0 flex flex-col gap-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getQuoteColor(status)}`}
                    />
                    {status}
                    <span className="text-slate-500 ml-1 text-[9px] font-bold">
                      ({quotes.filter((q) => q.status === status).length})
                    </span>
                  </h3>
                  <button
                    onClick={() => handleQuickCreate(status)}
                    className="text-slate-600 hover:text-white transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-10">
                  {quotes
                    .filter((q) => q.status === status)
                    .filter(
                      (q) =>
                        (q.pickup?.city ?? "")
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) ||
                        (q.dropoff?.city ?? "")
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()),
                    )
                    .map((quote) => (
                      <div
                        key={quote.id}
                        onClick={() => {
                          setSelectedQuote(quote);
                          setActiveView("details");
                        }}
                        className="bg-slate-900 border border-white/5 rounded-2xl p-5 hover:border-blue-500/40 hover:bg-slate-800/40 cursor-pointer transition-all group animate-in fade-in slide-in-from-left-2 shadow-lg"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                              {quote.equipmentType}
                            </div>
                            <div className="text-sm font-black text-white uppercase tracking-tighter group-hover:text-blue-400 transition-colors">
                              {quote.pickup?.city ?? ""},{" "}
                              {quote.pickup?.state ?? ""} →{" "}
                              {quote.dropoff?.city ?? ""},{" "}
                              {quote.dropoff?.state ?? ""}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-base font-black text-emerald-500 tracking-tighter">
                              ${(quote.totalRate ?? 0).toLocaleString()}
                            </div>
                            {quote.margin && (
                              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                Est. Margin: ${quote.margin}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-slate-950 border border-white/5 flex items-center justify-center text-[8px] font-black text-slate-500">
                              {quote.ownerId?.charAt(0) || "A"}
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">
                              Last Contact: 2m ago
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-600" />
                            <span className="text-[8px] font-bold text-slate-600 uppercase">
                              v{quote.version}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  {quotes.filter((q) => q.status === status).length === 0 && (
                    <div className="h-32 border-2 border-dashed border-white/5 rounded-2xl flex items-center justify-center">
                      <span className="text-[9px] font-black text-slate-700 uppercase tracking-[0.2em]">
                        No quotes
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeView === "details" && selectedQuote && (
          <div className="h-full bg-slate-950 animate-in slide-in-from-right-4 duration-300 flex">
            <div className="flex-1 flex flex-col min-w-0">
              {/* Detail Header */}
              <div className="px-10 py-8 bg-slate-900 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <button
                    onClick={() => {
                      setActiveView("pipeline");
                      setSelectedQuote(null);
                    }}
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
                      onClick={() => handleConvert(selectedQuote)}
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
                                value={
                                  selectedQuote.dropoff?.facilityName || ""
                                }
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
                                value={
                                  (selectedQuote.validUntil ?? "").split("T")[0]
                                }
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
                                    equipmentType: e.target
                                      .value as FreightType,
                                  })
                                }
                              >
                                <option value="Dry Van">Dry Van Service</option>
                                <option value="Reefer">
                                  Temperature Controlled
                                </option>
                                <option value="Intermodal">
                                  Intermodal / drayage
                                </option>
                                <option value="Flatbed">
                                  Open Deck / Flatbed
                                </option>
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
                              <div className="text-[9px] font-bold text-slate-500 uppercase">
                                Gross: $
                                {(
                                  selectedQuote.linehaul +
                                  selectedQuote.fuelSurcharge
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
                                    const fsc =
                                      selectedQuote.fuelSurcharge || 0;
                                    const disc = selectedQuote.discount || 0;
                                    const driverPay = percentDriverPay
                                      ? lh * 0.7
                                      : selectedQuote.estimatedDriverPay || 0;
                                    const comm =
                                      selectedQuote.commission || lh * 0.1;

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
                                <span className="absolute right-3 top-[-8px] bg-slate-900 px-1 text-[8px] font-bold text-slate-500">
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
                                <span className="absolute right-3 top-[-8px] bg-slate-900 px-1 text-[8px] font-bold text-slate-500">
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
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-red-500/50 uppercase">
                                Discount
                              </span>
                            </div>
                          </div>

                          <div className="h-px bg-white/5" />

                          {/* Cost Breakdown */}
                          <div className="space-y-3">
                            <label
                              htmlFor="qmCostStructure"
                              className="text-[9px] text-slate-500 font-black uppercase tracking-widest ml-1"
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
                                $
                                {(
                                  selectedQuote.totalRate ?? 0
                                ).toLocaleString()}
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
                            onClick={() => handleSaveQuote(selectedQuote)}
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
                                <div className="text-[9px] text-slate-600 font-bold uppercase mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                                  {item.description}
                                </div>
                              </div>
                              <button
                                onClick={() =>
                                  setToast({
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
                        {workItems.filter(
                          (i) => i.entityId === selectedQuote.id,
                        ).length === 0 && (
                          <div className="py-4 text-center">
                            <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">
                              No Active Work Items
                            </span>
                          </div>
                        )}
                        <button
                          onClick={async () => {
                            const newItem: WorkItem = {
                              id: uuidv4(),
                              companyId: user.companyId,
                              type: "QUOTE_FOLLOWUP",
                              priority: "High",
                              label: "Scheduled Callback",
                              description:
                                "Follow up with customer regarding quote",
                              entityId: selectedQuote.id,
                              entityType: "Quote",
                              status: "Open",
                              createdAt: new Date().toISOString(),
                              dueDate: new Date(
                                Date.now() + 2 * 60 * 60 * 1000,
                              ).toISOString(), // +2 hours
                            };
                            await saveWorkItem(newItem);
                            loadData();
                          }}
                          className="w-full py-3 border border-dashed border-white/10 hover:border-blue-500/40 rounded-xl text-[9px] font-black text-slate-500 hover:text-blue-400 uppercase tracking-widest transition-all flex items-center justify-center gap-2"
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
                      <span className="text-[8px] font-bold text-slate-600">
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
                      <span className="text-[8px] font-bold text-slate-600">
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
                        handlePhoneInteraction(phone, "Quote Detail");
                      }
                    }}
                    disabled={
                      !selectedQuote?.leadId ||
                      !leads.find((l) => l.id === selectedQuote?.leadId)
                        ?.callerPhone
                    }
                    title={
                      !selectedQuote?.leadId ||
                      !leads.find((l) => l.id === selectedQuote?.leadId)
                        ?.callerPhone
                        ? "No phone on file"
                        : undefined
                    }
                    className="flex-1 py-3 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 text-[9px] font-black uppercase rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-600/10 disabled:hover:text-blue-500"
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
        )}

        {activeView === "intake" && (
          <div className="h-full flex flex-col bg-slate-950 p-8 animate-in fade-in duration-500 overflow-y-auto no-scrollbar">
            {/* 
                            DESIGN STANDARD: INTAKE & QUOTE FORMS (Template Example)
                            -------------------------------------------------------
                            - TYPOGRAPHY: Labels (10px, black, uppercase, 0.2em tracking), Inputs (12px, bold, white).
                            - INPUT STYLING: Background (#020617), Border (white/10), Radius (xl), Glow on Focus.
                            - BUTTON STYLING: Professional weight (black), High tracking, Primary Blue shadow glow.
                            - LAYOUT: High-density grids (md:grid-cols-3) to maximize information visibility.
                        */}

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
                    High-Density Command Lead Entry • v
                    {selectedQuote?.version || 1}
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
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />{" "}
                    Identity & Source
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
                            handlePhoneInteraction(
                              (selectedQuote?.leadId
                                ? leads.find(
                                    (l) => l.id === selectedQuote.leadId,
                                  )?.callerPhone
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
                      <option value="Reefer">
                        TEMPERATURE CONTROLLED (Reefer)
                      </option>
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
                  onClick={() => {
                    setActiveView("pipeline");
                    setSelectedQuote(null);
                  }}
                  className="px-8 py-4 text-[11px] font-black text-slate-500 hover:text-red-400 uppercase tracking-[0.3em] transition-all hover:translate-x-[-4px]"
                >
                  Discard Entry
                </button>
                <button
                  onClick={async () => {
                    if (selectedQuote) {
                      setIsSubmitting(true);
                      try {
                        const quoteWithFinancials = {
                          ...selectedQuote,
                          discount: 0,
                          commission: selectedQuote.linehaul * 0.1,
                          estimatedDriverPay: selectedQuote.linehaul * 0.7,
                          companyCostFactor: 50,
                          status: "Draft" as QuoteStatus,
                        };
                        await saveQuote(quoteWithFinancials);
                        await loadData();
                        setSelectedQuote(quoteWithFinancials);
                        setActiveView("details");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }
                  }}
                  disabled={isSubmitting}
                  className="px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black uppercase tracking-[0.3em] rounded-2xl shadow-2xl shadow-blue-500/30 transition-all active:scale-95 flex items-center gap-4 group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  {isSubmitting
                    ? "Saving..."
                    : "Initialize & Engineering Reveal"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
