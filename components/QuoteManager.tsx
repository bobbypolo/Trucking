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
} from "../types";
import {
  getQuotes,
  saveQuote,
  getLeads,
  getBookings,
  saveWorkItem,
  getWorkItems,
} from "../services/storageService";
import { Plus, Search } from "lucide-react";
import { v4 as uuidv4 } from "uuid";
import { checkCapability } from "../services/authService";
import { QuotePipelineView, QuoteDetailView, QuoteIntakeForm } from "./quotes";

interface Props {
  user: User;
  company: Company | null;
  onLoadCreated?: () => void;
}

export const QuoteManager: React.FC<Props> = ({
  user,
  company,
  onLoadCreated,
}) => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [percentDriverPay, setPercentDriverPay] = useState(true);

  const [activeView, setActiveView] = useState<
    "pipeline" | "details" | "intake"
  >("intake");
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
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [q, l, b, w] = await Promise.all([
          getQuotes(),
          getLeads(user.companyId),
          getBookings(user.companyId),
          getWorkItems(user.companyId),
        ]);
        if (controller.signal.aborted) return;
        setQuotes(q);
        setLeads(l);
        setBookings(b);
        setWorkItems(w);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setError("Unable to load pipeline data. Please retry.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    fetchData();
    return () => controller.abort();
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
        pickup_city: quote.pickup?.city ?? null,
        pickup_state: quote.pickup?.state ?? null,
        pickup_facility: quote.pickup?.facilityName ?? null,
        dropoff_city: quote.dropoff?.city ?? null,
        dropoff_state: quote.dropoff?.state ?? null,
        dropoff_facility: quote.dropoff?.facilityName ?? null,
      });

      await loadData();
      onLoadCreated?.();
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

  const handleSelectQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setActiveView("details");
  };

  const handleBackToPipeline = () => {
    setActiveView("pipeline");
    setSelectedQuote(null);
  };

  const handleAddWorkItem = async (item: WorkItem) => {
    await saveWorkItem(item);
    loadData();
  };

  const handleIntakeSaveAndReveal = async (quote: Quote) => {
    setIsSubmitting(true);
    try {
      const quoteWithFinancials = {
        ...quote,
        discount: 0,
        commission: quote.linehaul * 0.1,
        estimatedDriverPay: quote.linehaul * 0.7,
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
              onClick={handleEnterIntake}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeView === "intake" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
            >
              Intake Desk
            </button>
            <button
              onClick={() => setActiveView("pipeline")}
              className={`px-4 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${activeView === "pipeline" ? "bg-blue-600 text-white shadow-lg" : "text-slate-500 hover:text-slate-300"}`}
            >
              Pipeline View
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
        {loading && (
          <div className="p-8">
            <LoadingSkeleton variant="list" count={6} />
          </div>
        )}

        {!loading && error && <ErrorState message={error} onRetry={loadData} />}

        {activeView === "pipeline" && !loading && !error && (
          <QuotePipelineView
            quotes={quotes}
            searchQuery={searchQuery}
            statuses={statuses}
            getQuoteColor={getQuoteColor}
            onSelectQuote={handleSelectQuote}
            onQuickCreate={handleQuickCreate}
          />
        )}

        {activeView === "details" && selectedQuote && (
          <QuoteDetailView
            selectedQuote={selectedQuote}
            setSelectedQuote={setSelectedQuote}
            leads={leads}
            workItems={workItems}
            quoteErrors={quoteErrors}
            isSubmitting={isSubmitting}
            isSelectedQuoteValid={isSelectedQuoteValid}
            percentDriverPay={percentDriverPay}
            setPercentDriverPay={setPercentDriverPay}
            getQuoteColor={getQuoteColor}
            onSaveQuote={handleSaveQuote}
            onConvert={handleConvert}
            onPhoneInteraction={handlePhoneInteraction}
            onBackToPipeline={handleBackToPipeline}
            onAddWorkItem={handleAddWorkItem}
            onLoadData={loadData}
            onToast={setToast}
          />
        )}

        {activeView === "intake" && (
          <QuoteIntakeForm
            user={user}
            selectedQuote={selectedQuote}
            setSelectedQuote={setSelectedQuote}
            leads={leads}
            isSubmitting={isSubmitting}
            onPhoneInteraction={handlePhoneInteraction}
            onDiscard={handleBackToPipeline}
            onSaveAndReveal={handleIntakeSaveAndReveal}
          />
        )}
      </div>
    </div>
  );
};
