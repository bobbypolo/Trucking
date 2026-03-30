import React from "react";
import { v4 as uuidv4 } from "uuid";
import {
  RefreshCw,
  X,
  Search,
  Truck,
  User as UserIcon,
  CheckCircle,
  Navigation,
  Phone,
  FileText,
  AlertTriangle,
  MessageSquare,
  Clock,
  DollarSign,
  Shield,
  Bell,
  MapPin,
  Star,
  Zap,
  Plus,
  Wrench,
} from "lucide-react";
import { OperationalEvent, User, LoadData, Contact, WorkspaceSession, ContextRecord } from "../../types";
import { saveNotificationJob } from "../../services/storageService";

export interface RepowerSelectionPanelProps {
  showRepowerPanel: boolean;
  setShowRepowerPanel: (v: boolean) => void;
  repowerLoadId: string | null;
  repowerMatches: any[];
  isSearchingMatches: boolean;
  executeRepower: (driverId: string, driverName: string) => void;
  executeRepowerHandoff: (driverId: string, driverName: string) => void;
  loads: LoadData[];
  user: User;
  session: WorkspaceSession;
  activeRecord: ContextRecord | null;
  onRecordAction: (e: OperationalEvent) => Promise<void>;
  showSuccessMessage: (msg: string, timeout?: number) => void;
  showRoadsideForm: boolean;
  setShowRoadsideForm: (v: boolean) => void;
  roadsideNotes: string;
  setRoadsideNotes: (v: string) => void;
  roadsideVendors: any[];
  selectedVendorForRoadside: any;
  setSelectedVendorForRoadside: (v: any) => void;
  submitRoadsideAssist: () => Promise<void>;
  submitRoadsideDispatch: () => Promise<void>;
  showNotifyPicker: boolean;
  setShowNotifyPicker: (v: boolean) => void;
  notificationContacts: Contact[];
  selectedContacts: string[];
  setSelectedContacts: (v: any) => void;
  notificationMessage: string;
  setNotificationMessage: (v: string) => void;
  handleNotifyPartners: () => Promise<void>;
  sendNotificationJob: () => Promise<void>;
  showDocForm: boolean;
  setShowDocForm: (v: boolean) => void;
}

export const RepowerSelectionPanel: React.FC<RepowerSelectionPanelProps> = (props) => {
  const {
    showRepowerPanel, setShowRepowerPanel,
    repowerLoadId, repowerMatches, isSearchingMatches,
    executeRepower, executeRepowerHandoff,
    loads, user, session, activeRecord,
    onRecordAction, showSuccessMessage,
    showRoadsideForm, setShowRoadsideForm,
    roadsideNotes, setRoadsideNotes,
    roadsideVendors, selectedVendorForRoadside,
    setSelectedVendorForRoadside, submitRoadsideAssist,
    submitRoadsideDispatch,
    showNotifyPicker, setShowNotifyPicker,
    notificationContacts, selectedContacts, setSelectedContacts,
    notificationMessage, setNotificationMessage,
    handleNotifyPartners, sendNotificationJob,
    showDocForm, setShowDocForm,
  } = props;

  return (
    <>
      {showRepowerPanel && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-[#050810]/90 backdrop-blur-xl"
            onClick={() => setShowRepowerPanel(false)}
          />
          <div className="relative w-full max-w-4xl bg-[#0a0c10] border border-white/10 rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="h-24 shrink-0 px-10 flex items-center justify-between border-b border-white/5 bg-slate-950/50">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <RefreshCw className="w-6 h-6 text-white animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                    Strategic Repower Handoff
                  </h3>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                      Load Context:
                    </span>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-2 py-0.5 bg-blue-500/10 rounded">
                      #
                      {loads.find((l) => l.id === repowerLoadId)?.loadNumber ||
                        "PENDING"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowRepowerPanel(false)}
                className="p-3 hover:bg-white/5 rounded-2xl transition-all group"
              >
                <X className="w-6 h-6 text-slate-500 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left: Target Load Summary */}
              <div className="w-80 border-r border-white/5 bg-slate-950/20 p-8 space-y-8">
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Active Incident
                  </h4>
                  <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-2xl">
                    <div className="flex items-center gap-3 mb-2 text-red-500">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-[11px] font-black uppercase">
                        Mechanical Breakdown
                      </span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase leading-relaxed">
                      Vehicle stationary on I-90 EB. Asset rescue required for
                      hot delivery.
                    </p>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    Current Location
                  </h4>
                  <div className="flex items-center gap-3 text-white">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold uppercase tracking-tight">
                      Chicago, IL (I-90 Shoulder)
                    </span>
                  </div>
                </section>
              </div>

              {/* Right: Driver Availability & Scoreboard */}
              <div className="flex-1 flex flex-col bg-slate-950/40">
                <div className="h-14 px-8 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Available Capacity Near Exception Site
                  </span>
                  <div className="flex items-center gap-4 text-[9px] font-black uppercase text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />{" "}
                      High Match
                    </span>
                    <span className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />{" "}
                      Caution
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 no-scrollbar space-y-4">
                  {isSearchingMatches ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-50 space-y-6">
                      <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">
                        Querying Fleet Intelligence...
                      </span>
                    </div>
                  ) : (
                    repowerMatches.slice(0, 10).map((match: any) => (
                      <div
                        key={match.driverId}
                        className="p-6 bg-[#111827]/40 border border-white/5 rounded-[2rem] hover:border-blue-500/40 transition-all group flex items-center justify-between"
                      >
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-center gap-2">
                            <div
                              className={`p-4 rounded-2xl bg-slate-900 border border-white/5 group-hover:border-blue-500/20 text-white font-black text-lg transition-all ${match.recommendation === "STRONG_MATCH" ? "shadow-[0_0_20px_rgba(59,130,246,0.15)] text-blue-400" : ""}`}
                            >
                              {match.matchScore}%
                            </div>
                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                              Match
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">
                              {match.driverName}
                            </h4>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-slate-600" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                  {match.distanceToPickup} Mi away
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-slate-600" />
                                <span className="text-[9px] font-bold text-slate-400 uppercase">
                                  {match.hosAvailable}h HOS
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Zap className="w-3 h-3 text-orange-500" />
                                <span className="text-[9px] font-bold text-orange-500 uppercase">
                                  ETA:{" "}
                                  {new Date(
                                    match.estimatedArrival,
                                  ).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            executeRepowerHandoff(
                              match.driverId,
                              match.driverName,
                            )
                          }
                          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0"
                        >
                          Assign Handoff
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer Status */}
            <div className="h-12 bg-slate-950/60 border-t border-white/5 px-10 flex items-center justify-between">
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest italic">
                Authorized Operation: Dispatch Integrity Override
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  <span className="text-[9px] font-black text-blue-500/80 uppercase">
                    Telemetry Link: Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDocForm && (
        <div className="absolute inset-0 z-[1000] bg-[#050810]/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-[#0a0f18] border border-slate-800 rounded-3xl shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col">
            {/* Header Section */}
            <div className="bg-slate-900 border-b border-slate-800 px-8 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic">
                    Electronic Record Injection
                  </h3>
                  <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                    Status: Pending Verification
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDocForm(false)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500 hover:text-white" />
              </button>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto no-scrollbar">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1">
                  Subspace Target
                </label>
                <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-4">
                    <Truck className="w-4 h-4 text-blue-500" />
                    <span className="text-[11px] font-black text-white uppercase tracking-widest font-mono">
                      {session.primaryContext?.type === "LOAD"
                        ? `MANIFEST #${activeRecord?.data?.load?.loadNumber}`
                        : "Select Operational Target..."}
                    </span>
                  </div>
                  <span className="text-[7px] font-black px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 uppercase tracking-tighter">
                    LINKED
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-12 border-2 border-dashed border-slate-800 rounded-[2.5rem] flex flex-col items-center justify-center gap-5 hover:border-blue-500 transition-all cursor-pointer group bg-slate-950/20 hover:bg-blue-600/5 shadow-inner">
                  <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                    <Plus className="w-8 h-8 text-slate-700 group-hover:text-blue-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black text-white uppercase tracking-[0.2em] mb-2 group-hover:text-blue-500 transition-colors">
                      Inject Image/PDF Artifact
                    </p>
                    <p className="text-[8px] font-bold text-slate-700 uppercase tracking-widest leading-loose">
                      BOL, POD, RATE CON, INVOICE SOURCE
                      <br />
                      (Max 25MB Multi-Layer)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="doc-discrepancy-log"
                  className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] ml-1"
                >
                  Discrepancy Log (Optional)
                </label>
                <textarea
                  id="doc-discrepancy-log"
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-[11px] font-bold text-slate-400 h-28 resize-none outline-none focus:border-blue-500 transition-all shadow-inner no-scrollbar"
                  placeholder="SPECIFY ANY OSD OR CARGO DISCREPANCIES DETECTED DURING INTAKE..."
                ></textarea>
              </div>
            </div>

            {/* Footer Section */}
            <div className="p-8 bg-slate-900 border-t border-slate-800 flex justify-end items-center gap-6 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
              <button
                onClick={() => setShowDocForm(false)}
                className="px-8 py-4 text-[11px] font-black text-slate-500 hover:text-white uppercase tracking-[0.2em] transition-colors"
              >
                Discard View
              </button>
              <button
                onClick={async () => {
                  await onRecordAction({
                    id: uuidv4(),
                    type: "DOCUMENT",
                    timestamp: new Date().toISOString(),
                    actorId: user.id,
                    actorName: user.name,
                    message:
                      "Bill of Lading (BOL) Submitted via Driver Interface",
                    loadId:
                      session.primaryContext?.type === "LOAD"
                        ? session.primaryContext.id
                        : undefined,
                    payload: {
                      docType: "BOL",
                      status: "SUBMITTED",
                      source: "MOBILE_INTAKE",
                    },
                  });
                  setShowDocForm(false);
                  showSuccessMessage(
                    "BOL Successfully Uploaded to Depository",
                    3000,
                  );
                }}
                className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.3em] shadow-lg shadow-indigo-900/40 active:scale-95 transition-all outline-none"
              >
                Authorize Depository Push
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotifyPicker && (
        <div className="absolute inset-0 z-[1200] bg-[#050810]/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-2xl bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
            <div className="h-20 px-10 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Bell className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[13px] font-black text-white uppercase tracking-widest italic">
                    Multi-Channel Stakeholder Alert
                  </h3>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Select recipients for emergency broadcast
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNotifyPicker(false)}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-all group"
              >
                <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                {notificationContacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => {
                      if (selectedContacts.includes(contact.id)) {
                        setSelectedContacts((prev) =>
                          prev.filter((id) => id !== contact.id),
                        );
                      } else {
                        setSelectedContacts((prev) => [...prev, contact.id]);
                      }
                    }}
                    className={`p-4 border rounded-2xl flex items-center gap-4 transition-all text-left ${selectedContacts.includes(contact.id) ? "bg-blue-600/10 border-blue-500/50 shadow-lg" : "bg-white/5 border-white/5 hover:border-white/10"}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${selectedContacts.includes(contact.id) ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-500"}`}
                    >
                      {(contact.name ?? "?").charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-white uppercase truncate">
                        {contact.name}
                      </div>
                      <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                        {(contact as any).role}
                      </div>
                    </div>
                    {selectedContacts.includes(contact.id) && (
                      <CheckCircle className="w-4 h-4 text-blue-500" />
                    )}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <label
                  htmlFor="notify-briefing"
                  className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1"
                >
                  Emergency Briefing
                </label>
                <textarea
                  id="notify-briefing"
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl p-6 text-[11px] font-medium text-slate-300 h-32 resize-none outline-none focus:border-blue-500 transition-all shadow-inner"
                  placeholder="Enter the message for broadcast..."
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-8 bg-slate-900 border-t border-white/5 flex justify-end items-center gap-6">
              <button
                onClick={() => setShowNotifyPicker(false)}
                className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={sendNotificationJob}
                className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-3"
              >
                <Zap className="w-4 h-4" /> Trigger Alert Job
              </button>
            </div>
          </div>
        </div>
      )}

      {showRoadsideForm && (
        <div className="absolute inset-0 z-[1200] bg-[#050810]/98 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="w-full max-w-xl bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 duration-500">
            <div className="h-20 px-10 flex items-center justify-between border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                  <Wrench className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-[13px] font-black text-white uppercase tracking-widest italic">
                    Roadside Recovery Dispatch
                  </h3>
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Select vendor for mission-critical repair
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRoadsideForm(false)}
                className="p-2.5 hover:bg-white/5 rounded-xl transition-all group"
              >
                <X className="w-5 h-5 text-slate-500 group-hover:text-white" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                  Verified Vendor Network
                </label>
                <div className="space-y-3">
                  {roadsideVendors.map((vendor) => (
                    <button
                      key={vendor.id}
                      onClick={() => setSelectedVendorForRoadside(vendor)}
                      className={`w-full p-5 border rounded-2xl flex items-center justify-between transition-all ${selectedVendorForRoadside?.id === vendor.id ? "bg-orange-600/10 border-orange-500/50 shadow-lg" : "bg-white/5 border-white/5 hover:border-white/10"}`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedVendorForRoadside?.id === vendor.id ? "bg-orange-500 text-white" : "bg-slate-800 text-slate-500"}`}
                        >
                          <Truck className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <div className="text-[11px] font-black text-white uppercase">
                            {vendor.name}
                          </div>
                          <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                            {vendor.type} • {vendor.status}
                          </div>
                        </div>
                      </div>
                      {selectedVendorForRoadside?.id === vendor.id && (
                        <CheckCircle className="w-4 h-4 text-orange-500" />
                      )}
                    </button>
                  ))}
                  <div className="w-full p-5 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center justify-center gap-3">
                    <Plus className="w-4 h-4" /> Temporary vendors must be
                    onboarded as entities first
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <label
                  htmlFor="roadside-damage-report"
                  className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1"
                >
                  Tactical Damage Report
                </label>
                <textarea
                  id="roadside-damage-report"
                  className="w-full bg-slate-950 border border-white/5 rounded-2xl p-6 text-[11px] font-medium text-slate-300 h-24 resize-none outline-none focus:border-orange-500 transition-all shadow-inner"
                  placeholder="Specify repair requirements..."
                  value={roadsideNotes}
                  onChange={(e) => setRoadsideNotes(e.target.value)}
                ></textarea>
              </div>
            </div>
            <div className="p-8 bg-slate-900 border-t border-white/5 flex justify-end items-center gap-6">
              <button
                onClick={() => setShowRoadsideForm(false)}
                className="text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
              >
                Abort Dispatch
              </button>
              <button
                onClick={submitRoadsideDispatch}
                className="px-10 py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/20 active:scale-95 transition-all flex items-center gap-3"
              >
                <Navigation className="w-4 h-4" /> Authorize & Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
