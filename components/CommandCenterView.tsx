import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useAutoFeedback } from "../hooks/useAutoFeedback";
import {
  AlertTriangle,
  ShieldAlert,
  Truck,
  MapPin,
  Clock,
  ChevronRight,
  ArrowRight,
  MessageSquare,
  Plus,
  Settings,
  User as UserIcon,
  Phone,
  Zap,
  Wrench,
  CheckCircle,
  AlertCircle,
  Timer,
  FileText,
  DollarSign,
  Maximize2,
  Navigation,
  HeartPulse,
  Search,
  Filter,
  Workflow,
  History,
  CreditCard,
  ShieldCheck,
  X,
  Package,
  BarChart3,
  LayoutDashboard,
  Activity,
  Layers,
  Map as MapIcon,
  Wifi,
  WifiOff,
  Bell,
  ArrowUpRight,
  Lock,
  Unlock,
  RefreshCw,
  ClipboardList,
} from "lucide-react";
import { DispatchIntelligence } from "../services/dispatchIntelligence";
import {
  Incident,
  LoadData,
  IncidentSeverity,
  IncidentType,
  WorkspaceSession,
  ContextRecord,
  User as UserType,
  ServiceTicket,
  Provider,
  EmergencyCharge,
  WorkItem,
  EntityType,
  OperationalEvent,
} from "../types";
import { v4 as uuidv4 } from "uuid";
import {
  getIncidents,
  createIncident,
  saveIncident,
  saveLoad,
  getRecord360Data,
  initiateRepowerWorkflow as initiateRepower,
} from "../services/storageService";
import {
  getServiceTickets,
  saveServiceTicket,
  getVendors,
  checkDriverCompliance,
} from "../services/safetyService";
import { GlobalMapViewEnhanced } from "./GlobalMapViewEnhanced";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { EmptyState } from "./ui/EmptyState";

interface Props {
  session: WorkspaceSession;
  loads: LoadData[];
  users: UserType[];
  currentUser: UserType;
  onRecordAction: (e: any) => Promise<void>;
  onNavigate?: (tab: string, context?: any) => void;
  openRecordWorkspace: (type: any, id: string) => void;
  incidents?: Incident[];
  workItems?: WorkItem[];
  onRepower?: (loadId: string) => void;
  activeRecord?: ContextRecord | null;
  active360Data?: any;
  onCloseContext?: () => void;
  activeSubTab?: string;
  unifiedEvents?: OperationalEvent[];
  isHighObstruction?: boolean;
  obstructionLevel?: "NOMINAL" | "MODERATE" | "HIGH" | "CRITICAL";
  onViewFullLoad?: (load: LoadData) => void;
  onRoadside?: () => void;
  onNotify?: () => void;
  setSuccessMessage?: (msg: string | null) => void;
  refreshQueues?: () => Promise<void>;
  isLoading?: boolean;
  loadError?: string | null;
  onRetryLoad?: () => void;
}

export const CommandCenterView: React.FC<Props> = ({
  session,
  loads,
  users,
  currentUser,
  onRecordAction,
  onNavigate,
  openRecordWorkspace,
  incidents: propsIncidents,
  workItems = [],
  onRepower,
  activeRecord,
  active360Data,
  activeSubTab,
  unifiedEvents = [],
  isHighObstruction,
  obstructionLevel = "NOMINAL",
  onViewFullLoad,
  onCloseContext,
  onRoadside,
  onNotify,
  setSuccessMessage,
  isLoading,
  loadError,
  onRetryLoad,
}) => {
  // Managed feedback: auto-clears with cleanup on unmount, syncs to optional prop
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (msgTimerRef.current !== null) {
        clearTimeout(msgTimerRef.current);
        msgTimerRef.current = null;
      }
    };
  }, []);
  const showManagedMessage = useCallback(
    (msg: string | null, durationMs = 3000) => {
      if (!setSuccessMessage) return;
      if (msgTimerRef.current !== null) clearTimeout(msgTimerRef.current);
      setSuccessMessage(msg);
      msgTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setSuccessMessage(null);
        msgTimerRef.current = null;
      }, durationMs);
    },
    [setSuccessMessage],
  );
  const [localIncidents, setLocalIncidents] = useState<Incident[]>([]);
  const incidents = useMemo(() => {
    if (Array.isArray(propsIncidents) && propsIncidents.length > 0)
      return propsIncidents;
    return Array.isArray(localIncidents) ? localIncidents : [];
  }, [propsIncidents, localIncidents]);
  // Track sync time when props incidents arrive from parent
  useEffect(() => {
    if (Array.isArray(propsIncidents) && propsIncidents.length > 0) {
      setLastSyncTime(new Date());
    }
  }, [propsIncidents]);
  const safeWorkItems = Array.isArray(workItems) ? workItems : [];
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(
    null,
  );
  const [userManuallyClosed, setUserManuallyClosed] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<
    "info" | "timeline" | "billing" | "docs" | "fuel"
  >("info");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [newRecordDropdownOpen, setNewRecordDropdownOpen] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Width management for the detail drawer
  const drawerWidth = useMemo(() => {
    if (windowWidth < 1440) return "w-[280px]";
    if (windowWidth < 1600) return "w-[340px]";
    return "w-[400px]";
  }, [windowWidth]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchLocal = async () => {
      try {
        if (!propsIncidents || propsIncidents.length === 0) {
          const incs = await getIncidents();
          if (controller.signal.aborted) return;
          setLocalIncidents(incs);
          setLastSyncTime(new Date());
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (controller.signal.aborted) return;
      }
    };
    fetchLocal();
    const interval = setInterval(fetchLocal, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [propsIncidents]);

  const selectedIncident = useMemo(
    () => incidents.find((i) => i.id === selectedIncidentId),
    [incidents, selectedIncidentId],
  );

  // Sync with global session context
  useEffect(() => {
    if (
      session.primaryContext?.type === "INCIDENT" &&
      session.primaryContext.id !== selectedIncidentId
    ) {
      setSelectedIncidentId(session.primaryContext.id);
    }
  }, [session.primaryContext, selectedIncidentId]);

  // Auto-select most critical incident - ONLY on large screens or if it's the primary context
  useEffect(() => {
    if (
      !selectedIncidentId &&
      incidents.length > 0 &&
      !session.primaryContext &&
      !userManuallyClosed
    ) {
      // Intelligent space: don't auto-open if screen is narrow, let them see the map/triage first
      if (windowWidth < 1440) return;

      const critical = incidents.find(
        (i) => i.severity === "Critical" && i.status !== "Closed",
      );
      const high = incidents.find(
        (i) => i.severity === "High" && i.status !== "Closed",
      );
      if (critical || high) {
        setSelectedIncidentId(critical?.id || high?.id || incidents[0].id);
      }
    }
  }, [
    incidents,
    selectedIncidentId,
    session.primaryContext,
    userManuallyClosed,
    windowWidth,
  ]);

  // Clear incident selection if a different record type is opened
  useEffect(() => {
    if (session.primaryContext && session.primaryContext.type !== "INCIDENT") {
      setSelectedIncidentId(null);
    }
  }, [session.primaryContext]);

  // Map external sub-tabs to internal tabs
  useEffect(() => {
    if (activeSubTab) {
      const tab = activeSubTab.toUpperCase();
      if (tab === "DETENTION" || tab === "FINANCE")
        setActiveDetailTab("billing");
      else if (tab === "TIMELINE") setActiveDetailTab("timeline");
      else if (tab === "DOCS") setActiveDetailTab("docs");
      else setActiveDetailTab("info");
    }
  }, [activeSubTab]);

  const associatedLoad = useMemo(
    () =>
      selectedIncident
        ? loads.find((l) => l.id === selectedIncident.loadId)
        : null,
    [selectedIncident, loads],
  );

  const slaStatus = (deadline?: string) => {
    if (!deadline) return { label: "NO SLA", color: "text-slate-600" };
    const remaining = new Date(deadline).getTime() - Date.now();
    if (remaining < 0) return { label: "BREACHED", color: "text-red-500" };
    const mins = Math.floor(remaining / 60000);
    return {
      label: `${mins}m left`,
      color: mins < 15 ? "text-orange-500" : "text-blue-500",
    };
  };

  const handleAction = async (actionType: string) => {
    if (!selectedIncident) return;

    let updatedIncident = {
      ...selectedIncident,
      timeline: selectedIncident.timeline ?? [],
    };
    const timestamp = new Date().toISOString();

    if (actionType === "CLOSE") {
      updatedIncident.status = "Closed";
      updatedIncident.timeline.push({
        id: uuidv4(),
        timestamp,
        actorName: currentUser.name,
        action: "INCIDENT_CLOSED",
        notes: "Incident resolved and closed via Command Center",
      });
      await saveIncident(updatedIncident);
    } else if (actionType === "REPOWER") {
      if (onRepower) onRepower(selectedIncident.loadId);
      else
        await initiateRepower(
          selectedIncident.loadId,
          currentUser,
          "Repower initiated from Command Center",
        );
    } else if (actionType === "ROADSIDE") {
      if (onRoadside) onRoadside();
      else {
        updatedIncident.timeline.push({
          id: uuidv4(),
          timestamp,
          actorName: currentUser.name,
          action: "ROADSIDE_DISPATCHED",
          notes: "Vendor dispatched for roadside assistance",
        });
        await saveIncident(updatedIncident);
      }
    } else if (actionType === "RECOVERY") {
      updatedIncident.timeline.push({
        id: uuidv4(),
        timestamp,
        actorName: currentUser.name,
        action: "RECOVERY_INITIATED",
        notes: "Tow service dispatched",
      });
      await saveIncident(updatedIncident);
    } else if (actionType === "NOTIFY") {
      if (onNotify) onNotify();
      else {
        updatedIncident.timeline.push({
          id: uuidv4(),
          timestamp,
          actorName: currentUser.name,
          action: "STAKEHOLDERS_NOTIFIED",
          notes: "Sent alert to all relevant parties",
        });
        await saveIncident(updatedIncident);
      }
    }

    if (actionType === "CLOSE") {
      setSelectedIncidentId(null);
      setUserManuallyClosed(true);
      if (onCloseContext) onCloseContext();
    }

    const currentIncs = await getIncidents();
    setLocalIncidents(currentIncs);
    await onRecordAction({
      id: uuidv4(),
      type: "SYSTEM",
      timestamp,
      actorId: currentUser.id,
      actorName: currentUser.name,
      message: `Action ${actionType} triggered on Incident ${selectedIncident.id}`,
    });

    // Integrated UI feedback for testing
    if (actionType === "REPOWER") {
      showManagedMessage(
        "REPOWER WORKFLOW INITIATED: Evaluating fallback carriers and nearest available units.",
        4000,
      );
    } else if (actionType === "ROADSIDE") {
      showManagedMessage(
        "SERVICE DISPATCHED: Roadside assistance units have been notified and tracked via GPS.",
        4000,
      );
    }
  };

  const getSeverityStyle = (s: IncidentSeverity) => {
    switch (s) {
      case "Critical":
        return "border-red-500/50 bg-red-500/10 text-red-500";
      case "High":
        return "border-orange-500/50 bg-orange-500/10 text-orange-500";
      case "Medium":
        return "border-yellow-500/50 bg-yellow-500/10 text-yellow-500";
      default:
        return "border-blue-500/50 bg-blue-500/10 text-blue-500";
    }
  };

  // Operational stream status derived from active incident severity
  const openIncidents = incidents.filter((i) => i.status !== "Closed");
  const operationalStreamStatus = (() => {
    if (openIncidents.some((i) => i.severity === "Critical")) return "CRITICAL";
    if (openIncidents.some((i) => i.severity === "High")) return "ELEVATED";
    return "Nominal";
  })();
  const operationalStreamColor =
    operationalStreamStatus === "CRITICAL"
      ? "text-red-400"
      : operationalStreamStatus === "ELEVATED"
        ? "text-orange-400"
        : "text-white";

  // Connected units: drivers (role "driver") with an active load are considered online
  const driverUsers = users?.filter((u) => u.role === "driver") ?? [];
  const totalUnits = driverUsers.length;
  const activeLoadDriverIds = new Set(
    loads
      .filter((l) => l.status === "in_transit" || l.status === "dispatched")
      .map((l) => l.driverId)
      .filter(Boolean),
  );
  const connectedCount = driverUsers.filter((u) =>
    activeLoadDriverIds.has(u.id),
  ).length;
  const unitsLabel =
    totalUnits === 0
      ? "No Units Connected"
      : `${connectedCount}/${totalUnits} Units Online`;

  // Relative sync time label
  const syncLabel = (() => {
    if (!lastSyncTime) return "Awaiting Data";
    const diffMs = Date.now() - lastSyncTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 5) return "Just Now";
    if (diffSec < 60) return `${diffSec}s Ago`;
    const diffMin = Math.floor(diffSec / 60);
    return `${diffMin}m Ago`;
  })();

  return (
    <div className="flex-1 flex flex-col bg-[#020617] h-full overflow-hidden font-inter">
      {isLoading && (
        <div className="flex-1 flex items-center justify-center p-8">
          <LoadingSkeleton variant="card" count={4} />
        </div>
      )}
      {!isLoading && loadError && (
        <div className="flex-1 flex items-center justify-center">
          <ErrorState message={loadError} onRetry={onRetryLoad ?? (() => {})} />
        </div>
      )}
      {!isLoading &&
        !loadError &&
        incidents.length === 0 &&
        loads.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<AlertTriangle className="w-12 h-12" />}
              title="No incidents or loads"
              description="The command center is clear. Incidents and loads will appear here when detected."
            />
          </div>
        )}
      {!isLoading &&
        !loadError &&
        (incidents.length > 0 || loads.length > 0) && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Detail Drawer (Unified Incident & Record Workspace) */}
            <aside
              className={`${drawerWidth} shrink-0 border-r border-white/5 bg-[#0a0f1e]/80 backdrop-blur-3xl flex flex-col z-10 animate-in slide-in-from-left duration-500 shadow-[20px_0_50px_rgba(0,0,0,0.5)]`}
            >
              {!selectedIncident && !activeRecord ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-8 bg-slate-950/40 border-b border-white/5 space-y-8">
                    <div className="flex justify-between items-end">
                      <div>
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">
                          Dispatch Center
                        </div>
                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                          Issue Queue
                        </h2>
                      </div>
                      <div className="flex gap-2">
                        <div className="relative group">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within:text-blue-500" />
                          <input
                            type="text"
                            placeholder="Search triage..."
                            aria-label="Search triage queue"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-950 border border-white/5 rounded-xl pl-9 pr-4 py-2 text-[10px] text-white outline-none focus:border-blue-500/50 transition-all w-48"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
                      {[
                        {
                          id: "all",
                          label: "All Items",
                          count: incidents.length + safeWorkItems.length,
                        },
                        {
                          id: "Critical",
                          label: "Critical",
                          count:
                            incidents.filter((i) => i.severity === "Critical")
                              .length +
                            safeWorkItems.filter(
                              (w) => w.priority === "Critical",
                            ).length,
                        },
                        {
                          id: "High",
                          label: "High Priority",
                          count:
                            incidents.filter((i) => i.severity === "High")
                              .length +
                            safeWorkItems.filter((w) => w.priority === "High")
                              .length,
                        },
                        {
                          id: "tasks",
                          label: "Operational Tasks",
                          count: safeWorkItems.length,
                        },
                      ].map((filter) => (
                        <button
                          key={filter.id}
                          onClick={() => setFilterSeverity(filter.id)}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${filterSeverity === filter.id ? "bg-blue-600 border-blue-500 text-white shadow-lg" : "bg-slate-950/50 border-white/5 text-slate-500 hover:text-white"}`}
                        >
                          {filter.label}{" "}
                          <span className="ml-1.5 opacity-50 px-1.5 py-0.5 bg-black/40 rounded-md">
                            {filter.count}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() =>
                          setNewRecordDropdownOpen(!newRecordDropdownOpen)
                        }
                        className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(37,99,235,0.3)] transition-all group"
                      >
                        <Plus
                          className={`w-5 h-5 transition-transform duration-300 ${newRecordDropdownOpen ? "rotate-45" : ""}`}
                        />
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          New Record & Attach
                        </span>
                      </button>

                      {newRecordDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-3 bg-[#0f172a] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl z-50 animate-in fade-in slide-in-from-top-4 duration-300">
                          {[
                            {
                              label: "New Quote",
                              icon: DollarSign,
                              color: "text-emerald-400",
                              action: () => onNavigate?.("quotes"),
                            },
                            {
                              label: "New Load",
                              icon: Truck,
                              color: "text-blue-400",
                              action: () => onNavigate?.("loads"),
                            },
                            {
                              label: "New Incident",
                              icon: ShieldAlert,
                              color: "text-red-400",
                              action: () => onNavigate?.("safety"),
                            },
                            {
                              label: "Attach Existing",
                              icon: Layers,
                              color: "text-slate-400",
                              action: () => {
                                showManagedMessage(
                                  "Connecting record - select which item to link...",
                                  3000,
                                );
                              },
                            },
                          ].map((opt, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                opt.action();
                                setNewRecordDropdownOpen(false);
                              }}
                              className="w-full px-8 py-5 flex items-center gap-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition-all text-left"
                            >
                              <opt.icon className={`w-4 h-4 ${opt.color}`} />
                              <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                {opt.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
                    {/* Filtered Triage List */}
                    {(
                      [
                        ...incidents.map((i) => ({
                          ...i,
                          category: "INCIDENT" as const,
                        })),
                        ...safeWorkItems.map((w) => ({
                          ...w,
                          category: "TASK" as const,
                        })),
                      ] as Array<
                        | (Incident & { category: "INCIDENT" })
                        | (WorkItem & { category: "TASK" })
                      >
                    )
                      .filter((item) => {
                        const label =
                          item.category === "TASK" ? item.label : "";
                        const matchesSearch =
                          (item.type || label || "")
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase()) ||
                          (item.description || "")
                            .toLowerCase()
                            .includes(searchTerm.toLowerCase());
                        const itemSeverityOrPriority =
                          item.category === "INCIDENT"
                            ? item.severity
                            : item.priority;
                        const matchesSeverity =
                          filterSeverity === "all" ||
                          (filterSeverity === "tasks" &&
                            item.category === "TASK") ||
                          itemSeverityOrPriority === filterSeverity;
                        return matchesSearch && matchesSeverity;
                      })
                      .sort((a, b) => {
                        const pMap: Record<string, number> = {
                          Critical: 3,
                          High: 2,
                          Medium: 1,
                          Low: 0,
                        };
                        const aPriority =
                          a.category === "INCIDENT" ? a.severity : a.priority;
                        const bPriority =
                          b.category === "INCIDENT" ? b.severity : b.priority;
                        return (pMap[bPriority] || 0) - (pMap[aPriority] || 0);
                      })
                      .map((item, idx) => {
                        const severityOrPriority =
                          item.category === "INCIDENT"
                            ? item.severity
                            : item.priority;
                        const displayLabel =
                          item.category === "TASK"
                            ? item.type || item.label
                            : item.type;
                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              if (item.category === "INCIDENT")
                                setSelectedIncidentId(item.id);
                              else
                                openRecordWorkspace(
                                  item.entityType,
                                  item.entityId,
                                );
                            }}
                            className="p-5 bg-white/5 border border-white/5 rounded-3xl hover:border-blue-500/30 hover:bg-white/10 transition-all cursor-pointer group animate-in fade-in slide-in-from-bottom-2 duration-300"
                            style={{ animationDelay: `${idx * 50}ms` }}
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-2 rounded-xl border ${item.category === "INCIDENT" ? getSeverityStyle(item.severity) : "bg-slate-800 border-white/5 text-slate-400"}`}
                                >
                                  {item.category === "INCIDENT" ? (
                                    <ShieldAlert className="w-4 h-4" />
                                  ) : (
                                    <ClipboardList className="w-4 h-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="text-[11px] font-black text-white uppercase tracking-tighter truncate max-w-[180px]">
                                    {displayLabel}
                                  </div>
                                  <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                                    {item.category} • {item.id.slice(0, 8)}
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg border ${severityOrPriority === "Critical" ? "border-red-500/30 text-red-500 bg-red-500/10" : "border-blue-500/30 text-blue-500 bg-blue-500/10"}`}
                              >
                                {severityOrPriority}
                              </div>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-2 opacity-80 leading-relaxed mb-4 italic">
                              "{item.description}"
                            </p>
                            <div className="flex justify-between items-center pt-4 border-t border-white/5">
                              <div className="flex items-center gap-3">
                                <div className="flex -space-x-2">
                                  {[1, 2].map((i) => (
                                    <div
                                      key={i}
                                      className="w-6 h-6 rounded-full bg-slate-800 border-2 border-[#0a0f1e] flex items-center justify-center text-[8px] font-black text-slate-500"
                                    >
                                      <UserIcon className="w-3 h-3" />
                                    </div>
                                  ))}
                                </div>
                                <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">
                                  Linked Response Team
                                </span>
                              </div>
                              <ChevronRight className="w-4 h-4 text-slate-700 group-hover:text-blue-500 transition-colors" />
                            </div>
                          </div>
                        );
                      })}
                    {incidents.length === 0 && safeWorkItems.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                        <Activity className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                          Operational Workspace Resting
                          <br />
                          No Triage Items Detected
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div
                    className={`${isHighObstruction ? "p-4" : "p-8"} border-b border-white/5 ${isHighObstruction ? "space-y-4" : "space-y-6"} bg-slate-950/40`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div
                          className={`flex items-center gap-3 ${isHighObstruction ? "mb-1" : "mb-2"}`}
                        >
                          <div
                            className={`p-2.5 rounded-2xl ${selectedIncident ? getSeverityStyle(selectedIncident.severity) : "bg-blue-500/10 text-blue-400 border border-blue-500/20"} ${isHighObstruction ? "scale-90" : ""}`}
                          >
                            {selectedIncident ? (
                              <ShieldAlert className="w-5 h-5" />
                            ) : activeRecord?.type === "LOAD" ? (
                              <Truck className="w-5 h-5" />
                            ) : (
                              <UserIcon className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h2
                              className={`${isHighObstruction ? "text-lg" : "text-xl"} font-black text-white uppercase tracking-tighter italic leading-tight`}
                            >
                              {selectedIncident
                                ? selectedIncident.type
                                : activeRecord?.label}
                            </h2>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                                {selectedIncident
                                  ? `Incident #${selectedIncident.id.slice(0, 8)}`
                                  : `${activeRecord?.type} Context`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {!isHighObstruction &&
                          onViewFullLoad &&
                          active360Data?.load && (
                            <button
                              onClick={() => onViewFullLoad(active360Data.load)}
                              className="p-2 hover:bg-blue-600/20 hover:text-blue-400 rounded-xl text-slate-500 transition-all"
                              title="View Full Workspace"
                            >
                              <Maximize2 className="w-5 h-5" />
                            </button>
                          )}
                        <button
                          onClick={() => {
                            setSelectedIncidentId(null);
                            setUserManuallyClosed(true);
                            if (onCloseContext) onCloseContext();
                          }}
                          className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-xl text-slate-500 transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div
                      className={`grid grid-cols-2 ${isHighObstruction ? "gap-2" : "gap-4"}`}
                    >
                      <div
                        className={`${isHighObstruction ? "p-2.5" : "p-4"} bg-slate-950/60 rounded-2xl border border-white/5 backdrop-blur-md`}
                      >
                        <div className="text-[8px] font-black text-slate-600 uppercase mb-1 tracking-widest">
                          Status
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                          <span
                            className={`${isHighObstruction ? "text-[12px]" : "text-[11px]"} font-black text-white uppercase`}
                          >
                            {selectedIncident
                              ? selectedIncident.status
                              : "ACTIVE"}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`${isHighObstruction ? "p-2.5" : "p-4"} bg-slate-950/60 rounded-2xl border border-white/5 backdrop-blur-md`}
                      >
                        <div className="text-[8px] font-black text-slate-600 uppercase mb-1 tracking-widest">
                          Alert
                        </div>
                        <div
                          className={`${isHighObstruction ? "text-[12px]" : "text-[11px]"} font-black uppercase ${selectedIncident?.severity === "Critical" ? "text-red-500" : "text-blue-500"}`}
                        >
                          {selectedIncident
                            ? slaStatus(selectedIncident.slaDeadline).label
                            : "Nominal"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto no-scrollbar">
                    <div
                      className={`${isHighObstruction ? "px-4 py-3" : "px-8 py-6"} border-b border-white/5 flex gap-8 sticky top-0 bg-[#0a0f1e]/90 backdrop-blur-xl z-20 overflow-x-auto no-scrollbar`}
                    >
                      {[
                        { id: "info", label: "Summary", icon: LayoutDashboard },
                        {
                          id: "timeline",
                          label: "Chain of Custody",
                          icon: History,
                        },
                        ...(activeRecord?.type === "LOAD"
                          ? [
                              {
                                id: "billing",
                                label: "Financials",
                                icon: DollarSign,
                              },
                              {
                                id: "docs",
                                label: "Artifacts",
                                icon: FileText,
                              },
                              { id: "fuel", label: "Optimization", icon: Zap },
                            ]
                          : []),
                        ...(selectedIncident
                          ? [
                              {
                                id: "billing",
                                label: "Emergency Costs",
                                icon: DollarSign,
                              },
                            ]
                          : []),
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() =>
                            setActiveDetailTab(
                              tab.id as
                                | "info"
                                | "timeline"
                                | "billing"
                                | "docs"
                                | "fuel",
                            )
                          }
                          className={`pb-4 text-[9px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2 shrink-0 ${activeDetailTab === tab.id ? "border-blue-500 text-white shadow-[0_4px_12px_rgba(59,130,246,0.2)]" : "border-transparent text-slate-600 hover:text-slate-400"}`}
                        >
                          <tab.icon className="w-3.5 h-3.5" />{" "}
                          {!isHighObstruction && tab.label}
                        </button>
                      ))}
                    </div>

                    <div
                      className={`${isHighObstruction ? "p-4" : "p-8"} ${isHighObstruction ? "space-y-4" : "space-y-8"} pb-32`}
                    >
                      {activeDetailTab === "info" && (
                        <div
                          className={`${isHighObstruction ? "space-y-4" : "space-y-8"} animate-in fade-in slide-in-from-bottom-4 duration-500`}
                        >
                          {selectedIncident && (
                            <section className="space-y-2">
                              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                Crisis Workflow Chain
                              </h3>
                              <div
                                className={`${isHighObstruction ? "p-4 rounded-3xl" : "p-8 rounded-[2.5rem]"} bg-slate-950/80 border border-white/10 relative overflow-hidden shadow-2xl`}
                              >
                                <div className="absolute top-0 right-0 w-40 h-40 bg-blue-600/5 blur-3xl rounded-full" />
                                <div className="flex justify-between items-center relative z-10 px-4">
                                  {[
                                    {
                                      id: "Safety",
                                      label: "Safety (Report)",
                                      icon: ShieldCheck,
                                      activeStatus: [
                                        "Open",
                                        "Active",
                                        "In_Progress",
                                        "Critical",
                                        "Closed",
                                      ],
                                      color: "blue",
                                    },
                                    {
                                      id: "Dispatch",
                                      label: "Dispatch (Action)",
                                      icon: Zap,
                                      activeStatus: [
                                        "In_Progress",
                                        "Critical",
                                        "Closed",
                                      ],
                                      color: "orange",
                                    },
                                    {
                                      id: "Driver",
                                      label: "Driver (Resolution)",
                                      icon: Truck,
                                      activeStatus: ["Closed"],
                                      color: "green",
                                    },
                                  ].map((step, idx, arr) => {
                                    const isActive = step.activeStatus.includes(
                                      selectedIncident.status,
                                    );
                                    const isCurrent =
                                      (step.id === "Safety" &&
                                        selectedIncident.status === "Open") ||
                                      (step.id === "Dispatch" &&
                                        (selectedIncident.status ===
                                          "In_Progress" ||
                                          selectedIncident.status ===
                                            "Critical")) ||
                                      (step.id === "Driver" &&
                                        selectedIncident.status === "Closed");

                                    return (
                                      <React.Fragment key={step.id}>
                                        <div className="flex flex-col items-center gap-2 group">
                                          <button
                                            onClick={() => {
                                              if (
                                                step.id === "Dispatch" &&
                                                selectedIncident.status ===
                                                  "Open"
                                              )
                                                handleAction("TAKE");
                                              if (
                                                step.id === "Driver" &&
                                                (selectedIncident.status ===
                                                  "In_Progress" ||
                                                  selectedIncident.status ===
                                                    "Critical")
                                              )
                                                handleAction("CLOSE");
                                            }}
                                            className={`${isHighObstruction ? "w-8 h-8" : "w-12 h-12"} rounded-full ${isActive ? `bg-${step.color}-600 shadow-lg shadow-${step.color}-500/20` : "bg-slate-800"} flex items-center justify-center border-2 ${isCurrent ? `border-${step.color}-400 animate-pulse` : "border-slate-900"} transition-all hover:scale-110 active:scale-90`}
                                          >
                                            <step.icon
                                              className={`${isHighObstruction ? "w-4 h-4" : "w-6 h-6"} ${isActive ? "text-white" : "text-slate-600"}`}
                                            />
                                          </button>
                                          <span
                                            className={`text-[8px] font-black uppercase tracking-widest ${isActive ? `text-${step.color}-500` : "text-slate-600"}`}
                                          >
                                            {step.id}
                                          </span>
                                        </div>
                                        {idx < arr.length - 1 && (
                                          <div
                                            className={`flex-1 h-[1px] mb-5 mx-2 bg-gradient-to-r ${isActive ? `from-${step.color}-500 to-${arr[idx + 1].color}-500/30` : "from-slate-800 to-slate-800"}`}
                                          />
                                        )}
                                      </React.Fragment>
                                    );
                                  })}
                                </div>
                              </div>
                            </section>
                          )}

                          {activeRecord?.type === "LOAD" && (
                            <section
                              className={`${isHighObstruction ? "space-y-2" : "space-y-4"}`}
                            >
                              <div className="flex justify-between items-center px-1">
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                  Manifest Integrity Overview
                                </h3>
                                <div
                                  className={`px-2 py-0.5 rounded-lg text-[8px] font-black border ${DispatchIntelligence.predictExceptionRisk(active360Data?.load).risk === "LOW" ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-red-500/30 text-red-500 bg-red-500/10"}`}
                                >
                                  AI RISK:{" "}
                                  {
                                    DispatchIntelligence.predictExceptionRisk(
                                      active360Data?.load,
                                    ).risk
                                  }
                                </div>
                              </div>
                              <div
                                className={`grid grid-cols-2 ${isHighObstruction ? "gap-2" : "gap-4"}`}
                              >
                                <div
                                  className={`${isHighObstruction ? "p-3" : "p-4"} bg-slate-900 border border-white/5 rounded-2xl`}
                                >
                                  <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                                    Status
                                  </div>
                                  <div
                                    className={`${isHighObstruction ? "text-[12px]" : "text-[11px]"} font-black text-white uppercase`}
                                  >
                                    {active360Data?.load?.status ||
                                      "In Transit"}
                                  </div>
                                </div>
                                <div
                                  className={`${isHighObstruction ? "p-3" : "p-4"} bg-slate-900 border border-white/5 rounded-2xl`}
                                >
                                  <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                                    Rate
                                  </div>
                                  <div
                                    className={`${isHighObstruction ? "text-[12px]" : "text-[11px]"} font-black text-white uppercase`}
                                  >
                                    $
                                    {active360Data?.load?.totalRevenue?.toLocaleString() ||
                                      active360Data?.load?.carrierRate?.toLocaleString() ||
                                      "2,400"}
                                  </div>
                                </div>
                                <div
                                  className={`${isHighObstruction ? "p-3" : "p-4"} bg-slate-900 border border-white/5 rounded-2xl`}
                                >
                                  <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                                    Commodity
                                  </div>
                                  <div
                                    className={`${isHighObstruction ? "text-[12px]" : "text-[11px]"} font-black text-white uppercase truncate`}
                                  >
                                    {active360Data?.load?.commodity ||
                                      "General Freight"}
                                  </div>
                                </div>
                                <div
                                  className={`${isHighObstruction ? "p-3" : "p-4"} bg-slate-900 border border-white/5 rounded-2xl`}
                                >
                                  <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                                    Weight
                                  </div>
                                  <div
                                    className={`${isHighObstruction ? "text-[12px]" : "text-[11px]"} font-black text-white uppercase`}
                                  >
                                    {active360Data?.load?.weight?.toLocaleString() ||
                                      "44,000"}{" "}
                                    lbs
                                  </div>
                                </div>
                              </div>
                              {DispatchIntelligence.predictExceptionRisk(
                                active360Data?.load,
                              ).risk !== "LOW" && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                                  <AlertTriangle className="w-4 h-4 text-red-500" />
                                  <div className="text-[10px] font-bold text-red-400 uppercase tracking-tight">
                                    AI Alert:{" "}
                                    {
                                      DispatchIntelligence.predictExceptionRisk(
                                        active360Data?.load,
                                      ).reason
                                    }
                                  </div>
                                </div>
                              )}
                            </section>
                          )}

                          {activeRecord?.type === "DRIVER" && (
                            <section className="space-y-4">
                              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                Driver Profile
                              </h3>
                              <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase">
                                    Compliance
                                  </span>
                                  <span className="text-[9px] font-black text-emerald-500 uppercase">
                                    VERIFIED
                                  </span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-bold text-slate-500 uppercase">
                                    Safety Score
                                  </span>
                                  <span className="text-[9px] font-black text-white uppercase">
                                    98/100
                                  </span>
                                </div>
                              </div>
                            </section>
                          )}

                          <section className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                              Network & Asset Linkage
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div
                                onClick={() =>
                                  openRecordWorkspace(
                                    "LOAD",
                                    selectedIncident?.loadId ||
                                      activeRecord?.id ||
                                      "",
                                  )
                                }
                                className="p-5 bg-white/5 rounded-3xl border border-white/5 group hover:border-blue-500/30 hover:bg-white/10 transition-all cursor-pointer shadow-xl"
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="p-2 bg-blue-500/10 rounded-xl">
                                    <Truck className="w-4 h-4 text-blue-500" />
                                  </div>
                                  <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                    Linked Load
                                  </span>
                                </div>
                                <div className="text-[12px] font-black text-white px-1">
                                  #
                                  {selectedIncident?.loadId || activeRecord?.id}
                                </div>
                              </div>
                              <div
                                onClick={() => {
                                  const driverId =
                                    active360Data?.driver?.id ||
                                    loads.find(
                                      (l) => l.id === selectedIncident?.loadId,
                                    )?.driverId;
                                  if (driverId)
                                    openRecordWorkspace("DRIVER", driverId);
                                }}
                                className="p-5 bg-white/5 rounded-3xl border border-white/5 group hover:border-purple-500/30 hover:bg-white/10 transition-all cursor-pointer shadow-xl"
                              >
                                <div className="flex items-center gap-3 mb-3">
                                  <div className="p-2 bg-purple-500/10 rounded-xl">
                                    <UserIcon className="w-4 h-4 text-purple-500" />
                                  </div>
                                  <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                    Assigned Unit
                                  </span>
                                </div>
                                <div className="text-[12px] font-black text-white px-1 truncate">
                                  {active360Data?.driver?.name ||
                                    users.find(
                                      (u) =>
                                        u.id ===
                                        loads.find(
                                          (l) =>
                                            l.id === selectedIncident?.loadId,
                                        )?.driverId,
                                    )?.name ||
                                    "Unassigned"}
                                </div>
                              </div>
                            </div>
                          </section>

                          {selectedIncident && (
                            <>
                              <section
                                className={`${isHighObstruction ? "space-y-2" : "space-y-4"}`}
                              >
                                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                                  Tactical Intervention Matrix
                                </h3>
                                <div
                                  className={`grid grid-cols-2 ${isHighObstruction ? "gap-2" : "gap-4"}`}
                                >
                                  <button
                                    onClick={() => handleAction("REPOWER")}
                                    className={`${isHighObstruction ? "p-4" : "p-6"} bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 rounded-3xl transition-all flex flex-col items-center ${isHighObstruction ? "gap-1.5" : "gap-3"} group shadow-xl`}
                                  >
                                    <RefreshCw
                                      className={`${isHighObstruction ? "w-4 h-4" : "w-6 h-6"} group-hover:rotate-180 transition-transform duration-700`}
                                    />
                                    <span
                                      className={`${isHighObstruction ? "text-[8px]" : "text-[10px]"} font-black uppercase tracking-[0.2em]`}
                                    >
                                      Initiate Repower
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => handleAction("ROADSIDE")}
                                    className={`${isHighObstruction ? "p-4" : "p-6"} bg-orange-600/10 hover:bg-orange-600 text-orange-500 hover:text-white border border-orange-500/20 rounded-3xl transition-all flex flex-col items-center ${isHighObstruction ? "gap-1.5" : "gap-3"} group shadow-xl`}
                                  >
                                    <Wrench
                                      className={`${isHighObstruction ? "w-4 h-4" : "w-6 h-6"} group-hover:scale-110 transition-transform`}
                                    />
                                    <span
                                      className={`${isHighObstruction ? "text-[8px]" : "text-[10px]"} font-black uppercase tracking-[0.2em]`}
                                    >
                                      Service Ticket
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => handleAction("RECOVERY")}
                                    className={`${isHighObstruction ? "p-4" : "p-6"} bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-3xl transition-all flex flex-col items-center ${isHighObstruction ? "gap-1.5" : "gap-3"} group shadow-xl`}
                                  >
                                    <ShieldAlert
                                      className={`${isHighObstruction ? "w-4 h-4" : "w-6 h-6"} group-hover:scale-110 transition-transform`}
                                    />
                                    <span
                                      className={`${isHighObstruction ? "text-[8px]" : "text-[10px]"} font-black uppercase tracking-[0.2em]`}
                                    >
                                      Asset Recovery
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => handleAction("NOTIFY")}
                                    className={`${isHighObstruction ? "p-4" : "p-6"} bg-emerald-600/10 hover:bg-emerald-600 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-3xl transition-all flex flex-col items-center ${isHighObstruction ? "gap-1.5" : "gap-3"} group shadow-xl`}
                                  >
                                    <Bell
                                      className={`${isHighObstruction ? "w-4 h-4" : "w-6 h-6"} group-hover:animate-bounce`}
                                    />
                                    <span
                                      className={`${isHighObstruction ? "text-[8px]" : "text-[10px]"} font-black uppercase tracking-[0.2em]`}
                                    >
                                      Stakeholders
                                    </span>
                                  </button>
                                </div>
                              </section>

                              <button
                                onClick={() => handleAction("CLOSE")}
                                className={`${isHighObstruction ? "py-4 px-2" : "py-5"} w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl font-black ${isHighObstruction ? "text-[13px]" : "text-[12px]"} uppercase tracking-[0.2em] shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-3 group`}
                              >
                                <CheckCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />{" "}
                                Commit Resolution
                              </button>
                            </>
                          )}

                          {/* CONSOLIDATED TIMELINE: Integrated into Summary for 360 Visibility */}
                          <section className="space-y-4 pt-4 border-t border-white/5">
                            <div className="flex items-center justify-between px-1">
                              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                Chain of Custody & Evidence
                              </h3>
                              <button
                                onClick={() => setActiveDetailTab("timeline")}
                                className="text-[8px] font-black text-blue-500 uppercase hover:underline"
                              >
                                View History
                              </button>
                            </div>
                            <div className="relative pl-6 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-px before:bg-white/5 space-y-6">
                              {unifiedEvents
                                .slice(0, 10)
                                .map((event: any, idx: number) => (
                                  <div key={idx} className="relative">
                                    <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-slate-900 border-2 border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" />
                                    <div className="flex justify-between items-center mb-0.5">
                                      <span className="text-[9px] font-black text-white uppercase">
                                        {event.type}
                                      </span>
                                      <span className="text-[8px] font-bold text-slate-600">
                                        {new Date(
                                          event.timestamp,
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 line-clamp-1 opacity-80 italic">
                                      {event.message}
                                    </div>
                                  </div>
                                ))}
                              {unifiedEvents.length === 0 && (
                                <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest py-2">
                                  No tactical activity recorded
                                </div>
                              )}
                            </div>
                          </section>
                        </div>
                      )}

                      {activeDetailTab === "timeline" && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                          {/* Incident Timeline — selectedIncident.timeline rendered as vertical timeline */}
                          {selectedIncident && (
                            <div data-testid="incident-timeline">
                              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <History className="w-3.5 h-3.5" />
                                Incident Timeline
                              </h3>
                              {!selectedIncident.timeline ||
                              selectedIncident.timeline.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 text-[11px]">
                                  No timeline entries yet
                                </div>
                              ) : (
                                <div className="relative pl-7 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-gradient-to-b before:from-amber-500/40 before:via-white/5 before:to-transparent">
                                  {selectedIncident.timeline.map(
                                    (entry, idx) => {
                                      const getActionIcon = () => {
                                        const a = entry.action.toLowerCase();
                                        if (a.includes("report"))
                                          return {
                                            icon: AlertCircle,
                                            color: "text-red-400",
                                            border: "border-red-500/30",
                                          };
                                        if (a.includes("escalat"))
                                          return {
                                            icon: ArrowUpRight,
                                            color: "text-orange-400",
                                            border: "border-orange-500/30",
                                          };
                                        if (
                                          a.includes("recover") ||
                                          a.includes("resolv")
                                        )
                                          return {
                                            icon: CheckCircle,
                                            color: "text-emerald-400",
                                            border: "border-emerald-500/30",
                                          };
                                        if (
                                          a.includes("tow") ||
                                          a.includes("repower")
                                        )
                                          return {
                                            icon: Truck,
                                            color: "text-cyan-400",
                                            border: "border-cyan-500/30",
                                          };
                                        if (a.includes("status"))
                                          return {
                                            icon: RefreshCw,
                                            color: "text-blue-400",
                                            border: "border-blue-500/30",
                                          };
                                        return {
                                          icon: Activity,
                                          color: "text-slate-400",
                                          border: "border-white/10",
                                        };
                                      };
                                      const cfg = getActionIcon();
                                      const Icon = cfg.icon;
                                      return (
                                        <div
                                          key={entry.id || idx}
                                          className="relative mb-6 last:mb-0 group/tl"
                                        >
                                          <div
                                            className={`absolute -left-[35px] top-1 w-6 h-6 rounded-lg bg-[#0a0f1e] border ${cfg.border} flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10`}
                                          >
                                            <Icon
                                              className={`w-3 h-3 ${cfg.color}`}
                                            />
                                          </div>
                                          <div className="flex justify-between items-center mb-0.5">
                                            <div className="flex items-center gap-2">
                                              <span
                                                className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}
                                              >
                                                {entry.action}
                                              </span>
                                            </div>
                                            <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">
                                              {new Date(
                                                entry.timestamp,
                                              ).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <UserIcon className="w-2.5 h-2.5 text-slate-600" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                              {entry.actorName ||
                                                entry.actor_name ||
                                                "Unknown"}
                                            </span>
                                          </div>
                                          {entry.notes && (
                                            <div className="mt-2 p-3 bg-white/[0.02] backdrop-blur-md rounded-xl text-[10px] text-slate-400 font-medium leading-relaxed border border-white/5">
                                              {entry.notes}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    },
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Unified operational events */}
                          <div className="relative pl-7 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-gradient-to-b before:from-blue-500/30 before:via-white/5 before:to-transparent">
                            {unifiedEvents.map((event: any, idx: number) => {
                              const getEventConfig = () => {
                                switch (event.type) {
                                  case "INCIDENT":
                                    return {
                                      icon: ShieldAlert,
                                      color: "text-red-500",
                                      bg: "bg-red-500/10",
                                      border: "border-red-500/30",
                                    };
                                  case "TELEMETRY":
                                    return {
                                      icon: MapPin,
                                      color: "text-cyan-400",
                                      bg: "bg-cyan-400/10",
                                      border: "border-cyan-400/30",
                                    };
                                  case "CALL_LOG":
                                    return {
                                      icon: Phone,
                                      color: "text-blue-400",
                                      bg: "bg-blue-400/10",
                                      border: "border-blue-400/30",
                                    };
                                  case "MESSAGE":
                                    return {
                                      icon: MessageSquare,
                                      color: "text-emerald-400",
                                      bg: "bg-emerald-400/10",
                                      border: "border-emerald-400/30",
                                    };
                                  case "REQUEST":
                                    return {
                                      icon: CreditCard,
                                      color: "text-blue-300",
                                      bg: "bg-blue-500/10",
                                      border: "border-blue-500/30",
                                    };
                                  case "TASK":
                                    return {
                                      icon: Workflow,
                                      color: "text-amber-400",
                                      bg: "bg-amber-400/10",
                                      border: "border-amber-400/30",
                                    };
                                  default:
                                    return {
                                      icon: Activity,
                                      color: "text-slate-400",
                                      bg: "bg-white/10",
                                      border: "border-white/10",
                                    };
                                }
                              };
                              const cfg = getEventConfig();
                              const Icon = cfg.icon;

                              return (
                                <div
                                  key={idx}
                                  className="relative mb-8 last:mb-0 group/ev cursor-pointer"
                                  onClick={() => {
                                    if (event.loadId)
                                      openRecordWorkspace("LOAD", event.loadId);
                                    else if (
                                      event.payload?.entityType &&
                                      event.payload?.entityId
                                    )
                                      openRecordWorkspace(
                                        event.payload.entityType as EntityType,
                                        event.payload.entityId,
                                      );
                                  }}
                                >
                                  <div
                                    className={`absolute -left-[35px] top-1 w-6 h-6 rounded-lg bg-[#0a0f1e] border ${cfg.border} flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] group-hover/ev:border-white transition-all z-10`}
                                  >
                                    <Icon className={`w-3 h-3 ${cfg.color}`} />
                                  </div>
                                  <div className="flex justify-between items-center mb-0.5">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}
                                      >
                                        {event.type}
                                      </span>
                                      <span className="w-1 h-1 rounded-full bg-white/20" />
                                      <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                        {event.actorName}
                                      </div>
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/5">
                                      {new Date(
                                        event.timestamp,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <div className="mt-2 p-3.5 bg-white/[0.02] backdrop-blur-md rounded-2xl text-[11px] text-slate-300 font-medium leading-relaxed border border-white/5 group-hover/ev:border-blue-500/30 group-hover/ev:bg-blue-500/5 transition-all shadow-xl">
                                      "{event.message}"
                                      <div className="mt-3 flex items-center justify-between opacity-0 group-hover/ev:opacity-100 transition-all">
                                        <div className="flex gap-1.5">
                                          {event.loadId && (
                                            <span className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-[7px] font-black text-blue-400 rounded uppercase">
                                              Load context
                                            </span>
                                          )}
                                          {event.isActionRequired && (
                                            <span className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 text-[7px] font-black text-red-500 rounded uppercase">
                                              Action required
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">
                                            Explore Context
                                          </span>
                                          <ArrowUpRight className="w-3 h-3 text-blue-500" />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activeDetailTab === "billing" && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                          <div className="bg-slate-950/60 rounded-3xl border border-white/5 p-8 flex items-center justify-between shadow-2xl backdrop-blur-xl">
                            <div>
                              <div className="text-[10px] font-black text-slate-600 uppercase mb-2 tracking-widest">
                                Financial Integrity Exposure
                              </div>
                              <div className="text-3xl font-black text-white italic tracking-tighter">
                                $
                                {(
                                  (selectedIncident?.billingItems?.reduce(
                                    (s: number, i: any) => s + (i.amount || 0),
                                    0,
                                  ) || 0) +
                                  (active360Data?.requests?.reduce(
                                    (s: number, r: any) =>
                                      s + (r.requestedAmount || 0),
                                    0,
                                  ) || 0)
                                ).toLocaleString()}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                showManagedMessage(
                                  "SETTLEMENT: Redirecting to Unified Settlement Queue...",
                                  3000,
                                );
                              }}
                              className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20"
                            >
                              Authorize Entry
                            </button>
                          </div>
                          <div className="space-y-4">
                            {[
                              ...(selectedIncident?.billingItems || []),
                              ...(active360Data?.requests || []),
                              ...(active360Data?.load?.expenses || []),
                            ].map((item: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-5 bg-white/5 rounded-3xl border border-white/5 flex items-center justify-between group hover:border-blue-500/30 hover:bg-white/10 transition-all shadow-xl"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="p-3 bg-slate-800 rounded-2xl">
                                    <DollarSign className="w-5 h-5 text-emerald-500" />
                                  </div>
                                  <div>
                                    <div className="text-[12px] font-black text-white uppercase">
                                      {item.category || item.type}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-500 uppercase">
                                      {item.providerVendor || item.requestedAt
                                        ? "Request"
                                        : "Internal Ledger"}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-xl font-black text-white font-mono">
                                    $
                                    {(
                                      item.amount ||
                                      item.requestedAmount ||
                                      0
                                    ).toLocaleString()}
                                  </div>
                                  <div className="text-[9px] font-black text-blue-500 uppercase tracking-widest">
                                    {item.status}
                                  </div>
                                </div>
                              </div>
                            ))}
                            {!selectedIncident?.billingItems?.length &&
                              !active360Data?.requests?.length &&
                              !active360Data?.load?.expenses?.length && (
                                <div className="p-10 text-center opacity-30 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                                  <DollarSign className="w-10 h-10 mx-auto mb-4" />
                                  <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
                                    No Strategic Assets
                                    <br />
                                    Allocated to this Flow
                                  </p>
                                </div>
                              )}
                          </div>
                        </div>
                      )}

                      {activeDetailTab === "docs" && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-500">
                          {active360Data?.vaultDocs &&
                          active360Data.vaultDocs.length > 0 ? (
                            active360Data.vaultDocs.map((doc: any) => (
                              <div
                                key={doc.id}
                                className="p-5 bg-white/5 rounded-3xl border border-white/5 hover:border-blue-500/50 hover:bg-white/10 transition-all cursor-pointer group shadow-xl"
                              >
                                <div className="flex flex-col items-center gap-4 text-center">
                                  <div className="p-4 bg-slate-800 rounded-2xl group-hover:bg-blue-600/20 transition-all">
                                    <FileText className="w-8 h-8 text-slate-600 group-hover:text-blue-500" />
                                  </div>
                                  <div>
                                    <div className="text-[11px] font-black text-white uppercase mb-1 truncate max-w-[140px]">
                                      {doc.fileName || doc.name}
                                    </div>
                                    <div className="text-[9px] font-bold text-slate-600 uppercase">
                                      {doc.type} •{" "}
                                      {doc.size
                                        ? (doc.size / 1024).toFixed(0) + " KB"
                                        : "Size N/A"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="col-span-2 p-10 text-center opacity-30 border-2 border-dashed border-white/5 rounded-[2.5rem]">
                              <FileText className="w-10 h-10 mx-auto mb-4" />
                              <p className="text-[10px] font-black uppercase tracking-widest leading-loose">
                                No Mission Artifacts
                                <br />
                                Captured in Archive
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {activeDetailTab === "fuel" && (
                        <div className="space-y-6 animate-in fade-in duration-500">
                          <div className="p-8 bg-emerald-600/10 border border-emerald-500/20 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
                            <h4 className="text-[11px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4">
                              IFTA Integrity Compliance
                            </h4>
                            <div className="text-4xl font-black text-white italic tracking-tighter mb-6">
                              VERIFIED
                            </div>
                            <div className="space-y-4 relative z-10">
                              <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
                                <span>Jurisdiction Sync</span>
                                <span className="text-emerald-500">
                                  100% COMPLETE
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                              </div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 bg-white/5 border border-white/5 rounded-3xl group hover:border-blue-500/30 transition-all shadow-xl">
                              <div className="text-[9px] font-black text-slate-600 uppercase mb-2">
                                Total Fuel Burn
                              </div>
                              <div className="text-2xl font-black text-white font-mono">
                                $842.11
                              </div>
                            </div>
                            <div className="p-6 bg-white/5 border border-white/5 rounded-3xl group hover:border-emerald-500/30 transition-all shadow-xl">
                              <div className="text-[9px] font-black text-slate-600 uppercase mb-2">
                                Avg Gal Price
                              </div>
                              <div className="text-2xl font-black text-emerald-400 font-mono">
                                $3.412
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </aside>

            {/* Right: Live Map Layer */}
            <main className="flex-1 relative bg-slate-950 flex flex-col min-w-0">
              <GlobalMapViewEnhanced
                loads={loads}
                users={users}
                incidents={incidents}
                onViewLoad={(load) => openRecordWorkspace("LOAD", load.id)}
                onSelectIncident={(incId) =>
                  openRecordWorkspace("INCIDENT", incId)
                }
                isHighObstruction={isHighObstruction}
                obstructionLevel={obstructionLevel}
                showSideOverlays={false}
              />

              {/* Bottom Alert Strip */}
              <div className="absolute bottom-6 left-6 right-6 h-12 bg-slate-950/80 backdrop-blur-xl border border-white/10 rounded-2xl px-6 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Activity
                      className={`w-3.5 h-3.5 ${operationalStreamStatus === "CRITICAL" ? "text-red-500" : operationalStreamStatus === "ELEVATED" ? "text-orange-500" : "text-blue-500"}`}
                    />
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest ${operationalStreamColor}`}
                    >
                      Global Operational Stream: {operationalStreamStatus}
                    </span>
                  </div>
                  <div className="w-px h-4 bg-white/10" />
                  <div className="flex items-center gap-2">
                    <Wifi
                      className={`w-3.5 h-3.5 ${connectedCount > 0 ? "text-green-500" : "text-slate-500"}`}
                    />
                    <span className="text-[10px] font-black text-slate-500 uppercase">
                      {unitsLabel}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-600 uppercase italic">
                    Last Sync: {syncLabel}
                  </span>
                </div>
              </div>
            </main>
          </div>
        )}
    </div>
  );
};
