import React, { useState } from "react";
import {
  Package,
  FileText,
  LifeBuoy,
  Search,
  Filter,
  ArrowRight,
  MapPin,
  Clock,
  Download,
  Plus,
  Truck,
  CheckCircle2,
  Navigation,
  AlertCircle,
  Globe,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { User, LoadData } from "../types";
// Shared messaging to be integrated via IntelligenceHub or a dedicated shared component

interface QuoteFormData {
  origin: string;
  destination: string;
  equipment: string;
}

interface Props {
  user: User;
  loads: LoadData[];
  onOpenHub?: (tab?: "feed" | "messaging" | "intelligence" | "reports") => void;
  onLogout?: () => void;
  onSubmitQuote?: (data: QuoteFormData) => void;
}

export const CustomerPortalView: React.FC<Props> = ({
  user,
  loads,
  onOpenHub,
  onLogout,
  onSubmitQuote,
}) => {
  const [activeView, setActiveView] = useState("shipments");
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [quoteOrigin, setQuoteOrigin] = useState("");
  const [quoteDestination, setQuoteDestination] = useState("");
  const [quoteEquipment, setQuoteEquipment] = useState("Dry Van 53'");
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);

  const customerLoads = loads.filter(
    (l) => l.customerUserId === user.id || l.brokerId === user.id,
  );
  const filteredLoads = customerLoads.filter(
    (l) =>
      l.loadNumber.includes(searchTerm) ||
      (l.dropoff?.city ?? "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const selectedLoad = customerLoads.find((l) => l.id === selectedLoadId);

  return (
    <div className="flex flex-col h-full bg-[#020617] text-slate-100 font-inter">
      <div className="flex h-full overflow-hidden">
        {/* Internal Sidebar */}
        <aside className="w-64 bg-[#0a0f1e] border-r border-white/5 flex flex-col p-6 space-y-8 hidden md:flex shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-black tracking-tighter uppercase">
              Client Portal
            </span>
          </div>

          <nav className="space-y-1">
            {[
              { id: "shipments", label: "Monitor Shipments", icon: Truck },
              { id: "invoices", label: "Invoice Center", icon: FileText },
              { id: "quotes", label: "Request Quote", icon: Plus },
              { id: "support", label: "Support Desk", icon: LifeBuoy },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  setSelectedLoadId(null);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === item.id ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : "text-slate-500 hover:text-white hover:bg-white/5"}`}
              >
                <item.icon className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {item.label}
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto p-4 bg-slate-950/50 rounded-2xl border border-white/5">
            <div className="text-[8px] font-black text-slate-600 uppercase mb-2">
              Logged in as
            </div>
            <div className="text-[10px] font-black text-white truncate uppercase">
              {user.name}
            </div>
            <div className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">
              {user.company}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 bg-[#020617]">
          <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#0a0f1e]/50 shrink-0">
            <div className="flex items-center gap-4">
              {selectedLoadId && (
                <button
                  onClick={() => setSelectedLoadId(null)}
                  className="text-slate-500 hover:text-white mr-2"
                >
                  <ArrowRight className="w-5 h-5 rotate-180" />
                </button>
              )}
              <h2 className="text-xs font-black text-white uppercase tracking-widest">
                {activeView === "shipments" &&
                  (selectedLoadId
                    ? `Tracking Load #${selectedLoad?.loadNumber}`
                    : "Shipment Visibility")}
                {activeView === "invoices" && "Financial Documents"}
                {activeView === "quotes" && "Post New Freight"}
                {activeView === "support" && "Help Center"}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] font-black text-slate-500 uppercase">
                System Online
              </span>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
            {activeView === "shipments" && !selectedLoadId && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      className="w-full bg-[#0a0f1e] border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold text-white placeholder:text-slate-600 outline-none focus:border-blue-500 transition-all"
                      placeholder="SEARCH BY LOAD # OR CITY..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <button className="px-6 py-4 bg-[#0a0f1e] text-slate-500 rounded-2xl border border-white/5 hover:text-white transition-all flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase">
                      Filter
                    </span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredLoads.map((load) => (
                    <div
                      key={load.id}
                      onClick={() => setSelectedLoadId(load.id)}
                      className="bg-[#0a0f1e] border border-white/5 rounded-3xl p-6 space-y-6 hover:border-blue-500/50 transition-all cursor-pointer group shadow-xl"
                    >
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="text-[8px] font-black text-blue-500 uppercase tracking-widest">
                            Load #{load.loadNumber}
                          </div>
                          <div className="text-sm font-black text-white uppercase tracking-tight line-clamp-1">
                            {load.pickup?.city ?? ""} → {load.dropoff?.city ?? ""}
                          </div>
                        </div>
                        <div className="bg-slate-950 px-2 py-1 rounded-lg border border-white/5">
                          <span className="text-[8px] font-black text-blue-400 uppercase">
                            {load.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{
                              width:
                                load.status === "delivered" ? "100%" : "65%",
                            }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[8px] font-black text-slate-600 uppercase">
                          <span>En Route</span>
                          <span>
                            {load.dropoffDate
                              ? `ETA: ${load.dropoffDate}`
                              : "In Transit"}
                          </span>
                        </div>
                      </div>

                      <button className="w-full py-3 bg-slate-950 text-slate-500 group-hover:bg-blue-600 group-hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
                        View Tracking
                      </button>
                    </div>
                  ))}
                  {filteredLoads.length === 0 && (
                    <div className="col-span-full py-20 text-center bg-[#0a0f1e]/40 rounded-[2rem] border border-dashed border-white/5">
                      <Package className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                      <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                        No shipments matching your search
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeView === "shipments" && selectedLoad && (
              <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <section className="bg-[#0a0f1e] rounded-[3rem] p-10 border border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-10 opacity-5">
                    <Package className="w-64 h-64 text-white" />
                  </div>

                  <div className="relative z-10 space-y-12">
                    <div className="flex justify-between items-start">
                      <div className="space-y-3">
                        <span className="px-3 py-1 bg-blue-600/10 text-blue-500 rounded-full text-[10px] font-black border border-blue-500/20 uppercase tracking-widest">
                          Tracking ID: {selectedLoad.loadNumber}
                        </span>
                        <h1 className="text-4xl font-black text-white uppercase tracking-tighter">
                          {selectedLoad.pickup?.city ?? ""}{" "}
                          <ArrowRight className="inline-block w-8 h-8 text-blue-500 mx-2" />{" "}
                          {selectedLoad.dropoff?.city ?? ""}
                        </h1>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          Current Status
                        </div>
                        <div className="text-2xl font-black text-blue-400 uppercase tracking-tight">
                          {selectedLoad.status}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-600/10 rounded-xl">
                            <MapPin className="w-4 h-4 text-blue-500" />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase">
                            Origin
                          </span>
                        </div>
                        <div className="text-sm font-black text-white uppercase">
                          {selectedLoad.pickup?.city ?? ""},{" "}
                          {selectedLoad.pickup?.state ?? ""}
                        </div>
                      </div>
                      <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-600/10 rounded-xl">
                            <Clock className="w-4 h-4 text-indigo-500" />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase">
                            Destination
                          </span>
                        </div>
                        <div className="text-sm font-black text-white uppercase">
                          {selectedLoad.dropoff?.city ?? ""},{" "}
                          {selectedLoad.dropoff?.state ?? ""}
                        </div>
                      </div>
                      <div className="bg-slate-950/50 p-6 rounded-3xl border border-white/5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-600/10 rounded-xl">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase">
                            Status
                          </span>
                        </div>
                        <div className="text-sm font-black text-white uppercase">
                          {selectedLoad.status}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <span>Delivery Progress</span>
                        <span className="text-blue-500">
                          {selectedLoad.status === "delivered"
                            ? "100% Complete"
                            : "In Progress"}
                        </span>
                      </div>
                      <div className="h-3 w-full bg-slate-950 rounded-full border border-white/5 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full shadow-[0_0_20px_#2563eb]"
                          style={{
                            width:
                              selectedLoad.status === "delivered"
                                ? "100%"
                                : "50%",
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <button className="flex-1 py-4 bg-white text-black font-black uppercase text-xs rounded-2xl hover:bg-slate-200 transition-all shadow-xl">
                        View Live Map
                      </button>
                      <button className="px-8 py-4 bg-[#0a0f1e] text-slate-500 rounded-2xl border border-white/5 hover:text-white transition-all">
                        Download POD
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeView === "invoices" &&
              (() => {
                const invoiceLoads = customerLoads.filter(
                  (l) => l.status === "delivered" || l.isInvoiced,
                );
                return (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-black text-white uppercase">
                        Invoice History
                      </h3>
                      <button className="px-6 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Download className="w-4 h-4" /> Export Statement
                      </button>
                    </div>

                    {invoiceLoads.length === 0 ? (
                      <div className="py-20 text-center bg-[#0a0f1e]/40 rounded-[2rem] border border-dashed border-white/5">
                        <FileText className="w-12 h-12 text-slate-800 mx-auto mb-4" />
                        <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">
                          No invoices
                        </p>
                        <p className="text-[10px] text-slate-700 font-bold uppercase mt-2">
                          Invoices will appear once loads are delivered
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[#0a0f1e] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-white/5 bg-slate-950/50">
                              <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                Load #
                              </th>
                              <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                Route
                              </th>
                              <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                Date
                              </th>
                              <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                Amount
                              </th>
                              <th className="px-8 py-5 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {invoiceLoads.map((l) => (
                              <tr
                                key={l.id}
                                className="hover:bg-white/[0.02] transition-colors group"
                              >
                                <td className="px-8 py-5 text-[10px] font-black text-white">
                                  {l.loadNumber}
                                </td>
                                <td className="px-8 py-5 text-[10px] font-bold text-slate-500">
                                  {l.pickup?.city ?? ""} → {l.dropoff?.city ?? ""}
                                </td>
                                <td className="px-8 py-5 text-[10px] font-bold text-slate-500">
                                  {l.dropoffDate || l.pickupDate}
                                </td>
                                <td className="px-8 py-5 text-[10px] font-black text-white">
                                  ${(l.carrierRate || 0).toLocaleString()}
                                </td>
                                <td className="px-8 py-5">
                                  <span className="px-2 py-0.5 bg-green-500/20 text-green-500 rounded-lg text-[8px] font-black uppercase border border-green-500/20">
                                    {l.isInvoiced ? "Invoiced" : "Delivered"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })()}

            {activeView === "quotes" && (
              <div className="max-w-2xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-600/10 rounded-3xl flex items-center justify-center border border-blue-500/20 mx-auto">
                    <Navigation className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter">
                    Freight Quote Request
                  </h3>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                    Priority lane pricing in seconds
                  </p>
                </div>

                {quoteSubmitted ? (
                  <div className="bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] p-10 text-center space-y-6 shadow-2xl">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                    <h4 className="text-xl font-black text-white uppercase">
                      Quote Request Received
                    </h4>
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">
                      Contact dispatch to confirm your rate
                    </p>
                  </div>
                ) : (
                  <form
                    className="bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] p-10 space-y-8 shadow-2xl"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (onSubmitQuote) {
                        onSubmitQuote({
                          origin: quoteOrigin,
                          destination: quoteDestination,
                          equipment: quoteEquipment,
                        });
                      }
                      setQuoteSubmitted(true);
                    }}
                  >
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">
                          Origin City
                        </label>
                        <input
                          value={quoteOrigin}
                          onChange={(e) => setQuoteOrigin(e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">
                          Destination City
                        </label>
                        <input
                          value={quoteDestination}
                          onChange={(e) => setQuoteDestination(e.target.value)}
                          className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:border-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest pl-1">
                        Equipment Type
                      </label>
                      <select
                        value={quoteEquipment}
                        onChange={(e) => setQuoteEquipment(e.target.value)}
                        className="w-full bg-slate-950 border border-white/5 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:border-blue-500 outline-none transition-all appearance-none"
                      >
                        <option>Dry Van 53&apos;</option>
                        <option>Reefer 53&apos;</option>
                        <option>Flatbed</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-5 bg-blue-600 text-white rounded-3xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/40 hover:bg-blue-500 transition-all active:scale-95"
                    >
                      Submit Priority Request
                    </button>
                  </form>
                )}
              </div>
            )}

            {activeView === "support" && (
              <div className="h-full flex flex-col space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                      Support Desk
                    </h3>
                    <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">
                      Direct channel to operations
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-500 rounded-xl border border-blue-500/20 text-[10px] font-black uppercase">
                    Priority Channel
                  </div>
                </div>
                <div className="flex-1 bg-slate-950/30 rounded-[2.5rem] border border-white/5 overflow-hidden">
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-6 p-12 text-center">
                    <div className="w-20 h-20 bg-blue-600/10 rounded-[2rem] flex items-center justify-center border border-blue-500/20 mb-2">
                      <MessageSquare className="w-10 h-10 text-blue-500" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-black uppercase tracking-widest text-white">
                        Direct Operational Stream
                      </p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                        Messaging has transitioned to Central Command for
                        firm-wide coordination.
                      </p>
                    </div>
                    <button
                      onClick={() => onOpenHub?.("messaging")}
                      className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-900/40 transition-all active:scale-95"
                    >
                      Initialize Secure Chat
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
