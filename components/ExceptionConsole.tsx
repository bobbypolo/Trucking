import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Exception,
  ExceptionType,
  ExceptionStatus,
  User,
  LoadData,
} from "../types";
import {
  getExceptions,
  getExceptionTypes,
  updateException,
  createException,
} from "../services/exceptionService";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { useFocusTrap } from "../hooks/useFocusTrap";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  Filter,
  MoreVertical,
  Search,
  ArrowRight,
  User as UserIcon,
  Shield,
  FileText,
  Wrench,
  Truck,
  LayoutGrid,
  List,
  Plus,
  X,
  ShieldAlert,
  DollarSign,
  AlertTriangle,
  Activity,
  ExternalLink,
} from "lucide-react";

/** Parse the links JSON from an exception record into a typed object. */
function parseExceptionLinks(
  links?: Record<string, string> | string | null,
): Record<string, string> {
  if (!links) return {};
  if (typeof links === "string") {
    try {
      return JSON.parse(links);
    } catch {
      return {};
    }
  }
  return links;
}

/** Map a link field name to a human-readable label and navigation target. */
function getLinkInfo(key: string): { label: string; navTarget: string } | null {
  switch (key) {
    case "incidentId":
      return { label: "Incident", navTarget: "incidents" };
    case "serviceTicketId":
      return { label: "Service Ticket", navTarget: "service-tickets" };
    case "maintenanceRecordId":
      return { label: "Maintenance", navTarget: "maintenance" };
    case "safetyEventId":
      return { label: "Safety Event", navTarget: "safety" };
    case "loadId":
      return { label: "Load", navTarget: "loads" };
    default:
      return null;
  }
}
const computeSLALabel = (dueAt?: string): string => {
  if (!dueAt) return "No SLA";
  const diff = new Date(dueAt).getTime() - Date.now();
  if (diff <= 0) return "OVERDUE";
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  return hrs > 0 ? `${hrs}h ${mins % 60}m Left` : `${mins}m Left`;
};

const SLACell = ({ dueAt }: { dueAt?: string }) => {
  const [label, setLabel] = useState(() => computeSLALabel(dueAt));

  useEffect(() => {
    if (!dueAt) return;
    const update = () => setLabel(computeSLALabel(dueAt));
    const timer = setInterval(update, 10000);
    return () => clearInterval(timer);
  }, [dueAt]);

  return <span>{label}</span>;
};

/* ── Issue type options for the Create Issue modal ── */
const ISSUE_TYPES = [
  {
    value: "ROADSIDE_BREAKDOWN",
    label: "Roadside / Breakdown",
    entityType: "TRUCK" as const,
  },
  {
    value: "MAINTENANCE_REQUEST",
    label: "Maintenance Request",
    entityType: "TRUCK" as const,
  },
  {
    value: "SAFETY_ALERT",
    label: "Safety Alert",
    entityType: "DRIVER" as const,
  },
  {
    value: "COMPLIANCE_ALERT",
    label: "Compliance Alert",
    entityType: "DRIVER" as const,
  },
  {
    value: "DOCUMENT_ISSUE",
    label: "Document Issue",
    entityType: "LOAD" as const,
  },
  {
    value: "BILLING_DISPUTE",
    label: "Billing Dispute",
    entityType: "LOAD" as const,
  },
  {
    value: "INCIDENT_GENERAL",
    label: "General Exception",
    entityType: "LOAD" as const,
  },
] as const;

const SEVERITY_OPTIONS = [
  { value: 1, label: "Low" },
  { value: 2, label: "Medium" },
  { value: 3, label: "High" },
  { value: 4, label: "Critical" },
];

/* ── Category tabs for unified workspace ── */
const CATEGORY_TABS = [
  { id: "all", label: "All Issues" },
  { id: "safety", label: "Safety", icon: ShieldAlert },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
  { id: "compliance", label: "Compliance", icon: Shield },
  { id: "billing", label: "Billing", icon: DollarSign },
  { id: "documents", label: "Documents", icon: FileText },
] as const;

type CategoryTab = (typeof CATEGORY_TABS)[number]["id"];

interface Props {
  currentUser: User;
  initialView?: string;
  onViewDetail?: (type: string, id: string) => void;
  loads?: LoadData[];
  incidents?: any[];
  onIncidentAction?: (id: string, action: string, data?: any) => Promise<void>;
  onRecordAction?: (e: any) => Promise<void>;
  openRecordWorkspace?: (type: any, id: string) => void;
  onOpenHub?: (tab: string, startCall?: boolean) => void;
  onNavigate?: (tab: string) => void;
}

export const ExceptionConsole: React.FC<Props> = ({
  currentUser,
  initialView,
  onViewDetail,
  loads = [],
  incidents = [],
  onIncidentAction,
  onRecordAction,
  openRecordWorkspace,
  onOpenHub,
  onNavigate,
}) => {
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [types, setTypes] = useState<ExceptionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryTab>(
    (initialView as CategoryTab) || "all",
  );
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [confirmResolveId, setConfirmResolveId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(createModalRef, showCreateModal, () =>
    setShowCreateModal(false),
  );
  const [createForm, setCreateForm] = useState<{
    type: string;
    severity: number;
    entityType: string;
    entityId: string;
    description: string;
  }>({
    type: ISSUE_TYPES[0].value,
    severity: 2,
    entityType: ISSUE_TYPES[0].entityType,
    entityId: "",
    description: "",
  });
  const [isCreating, setIsCreating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [exs, ts] = await Promise.all([getExceptions(), getExceptionTypes()]);
    setExceptions(exs);
    setTypes(ts);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (initialView) setActiveCategory(initialView as CategoryTab);
  }, [initialView]);

  /* ── Filtering logic ── */
  const filteredExceptions = useMemo(() => {
    let result = exceptions;

    // Category-based filtering
    if (activeCategory !== "all") {
      const categoryTypeMap: Record<string, string[]> = {
        safety: [
          "SAFETY_INCIDENT",
          "SAFETY_ALERT",
          "COMPLIANCE_ALERT",
          "INCIDENT_GENERAL",
        ],
        maintenance: [
          "MAINTENANCE_REQUEST",
          "MAINTENANCE_INCIDENT",
          "SERVICE_TICKET",
        ],
        compliance: ["COMPLIANCE_ALERT", "COMPLIANCE_VIOLATION"],
        billing: [
          "UNBILLED_LOAD",
          "INVOICE_OVERDUE",
          "DISPUTED_INVOICE",
          "SHORT_PAY",
          "BILLING_DISPUTE",
        ],
        documents: ["MISSING_POD", "DOCUMENT_ISSUE"],
      };
      const typesForCategory = categoryTypeMap[activeCategory];
      if (typesForCategory) {
        result = result.filter((ex) => typesForCategory.includes(ex.type));
      } else {
        // Fall back to dashboardGroup matching
        result = result.filter((ex) =>
          types
            .find((t) => t.typeCode === ex.type)
            ?.dashboardGroup?.toLowerCase()
            .includes(activeCategory),
        );
      }
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (ex) =>
          ex.id.toLowerCase().includes(q) ||
          ex.description?.toLowerCase().includes(q) ||
          ex.entityId?.toLowerCase().includes(q) ||
          ex.type?.toLowerCase().includes(q),
      );
    }

    return result;
  }, [exceptions, activeCategory, searchQuery, types]);

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 4:
        return "text-red-500 bg-red-500/10 border-red-500/20";
      case 3:
        return "text-orange-500 bg-orange-500/10 border-orange-500/20";
      case 2:
        return "text-blue-500 bg-blue-500/10 border-blue-500/20";
      default:
        return "text-slate-500 bg-slate-500/10 border-slate-500/20";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "RESOLVED":
      case "CLOSED":
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "OPEN":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "APPROVAL_REQUIRED":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "WAITING_EXTERNAL":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  const getTypeIcon = (ex: Exception) => {
    const typeLower = ex.type?.toLowerCase() || "";
    if (typeLower.includes("safety") || typeLower.includes("incident"))
      return <ShieldAlert className="w-4 h-4" />;
    if (typeLower.includes("maintenance") || typeLower.includes("service"))
      return <Wrench className="w-4 h-4" />;
    if (typeLower.includes("compliance")) return <Shield className="w-4 h-4" />;
    if (
      typeLower.includes("billing") ||
      typeLower.includes("invoice") ||
      typeLower.includes("pay")
    )
      return <DollarSign className="w-4 h-4" />;
    if (typeLower.includes("doc") || typeLower.includes("pod"))
      return <FileText className="w-4 h-4" />;
    if (typeLower.includes("roadside") || typeLower.includes("breakdown"))
      return <Truck className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  const handleResolve = (id: string) => {
    setConfirmResolveId(id);
  };

  const doResolve = async () => {
    if (!confirmResolveId) return;
    const id = confirmResolveId;
    setConfirmResolveId(null);
    const success = await updateException(id, {
      status: "RESOLVED",
      actorName: currentUser.name,
    });
    if (success) loadData();
  };

  const handleCreateIssue = async () => {
    if (!createForm.entityId.trim() || !createForm.description.trim()) return;
    setIsCreating(true);
    const slaHours =
      createForm.severity >= 4
        ? 2
        : createForm.severity >= 3
          ? 4
          : createForm.severity >= 2
            ? 24
            : 72;
    const slaDueAt = new Date(
      Date.now() + slaHours * 3600 * 1000,
    ).toISOString();
    const id = await createException({
      type: createForm.type,
      severity: createForm.severity,
      entityType: createForm.entityType,
      entityId: createForm.entityId,
      description: createForm.description,
      slaDueAt,
      createdBy: currentUser.name,
    } as any);
    setIsCreating(false);
    if (id) {
      setShowCreateModal(false);
      setCreateForm({
        type: ISSUE_TYPES[0].value,
        severity: 2,
        entityType: ISSUE_TYPES[0].entityType,
        entityId: "",
        description: "",
      });
      loadData();
    }
  };

  /* ── Summary counts for the bottom bar ── */
  const criticalCount = exceptions.filter((e) => e.severity === 4).length;
  const highCount = exceptions.filter((e) => e.severity === 3).length;
  const safetyCount = exceptions.filter(
    (e) =>
      e.type?.includes("SAFETY") ||
      e.type?.includes("INCIDENT") ||
      e.type?.includes("COMPLIANCE"),
  ).length;
  const maintenanceCount = exceptions.filter(
    (e) => e.type?.includes("MAINTENANCE") || e.type?.includes("SERVICE"),
  ).length;

  return (
    <div className="flex flex-col h-full bg-[#0a0f18]">
      <ConfirmDialog
        open={confirmResolveId !== null}
        title="Resolve Issue"
        message="Mark this issue as resolved?"
        confirmLabel="Resolve"
        onConfirm={doResolve}
        onCancel={() => setConfirmResolveId(null)}
      />

      {/* ── Create Issue Modal ── */}
      {showCreateModal && (
        <div
          ref={createModalRef}
          className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-3">
                <Plus className="w-5 h-5 text-blue-500" /> Create Issue
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                aria-label="Close create issue modal"
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
              <div className="space-y-2">
                <label
                  htmlFor="issueType"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Issue Type
                </label>
                <select
                  id="issueType"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                  value={createForm.type}
                  onChange={(e) => {
                    const selected = ISSUE_TYPES.find(
                      (t) => t.value === e.target.value,
                    );
                    setCreateForm({
                      ...createForm,
                      type: e.target.value as string,
                      entityType: (selected?.entityType || "LOAD") as string,
                    });
                  }}
                >
                  {ISSUE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label
                    htmlFor="issueSeverity"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
                    Severity
                  </label>
                  <select
                    id="issueSeverity"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                    value={createForm.severity}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        severity: parseInt(e.target.value),
                      })
                    }
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="issueEntityType"
                    className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                  >
                    Entity Type
                  </label>
                  <select
                    id="issueEntityType"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                    value={createForm.entityType}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        entityType: e.target.value,
                      })
                    }
                  >
                    {[
                      "LOAD",
                      "DRIVER",
                      "TRUCK",
                      "TRAILER",
                      "BROKER",
                      "FACILITY",
                    ].map((et) => (
                      <option key={et} value={et}>
                        {et}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="issueEntityId"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Entity ID / Reference *
                </label>
                <input
                  id="issueEntityId"
                  type="text"
                  placeholder="e.g. Load #1234, Truck TR-101, Driver name..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                  value={createForm.entityId}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, entityId: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="issueDescription"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest"
                >
                  Description *
                </label>
                <textarea
                  id="issueDescription"
                  rows={4}
                  placeholder="Describe the issue in detail..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none resize-none focus:border-blue-500"
                  value={createForm.description}
                  onChange={(e) =>
                    setCreateForm({
                      ...createForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-800 bg-slate-950/50">
              <button
                disabled={
                  isCreating ||
                  !createForm.entityId.trim() ||
                  !createForm.description.trim()
                }
                onClick={handleCreateIssue}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCreating ? "Creating..." : "Create Issue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header & Controls ── */}
      <div className="p-6 border-b border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">
              Issues & Alerts
            </h1>
            <p className="text-slate-500 text-xs font-bold mt-1 uppercase tracking-widest">
              Unified Issue Management & Deadline Tracking
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Create Issue
            </button>
            <div className="flex bg-slate-900 rounded-xl p-1 border border-white/5">
              <button
                onClick={() => setViewMode("list")}
                aria-label="List view"
                className={`p-2 rounded-lg transition-all ${viewMode === "list" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-white"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`p-2 rounded-lg transition-all ${viewMode === "grid" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-500 hover:text-white"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-slate-900 border border-white/5 rounded-xl text-slate-300 hover:text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2"
            >
              <Clock className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
            <input
              type="text"
              placeholder="Filter by ID, description, entity, or type..."
              aria-label="Filter issues by ID, description, entity, or type"
              className="w-full bg-[#020617] border border-white/5 rounded-xl pl-12 pr-6 py-3 text-xs text-white outline-none focus:border-blue-500/50 transition-all font-mono"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border flex items-center gap-1.5 ${
                  activeCategory === tab.id
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                    : "bg-slate-900 border-white/5 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                {"icon" in tab && tab.icon
                  ? React.createElement(tab.icon, {
                      className: "w-3.5 h-3.5",
                    })
                  : null}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        data-testid="issues-console"
      >
        {/* Safety remains a filter inside the unified Issues & Alerts workflow. */}
        {false && activeCategory === "safety" ? (
          <div className="flex flex-col h-full">
            {/* Safety issues list (compact) */}
            {filteredExceptions.length > 0 && (
              <div className="p-6 pb-2">
                <h3 className="text-xs font-black text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" />
                  Active Safety Issues ({filteredExceptions.length})
                </h3>
                <div className="space-y-2 max-h-[200px] overflow-y-auto no-scrollbar">
                  {filteredExceptions.slice(0, 5).map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between p-3 bg-[#020617] border border-white/5 rounded-xl hover:border-red-500/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${getSeverityColor(ex.severity)}`}
                        >
                          {ex.severity === 4
                            ? "Crit"
                            : ex.severity === 3
                              ? "High"
                              : "Med"}
                        </span>
                        <div>
                          <div className="text-[11px] font-bold text-white">
                            {ex.description || ex.type}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {ex.entityType} #{ex.entityId}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-[11px] font-black text-red-500 uppercase">
                          SLA: <SLACell dueAt={ex.slaDueAt} />
                        </div>
                        <button
                          onClick={() => handleResolve(ex.id)}
                          aria-label="Resolve issue"
                          className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-lg transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 animate-pulse">
                <Clock className="w-10 h-10 mb-4 opacity-20" />
                <p className="text-xs font-black uppercase tracking-[0.3em]">
                  Synching Issues...
                </p>
              </div>
            ) : filteredExceptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-4">
                <div className="p-6 bg-slate-900/50 rounded-full border border-white/5">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/20" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-white uppercase tracking-widest">
                    No Active Issues
                  </p>
                  <p className="text-[10px] text-slate-600 font-bold uppercase mt-1">
                    {activeCategory === "all"
                      ? "All issues resolved within time limits"
                      : `No ${activeCategory} issues found`}
                  </p>
                </div>
              </div>
            ) : viewMode === "list" ? (
              <div className="bg-[#020617] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-slate-950/50">
                      <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Priority
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Issue Type
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Entity
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Owner / Team
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Time / SLA
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Impact
                      </th>
                      <th className="px-6 py-4 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredExceptions.map((ex) => (
                      <tr
                        key={ex.id}
                        className="group hover:bg-slate-900/40 transition-all cursor-pointer"
                      >
                        <td className="px-6 py-5">
                          <span
                            className={`px-2 py-1 rounded-lg text-[11px] font-black uppercase border ${getSeverityColor(ex.severity)}`}
                          >
                            {ex.severity === 4
                              ? "Critical"
                              : ex.severity === 3
                                ? "High"
                                : ex.severity === 2
                                  ? "Medium"
                                  : "Low"}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-xl border ${getStatusStyle(ex.status)}`}
                            >
                              {getTypeIcon(ex)}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white uppercase">
                                {types.find((t) => t.typeCode === ex.type)
                                  ?.displayName || ex.type?.replace(/_/g, " ")}
                              </div>
                              <div className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                                {ex.workflowStep}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <button
                            onClick={() =>
                              onViewDetail?.(
                                ex.entityType || "LOAD",
                                ex.entityId || "",
                              )
                            }
                            className="text-left group/link"
                          >
                            <div className="text-xs font-bold text-blue-400 group-hover/link:text-blue-300 transition-colors uppercase">
                              {ex.entityType} #{ex.entityId}
                            </div>
                          </button>
                          {/* Linked-record drilldown chips */}
                          <div
                            className="flex flex-wrap gap-1.5 mt-1.5"
                            data-testid="linked-record-chips"
                          >
                            {Object.entries(parseExceptionLinks(ex.links)).map(
                              ([key, value]) => {
                                const info = getLinkInfo(key);
                                if (!info || !value) return null;
                                return (
                                  <button
                                    key={key}
                                    data-testid={`drilldown-${key}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onNavigate?.(info.navTarget);
                                      onViewDetail?.(info.navTarget, value);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 border border-blue-500/20 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                    {info.label}
                                  </button>
                                );
                              },
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                              <UserIcon className="w-3 h-3 text-slate-400" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-300 uppercase">
                                {ex.ownerUserId || "Unassigned"}
                              </div>
                              <div className="text-[11px] text-slate-600 font-black uppercase">
                                {ex.team || "PENDING"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <div className="text-xs font-mono text-slate-300">
                              {new Date(ex.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                              <span className="sr-only">
                                SLA warning active
                              </span>
                              <div className="text-[11px] font-black text-red-500 uppercase">
                                SLA: <SLACell dueAt={ex.slaDueAt} />
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-xs font-mono font-bold text-emerald-500">
                            {ex.financialImpactEst
                              ? `$${ex.financialImpactEst.toLocaleString()}`
                              : "$0.00"}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleResolve(ex.id)}
                              aria-label="Resolve issue"
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white border border-emerald-500/20 rounded-xl transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                            <button
                              aria-label="Issue options"
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-white/5 rounded-xl transition-all"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredExceptions.map((ex) => (
                  <div
                    key={ex.id}
                    className="bg-[#020617] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4 hover:border-blue-500/30 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-1 rounded-lg text-[11px] font-black uppercase border ${getSeverityColor(ex.severity)}`}
                      >
                        {ex.severity === 4
                          ? "Critical"
                          : ex.severity === 3
                            ? "High"
                            : "Normal"}
                      </span>
                      <div className="text-[10px] font-mono text-slate-600">
                        ID: {ex.id.split("-")[0]}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center ${getStatusStyle(ex.status)}`}
                      >
                        {getTypeIcon(ex)}
                      </div>
                      <div>
                        <h2 className="text-sm font-black text-white uppercase tracking-tight leading-none">
                          {types.find((t) => t.typeCode === ex.type)
                            ?.displayName || ex.type?.replace(/_/g, " ")}
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                          Ref: {ex.entityType} #{ex.entityId}
                        </p>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-slate-400 font-medium leading-relaxed italic line-clamp-2">
                        "{ex.description || "No description provided."}"
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-900/30 rounded-xl border border-white/5">
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">
                          Impact
                        </div>
                        <div className="text-xs font-mono font-bold text-emerald-500">
                          ${(ex.financialImpactEst || 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="p-3 bg-slate-900/30 rounded-xl border border-white/5">
                        <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">
                          Time Lapsed
                        </div>
                        <div className="text-xs font-mono font-bold text-slate-300">
                          {(() => {
                            const elapsed =
                              Date.now() - new Date(ex.createdAt).getTime();
                            const hrs = Math.floor(elapsed / 3600000);
                            const mins = Math.floor(
                              (elapsed % 3600000) / 60000,
                            );
                            const secs = Math.floor((elapsed % 60000) / 1000);
                            return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
                          })()}
                        </div>
                      </div>
                    </div>
                    {/* Linked-record drilldown chips (grid view) */}
                    {Object.keys(parseExceptionLinks(ex.links)).length > 0 && (
                      <div
                        className="flex flex-wrap gap-1.5"
                        data-testid="linked-record-chips"
                      >
                        {Object.entries(parseExceptionLinks(ex.links)).map(
                          ([key, value]) => {
                            const info = getLinkInfo(key);
                            if (!info || !value) return null;
                            return (
                              <button
                                key={key}
                                data-testid={`drilldown-${key}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate?.(info.navTarget);
                                  onViewDetail?.(info.navTarget, value);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300 border border-blue-500/20 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                                {info.label}
                              </button>
                            );
                          },
                        )}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500">
                          {(ex.ownerUserId || "?")[0]?.toUpperCase()}
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {ex.ownerUserId || "Unassigned"}
                        </span>
                      </div>
                      <button
                        onClick={() =>
                          onViewDetail?.(
                            ex.entityType || "LOAD",
                            ex.entityId || "",
                          )
                        }
                        className="text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase flex items-center gap-2 transition-all"
                      >
                        View Detail <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom Summary Bar ── */}
      <div className="p-4 bg-slate-950 border-t border-white/5 flex items-center justify-between px-10">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="sr-only">Critical severity</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {criticalCount} Critical
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="sr-only">High priority severity</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {highCount} High Priority
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="sr-only">Safety issue indicator</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {safetyCount} Safety
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="sr-only">Maintenance issue indicator</span>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              {maintenanceCount} Maintenance
            </span>
          </div>
        </div>
        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
          Average Resolution:{" "}
          {(() => {
            const resolved = exceptions.filter(
              (e) => e.resolvedAt && e.createdAt,
            );
            if (resolved.length === 0) return "N/A";
            const totalMs = resolved.reduce((sum, e) => {
              return (
                sum +
                (new Date(e.resolvedAt!).getTime() -
                  new Date(e.createdAt).getTime())
              );
            }, 0);
            const avgMs = totalMs / resolved.length;
            const avgMins = Math.floor(avgMs / 60000);
            const hrs = Math.floor(avgMins / 60);
            const mins = avgMins % 60;
            return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
          })()}
        </div>
      </div>
    </div>
  );
};
