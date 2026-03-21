import React, { useState, useEffect } from "react";
import { useAutoFeedback } from "../hooks/useAutoFeedback";
import {
  User,
  Lead,
  Quote,
  Booking,
  LoadData,
  LoadStatus,
  OperatingMode,
  Company,
  Broker,
  Contract,
  QuoteStatus,
  BookingStatus,
  FreightType,
} from "../types";
import { getBrokers, getContracts } from "../services/brokerService";
import {
  saveLoad,
  generateNextLoadNumber,
  saveQuote,
  saveBooking,
  saveLead,
} from "../services/storageService";
import { checkCapability, getCompany } from "../services/authService";
import { extractLoadData } from "../services/ocrService";
import {
  Camera,
  FileText,
  UserPlus,
  Building2,
  Truck,
  Container,
  Plus,
  Check,
  Search,
  AlertCircle,
  Send,
  Users,
  Mail,
  Upload,
  Loader2,
  Sparkles,
  X,
  Phone,
  DollarSign,
  ClipboardCheck,
  History,
  ArrowRight,
  Lock,
} from "lucide-react";
import { v4 as uuidv4 } from "uuid";

interface Props {
  user: User;
  company?: Company;
  onBookingComplete: () => void;
}

export const BookingPortal: React.FC<Props> = ({
  user,
  company,
  onBookingComplete,
}) => {
  const [step, setStep] = useState<
    "intake" | "quote" | "review" | "booking" | "confirmation"
  >("intake");
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(
    null,
  );

  const [lead, setLead] = useState<Partial<Lead>>({
    id: uuidv4(),
    companyId: user.companyId,
    createdAt: new Date().toISOString(),
  });

  const [quote, setQuote] = useState<Partial<Quote>>({
    id: uuidv4(),
    companyId: user.companyId,
    status: "Draft",
    version: 1,
    createdAt: new Date().toISOString(),
    equipmentType: "Intermodal",
    linehaul: 0,
    fuelSurcharge: 0,
    accessorials: [],
    totalRate: 0,
    pickup: { city: "", state: "", facilityName: "" },
    dropoff: { city: "", state: "", facilityName: "" },
  });

  const [booking, setBooking] = useState<Partial<Booking> | null>(null);

  const [loading, setLoading] = useState(false);
  const [quoteErrors, setQuoteErrors] = useState<Record<string, string>>({});
  const [isScanning, setIsScanning] = useState(false);
  const [feedback, showFeedback, clearFeedback] = useAutoFeedback<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      const b = await getBrokers();
      setBrokers(b);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedBroker) {
      const loadContracts = async () => {
        const c = await getContracts(selectedBroker.id);
        setContracts(c);
        if (c.length === 1) setSelectedContract(c[0]);
      };
      loadContracts();
      setLead((prev) => ({ ...prev, customerName: selectedBroker.name }));
    }
  }, [selectedBroker]);

  const handleIntakeMethod = (method: "manual" | "photo") => {
    if (method === "photo") {
      fileInputRef.current?.click();
    } else {
      setStep("quote");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const results = await extractLoadData(file);
      const data = results.loadData;
      setQuote((prev) => ({
        ...prev,
        pickup: data.pickup || prev.pickup,
        dropoff: data.dropoff || prev.dropoff,
        linehaul: data.carrierRate || 0,
        equipmentType: data.freightType || "Intermodal",
        totalRate: data.carrierRate || 0,
      }));
      setStep("quote");
      showFeedback(
        {
          msg: "Intelligence extracted successfully.",
          type: "success",
        },
        4000,
      );
    } catch (error) {
      showFeedback(
        {
          msg: "Extraction failed. Manual entry required.",
          type: "error",
        },
        4000,
      );
      setStep("quote");
    } finally {
      setIsScanning(false);
    }
  };

  const createQuote = async () => {
    if (!selectedBroker || !quote.totalRate) {
      showFeedback(
        {
          msg: "Missing broker or rate information.",
          type: "error",
        },
        5000,
      );
      return;
    }
    setLoading(true);
    try {
      const finalQuote: Quote = {
        ...(quote as Quote),
        ownerId: user.id,
        validUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(), // 7 days valid
      };
      await saveQuote(finalQuote);
      setQuote(finalQuote);
      setStep("review");
    } finally {
      setLoading(false);
    }
  };

  const validateQuote = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!quote.pickup?.city?.trim()) errs.pickupCity = "Pickup city is required";
    if (!quote.pickup?.state?.trim()) errs.pickupState = "Pickup state is required";
    if (!quote.dropoff?.city?.trim()) errs.dropoffCity = "Dropoff city is required";
    if (!quote.dropoff?.state?.trim()) errs.dropoffState = "Dropoff state is required";
    if (!quote.totalRate || quote.totalRate <= 0) errs.rate = "Rate must be greater than 0";
    return errs;
  };

  const isQuoteValid = !!quote.pickup?.city?.trim() && !!quote.pickup?.state?.trim() &&
    !!quote.dropoff?.city?.trim() && !!quote.dropoff?.state?.trim() &&
    !!quote.totalRate && quote.totalRate > 0;

  const convertToBooking = async () => {
    const errs = validateQuote();
    if (Object.keys(errs).length > 0) { setQuoteErrors(errs); return; }
    setQuoteErrors({});
    setLoading(true);
    try {
      const quoteId = quote.id ?? uuidv4();
      const newBooking: Booking = {
        id: uuidv4(),
        quoteId,
        companyId: user.companyId,
        status: "Accepted",
        requiresAppt: false,
        createdAt: new Date().toISOString(),
      };
      await saveBooking(newBooking);
      setBooking(newBooking);

      // Generate Load Stub
      const companyData = await getCompany(user.companyId);
      const emptyPickup = { city: "", state: "", facilityName: "" };
      const emptyDropoff = { city: "", state: "", facilityName: "" };
      const pickupLocation = quote.pickup ?? emptyPickup;
      const dropoffLocation = quote.dropoff ?? emptyDropoff;
      const validUntil = quote.validUntil ?? new Date().toISOString();
      const loadNumber = companyData
        ? generateNextLoadNumber(companyData, selectedBroker?.name ?? "")
        : `LD-${Date.now()}`;

      const newLoad: LoadData = {
        id: uuidv4(),
        bookingId: newBooking.id,
        quoteId,
        companyId: user.companyId,
        driverId: "", // Unassigned
        loadNumber: loadNumber,
        status: "draft",
        carrierRate: quote.totalRate || 0,
        driverPay: 0,
        pickupDate: quote.validUntil || new Date().toISOString(),
        freightType: quote.equipmentType || "Intermodal",
        legs: [
          {
            id: uuidv4(),
            type: "Pickup",
            location: {
              ...pickupLocation,
              facilityName: pickupLocation.facilityName || "",
            },
            date: validUntil,
            completed: false,
          },
          {
            id: uuidv4(),
            type: "Dropoff",
            location: {
              ...dropoffLocation,
              facilityName: dropoffLocation.facilityName || "",
            },
            date: validUntil,
            completed: false,
          },
        ],
        pickup: pickupLocation,
        dropoff: dropoffLocation,
        createdAt: Date.now(),
        version: 1,
      };
      await saveLoad(newLoad, user);

      setStep("confirmation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-950 text-slate-100 animate-fade-in font-sans">
      {/* Header */}
      <div className="p-8 bg-slate-900 border-b border-slate-800 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter">
            Intake & Quotes
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">
            Sales Workspace: Lead to Booking Pipeline
          </p>
        </div>
        <div className="flex gap-4">
          {["intake", "quote", "review", "confirmation"].map((s, i) => (
            <div
              key={s}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${step === s ? "bg-blue-600 border-blue-400 text-white scale-110 shadow-lg" : "bg-slate-800 border-slate-700 text-slate-600"}`}
            >
              <span className="text-[10px] font-black uppercase">
                {i + 1}. {s}
              </span>
              {step === s && <Sparkles className="w-3 h-3 animate-pulse" />}
            </div>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 ${feedback.type === "success" ? "bg-green-600" : "bg-red-600"} text-white text-xs font-black uppercase tracking-widest flex justify-between items-center animate-in slide-in-from-top duration-300 z-50`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === "success" ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {feedback.msg}
          </div>
          <button onClick={clearFeedback}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
        {step === "intake" && (
          <div className="max-w-5xl mx-auto space-y-12 py-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Lead Identification */}
              <div className="bg-slate-900 p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                    <Phone className="w-6 h-6 text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                    Lead Identification
                  </h2>
                </div>

                <div className="space-y-6">
                  <div>
                    <label htmlFor="bpCallerPointOfContact" className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">
                      Caller / Point of Contact
                    </label>
                    <input id="bpCallerPointOfContact"
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold"
                      placeholder="Who are we speaking with?"
                      value={lead.callerName || ""}
                      onChange={(e) =>
                        setLead({ ...lead, callerName: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="bpDirectPhone" className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">
                        Direct Phone
                      </label>
                      <input id="bpDirectPhone"
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold"
                        placeholder="(555) 000-0000"
                        value={lead.callerPhone || ""}
                        onChange={(e) =>
                          setLead({ ...lead, callerPhone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label htmlFor="bpClient" className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2 block">
                        Client
                      </label>
                      <select id="bpClient"
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white focus:border-blue-500 outline-none transition-all font-bold appearance-none"
                        onChange={(e) =>
                          setSelectedBroker(
                            brokers.find((b) => b.id === e.target.value) ||
                              null,
                          )
                        }
                        value={selectedBroker?.id || ""}
                      >
                        <option value="">Select Partner</option>
                        {brokers.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Intake Strategy */}
              <div className="space-y-6">
                <div className="text-left space-y-2 mb-8">
                  <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest">
                    Intake Strategy
                  </h3>
                  <p className="text-slate-600 text-xs font-bold uppercase">
                    Rapid conversion from document or manual manifest
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => handleIntakeMethod("photo")}
                    disabled={isScanning}
                    className="group bg-slate-900 border-2 border-slate-800 hover:border-blue-600 p-8 rounded-[2rem] transition-all flex items-center gap-8 shadow-xl disabled:opacity-50"
                  >
                    <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                      {isScanning ? (
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                      ) : (
                        <Camera className="w-8 h-8 text-blue-500" />
                      )}
                    </div>
                    <div className="text-left">
                      <h4 className="text-lg font-black text-white uppercase">
                        AI Scan Intelligence
                      </h4>
                      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                        Extract lane/rates from PDF/Photo
                      </p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleIntakeMethod("manual")}
                    className="group bg-slate-900 border-2 border-slate-800 hover:border-indigo-600 p-8 rounded-[2rem] transition-all flex items-center gap-8 shadow-xl"
                  >
                    <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 group-hover:scale-110 transition-transform">
                      <FileText className="w-8 h-8 text-indigo-500" />
                    </div>
                    <div className="text-left">
                      <h4 className="text-lg font-black text-white uppercase">
                        Manual Phone Quote
                      </h4>
                      <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                        Build competitive pricing live
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "quote" && (
          <div className="max-w-6xl mx-auto space-y-8 pb-20">
            <div className="bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden">
              <div className="p-10 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center">
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
                  <DollarSign className="w-8 h-8 text-green-500" /> Build Quote
                  v{quote.version}
                </h2>
                <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Client: {selectedBroker?.name || "GENERIC"}
                  </span>
                </div>
              </div>

              <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Lane & Equipment */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">
                      Lane Baseline
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                        <label htmlFor="bpOriginCityST" className="text-[9px] text-slate-600 font-black uppercase mb-2 block">
                          Origin (City, ST)
                        </label>
                        <input id="bpOriginCityST"
                          className="w-full bg-transparent text-sm text-white font-black uppercase outline-none"
                          placeholder="CITY, ST"
                          value={`${quote.pickup?.city || ""}${quote.pickup?.state ? ", " + quote.pickup?.state : ""}`}
                          onChange={(e) => {
                            const [city, state] = e.target.value
                              .split(",")
                              .map((s) => s.trim());
                            setQuote({
                              ...quote,
                              pickup: {
                                ...(quote.pickup ?? {
                                  city: "",
                                  state: "",
                                  facilityName: "",
                                }),
                                city: city || "",
                                state: state || "",
                              },
                            });
                          }}
                        />
                      </div>
                      <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                        <label htmlFor="bpDestinationCityST" className="text-[9px] text-slate-600 font-black uppercase mb-2 block">
                          Destination (City, ST)
                        </label>
                        <input id="bpDestinationCityST"
                          className="w-full bg-transparent text-sm text-white font-black uppercase outline-none"
                          placeholder="CITY, ST"
                          value={`${quote.dropoff?.city || ""}${quote.dropoff?.state ? ", " + quote.dropoff?.state : ""}`}
                          onChange={(e) => {
                            const [city, state] = e.target.value
                              .split(",")
                              .map((s) => s.trim());
                            setQuote({
                              ...quote,
                              dropoff: {
                                ...(quote.dropoff ?? {
                                  city: "",
                                  state: "",
                                  facilityName: "",
                                }),
                                city: city || "",
                                state: state || "",
                              },
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.3em]">
                      Equipment Requirement
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <select aria-label="Equipment type"
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white font-black appearance-none outline-none focus:border-orange-500 transition-all"
                        value={quote.equipmentType}
                        onChange={(e) =>
                          setQuote({
                            ...quote,
                            equipmentType: e.target.value as any,
                          })
                        }
                      >
                        <option value="Intermodal">Intermodal</option>
                        <option value="Dry Van">Dry Van</option>
                        <option value="Reefer">Reefer</option>
                        <option value="Flatbed">Flatbed</option>
                      </select>
                      <input aria-label="Special Constraints (TWIC)"
                        className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-white font-black outline-none focus:border-orange-500 transition-all"
                        placeholder="Special Constraints (e.g. TWIC)"
                        value={quote.equipmentRequirements || ""}
                        onChange={(e) =>
                          setQuote({
                            ...quote,
                            equipmentRequirements: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em]">
                      Assumptions & Policy
                    </h3>
                    <textarea aria-label="Detention rules, lumper policy, appointment requirements..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 font-bold outline-none focus:border-indigo-500 transition-all min-h-[100px]"
                      placeholder="Detention rules, lumper policy, appointment requirements..."
                      value={quote.assumptions || ""}
                      onChange={(e) =>
                        setQuote({ ...quote, assumptions: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* Financials (Phone Quote Loop) */}
                <div className="bg-slate-950 rounded-3xl border border-slate-800 p-8 space-y-8 shadow-inner">
                  <h3 className="text-[10px] font-black text-green-500 uppercase tracking-[0.3em]">
                    Commercial Structure
                  </h3>

                  <div className="space-y-6">
                    <div className="flex justify-between items-end">
                      <div className="flex-1">
                        <label htmlFor="bpLinehaulRate" className="text-[11px] text-slate-500 font-black uppercase mb-2 block">
                          Linehaul Rate
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-700" />
                          <input id="bpLinehaulRate"
                            type="number"
                            className="w-full bg-slate-900 border-2 border-slate-800 rounded-2xl pl-12 pr-6 py-4 text-2xl text-white font-black outline-none focus:border-green-600 transition-all"
                            value={quote.linehaul || ""}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setQuote((prev) => ({
                                ...prev,
                                linehaul: val,
                                totalRate:
                                  val +
                                  (prev.fuelSurcharge || 0) +
                                  (prev.accessorials?.reduce(
                                    (s, a) => s + a.amount,
                                    0,
                                  ) || 0),
                              }));
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="bpFuelSurchargeFSC" className="text-[10px] text-slate-500 font-black uppercase mb-2 block">
                          Fuel Surcharge (FSC)
                        </label>
                        <input id="bpFuelSurchargeFSC"
                          type="number"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-lg text-blue-400 font-black"
                          value={quote.fuelSurcharge || ""}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setQuote((prev) => ({
                              ...prev,
                              fuelSurcharge: val,
                              totalRate:
                                (prev.linehaul || 0) +
                                val +
                                (prev.accessorials?.reduce(
                                  (s, a) => s + a.amount,
                                  0,
                                ) || 0),
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-black uppercase mb-2 block">
                          Total Quote Value
                        </label>
                        <div className="w-full bg-green-600/10 border border-green-500/20 rounded-xl p-4 text-xl text-green-500 font-black flex items-center gap-2">
                          <DollarSign className="w-5 h-5" />{" "}
                          {quote.totalRate?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-800 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase">
                        Accessorial Templates
                      </h4>
                      <button className="text-blue-500 hover:text-blue-400 transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {quote.accessorials?.map((acc, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-slate-900 p-3 rounded-xl border border-slate-800"
                        >
                          <span className="text-[11px] font-black text-white uppercase">
                            {acc.type}
                          </span>
                          <span className="text-[11px] font-black text-green-500">
                            ${acc.amount}
                          </span>
                        </div>
                      ))}
                      <div className="text-[9px] text-slate-600 font-bold uppercase text-center italic">
                        No standard accessorials applied to this quote loop.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-10 bg-slate-900/40 border-t border-slate-800 flex justify-between items-center">
                <button
                  onClick={() => setStep("intake")}
                  className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all"
                >
                  Back to Intake
                </button>
                <button
                  onClick={createQuote}
                  disabled={loading}
                  className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl active:scale-95 transition-all flex items-center gap-4"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ClipboardCheck className="w-4 h-4" />
                  )}
                  {loading ? "Saving..." : "Finalize Professional Quote"}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="max-w-4xl mx-auto space-y-8 py-10 animate-scale-in">
            <div className="bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8">
                <div className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  Quote: v{quote.version} (Active)
                </div>
              </div>

              <div className="space-y-10">
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
                    Review & Dispatch Confirm
                  </h2>
                  <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                    Verify all commercial parameters before conversion to
                    execution load.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-600 font-black uppercase">
                        Lane Summary
                      </label>
                      <div className="text-xl font-black text-white uppercase flex items-center gap-3">
                        {quote.pickup?.city}{" "}
                        <ArrowRight className="w-5 h-5 text-blue-500" />{" "}
                        {quote.dropoff?.city}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-600 font-black uppercase">
                        Commercial Value
                      </label>
                      <div className="text-3xl font-black text-green-500 font-mono tracking-tighter">
                        ${quote.totalRate?.toLocaleString()} USD
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-600 font-black uppercase">
                        Equipment Specification
                      </label>
                      <div className="text-xl font-black text-white uppercase">
                        {quote.equipmentType}{" "}
                        {quote.equipmentRequirements &&
                          `(${quote.equipmentRequirements})`}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-600 font-black uppercase">
                        Valid Through
                      </label>
                      <div className="text-xl font-black text-orange-500 uppercase font-mono">
                        {quote.validUntil
                          ? new Date(quote.validUntil).toLocaleDateString()
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950 p-6 rounded-[2rem] border border-slate-800 space-y-4">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Send className="w-3 h-3" /> External Engagement
                  </h4>
                  <div className="flex gap-4">
                    <button className="flex-1 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black text-white uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                      <Mail className="w-4 h-4 text-blue-500" /> Email Quote to
                      Client
                    </button>
                    <button className="flex-1 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black text-white uppercase hover:bg-slate-800 transition-all flex items-center justify-center gap-3">
                      <History className="w-4 h-4 text-orange-500" /> Save as
                      Working Concept
                    </button>
                  </div>
                </div>

                <div className="pt-8 flex flex-col gap-4">
                  {checkCapability(
                    user,
                    "QUOTE_CONVERT",
                    undefined,
                    company,
                  ) ? (
                    <button
                      onClick={convertToBooking}
                      disabled={loading || !isQuoteValid}
                      className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-3xl font-black uppercase tracking-[0.3em] text-sm shadow-2xl active:scale-[0.98] transition-all flex items-center justify-center gap-4"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <ClipboardCheck className="w-5 h-5" />
                      )}
                      {loading
                        ? "Converting..."
                        : "Accept Quote & Convert to Booking"}
                    </button>
                  ) : (
                    <div className="w-full py-6 bg-slate-900 border border-slate-800 rounded-3xl text-slate-500 font-black uppercase tracking-[0.2em] text-xs flex flex-col items-center gap-2 opacity-60">
                      <Lock className="w-4 h-4" />
                      Capability Required: QUOTE_CONVERT
                      <span className="text-[8px] text-slate-700">
                        Contact Owner to elevate Operational DNA
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => setStep("quote")}
                    className="w-full py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Return to Rate Matrix
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "confirmation" && (
          <div className="max-w-3xl mx-auto py-20 text-center space-y-12 animate-scale-in">
            <div className="relative inline-block">
              <div className="w-32 h-32 bg-green-600 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl shadow-green-900/40 relative z-10">
                <Check className="w-16 h-16 text-white" />
              </div>
              <div className="absolute inset-0 bg-green-600 blur-[80px] opacity-20 animate-pulse" />
            </div>

            <div className="space-y-6">
              <h2 className="text-5xl font-black text-white uppercase tracking-tighter">
                Booking Solidified
              </h2>
              <div className="flex justify-center gap-4">
                <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">
                    B-ID: {booking?.id?.slice(0, 8)}
                  </span>
                </div>
                <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-black text-green-400 uppercase tracking-[0.2em]">
                    Q-REF: {quote?.id?.slice(0, 8)}
                  </span>
                </div>
              </div>
              <p className="text-slate-500 text-lg uppercase tracking-widest font-bold px-10 max-w-2xl mx-auto leading-relaxed">
                Quote has been converted to an active booking. A Load execution
                record has been generated on the{" "}
                <span className="text-white">Dispatch Board</span> for
                assignment.
              </p>
            </div>

            <div className="pt-10 flex flex-col gap-4 max-w-sm mx-auto">
              <button
                onClick={onBookingComplete}
                className="w-full py-6 bg-white text-slate-950 hover:bg-slate-200 rounded-3xl font-black uppercase tracking-[0.3em] text-[11px] shadow-2xl active:scale-95 transition-all"
              >
                Go to Operational Board
              </button>
              <button
                onClick={() => {
                  setQuote({
                    id: uuidv4(),
                    companyId: user.companyId,
                    status: "Draft",
                    version: 1,
                    createdAt: new Date().toISOString(),
                    equipmentType: "Intermodal",
                    linehaul: 0,
                    fuelSurcharge: 0,
                    accessorials: [],
                    totalRate: 0,
                    pickup: { city: "", state: "", facilityName: "" },
                    dropoff: { city: "", state: "", facilityName: "" },
                  });
                  setStep("intake");
                }}
                className="w-full py-5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-3xl font-black uppercase tracking-[0.2em] text-[10px] border border-slate-800 transition-all font-mono"
              >
                Initiate New Quote Cycle
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
