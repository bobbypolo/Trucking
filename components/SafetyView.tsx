import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useAutoFeedback } from "../hooks/useAutoFeedback";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import {
  User,
  SafetyQuiz,
  LoadData,
  FleetEquipment,
  DriverPerformance,
  Company,
  QuizResult,
  MaintenanceRecord,
  ServiceTicket,
  Provider,
} from "../types";
import {
  checkDriverCompliance,
  getDriverQuizzes,
  saveQuiz,
  calculateDriverPerformance,
  logSafetyActivity,
  getStoredQuizzes,
  registerAsset,
  saveQuizResult,
  getMaintenanceRecords,
  saveMaintenanceRecord,
} from "../services/safetyService";
import {
  getCompanyUsers,
  getCompany,
  updateCompany,
} from "../services/authService";
// analyzeSafetyCompliance is now proxied via POST /api/ai/analyze-safety
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  CheckCircle,
  Plus,
  Users,
  Award,
  Truck,
  Container,
  Box,
  X,
  Trash2,
  Gauge,
  Settings,
  BarChart3,
  Clock,
  DollarSign,
  Activity,
  Star,
  ChevronRight,
  AlertOctagon,
  BookOpen,
  ArrowRight,
  Loader2,
  Play,
  UserSearch,
  Target,
  History,
  Sparkles,
  Ban,
  Wrench,
  Camera,
  Upload,
  ShieldAlert,
  Search,
  FileSearch,
  Save,
  ShieldAlert as ShieldAlertIcon,
  Phone,
  Package,
  MapPin,
  ClipboardList,
} from "lucide-react";
import { saveLoad, createIncident } from "../services/storageService";
import { v4 as uuidv4 } from "uuid";
import { Scanner } from "./Scanner";
import {
  getServiceTickets,
  saveServiceTicket,
  getVendors,
  getEquipment,
  getComplianceRecords,
} from "../services/safetyService";
import {
  NotificationStatusBadge,
  type NotificationStatus,
} from "./ui/NotificationStatusBadge";
import { CertExpiryWarnings } from "./ui/CertExpiryWarnings";
import { validateQuizForm } from "../services/validationGuards";

interface NotificationJob {
  id: string;
  message: string;
  channel: string;
  status: NotificationStatus;
  sent_at: string;
  sync_error?: string | boolean;
}

interface SafetyQuizCourse {
  id: string;
  title: string;
  type: string;
  progress: number;
  certifiedCount: number;
}

interface SafetyQuizResult {
  id: string;
  driverName: string;
  quizTitle: string;
  score: number;
  passed: boolean;
  completedAt: string;
}

interface SafetySettings {
  minSafetyScore: number;
  autoLockCompliance: boolean;
  maintenanceIntervalDays: number;
}

interface Props {
  user: User;
  loads?: LoadData[];
  incidents?: any[];
  onIncidentAction?: (id: string, action: string, data?: any) => Promise<void>;
  onRecordAction?: (e: any) => Promise<void>;
  openRecordWorkspace?: (type: any, id: string) => void;
  onOpenHub?: (tab: string, startCall?: boolean) => void;
  onSaveIncident?: (inc: any) => Promise<void>;
  onNavigate?: (tab: string) => void;
}

export const SafetyView: React.FC<Props> = ({
  user,
  loads = [],
  incidents = [],
  onIncidentAction,
  onRecordAction,
  openRecordWorkspace,
  onOpenHub,
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "roster"
    | "equipment"
    | "maintenance"
    | "quizzes"
    | "settings"
    | "vendors"
  >("overview");
  const [operators, setOperators] = useState<
    { user: User; performance: DriverPerformance }[]
  >([]);
  const [fleetEquipment, setFleetEquipment] = useState<FleetEquipment[]>([]);
  const [complianceRecords, setComplianceRecords] = useState<any[]>([]);
  const [serviceTickets, setServiceTickets] = useState<ServiceTicket[]>([]);
  const [vendors, setVendors] = useState<Provider[]>([]);
  const [selectedDriverCompliance, setSelectedDriverCompliance] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, showFeedback, clearFeedback] = useAutoFeedback<
    string | null
  >(null);
  const [showForm, setShowForm] = useState<
    "asset" | "maintenance" | "quiz" | "incident" | "compliance" | null
  >(null);
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [safetyFormErrors, setSafetyFormErrors] = useState<Record<string, string>>({});
  const [notificationJobs, setNotificationJobs] = useState<NotificationJob[]>([]);
  const [quizCourses, setQuizCourses] = useState<SafetyQuizCourse[]>([]);
  const [quizResults, setQuizResults] = useState<SafetyQuizResult[]>([]);
  const [safetySettings, setSafetySettings] = useState<SafetySettings | null>(null);

  const isSafetyFormValid = (() => {
    if (!showForm) return false;
    if (showForm === "asset") return !!formData.id?.trim();
    if (showForm === "maintenance") return !!formData.description?.trim();
    if (showForm === "incident") return !!formData.description?.trim();
    // R-P3-03: Quiz form requires a non-empty title
    if (showForm === "quiz") return validateQuizForm(formData).valid;
    return true;
  })();
  const [fmcsaData, setFmcsaData] = useState<{
    available: boolean;
    isMock?: boolean;
    data?: {
      dotNumber: string;
      legalName: string;
      safetyRating: string | null;
      totalDrivers: number;
      totalPowerUnits: number;
      inspections: {
        totalInspections: number;
        driverOosRate: number;
        vehicleOosRate: number;
      } | null;
    };
  } | null>(null);

  const loadPayload = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const c = await getCompany(user.companyId);
      if (c) {
        const allUsers = await getCompanyUsers(c.id);
        // Standardize role check and filter for active operators
        const safetyUsers = allUsers.filter((u) =>
          [
            "admin",
            "dispatcher",
            "safety_manager",
            "driver",
            "owner_operator",
          ].includes(u.role),
        );

        const enrichedOperators = await Promise.all(
          safetyUsers.map(async (u) => {
            try {
              const performance = await calculateDriverPerformance(u, c);
              return { user: u, performance };
            } catch (err) {
              console.error(
                "[SafetyView] Failed to calculate driver performance:",
                err,
              );
              return {
                user: u,
                performance: {
                  driverId: u.id,
                  totalScore: 0,
                  grade: "At Risk" as any,
                  status: "Blocked" as any,
                  metrics: {
                    safetyScore: 0,
                    onTimeRate: 0,
                    paperworkScore: 0,
                    loadCount: 0,
                  },
                },
              } as any;
            }
          }),
        );
        setOperators(enrichedOperators);

        // Fetch Equipment
        const equips = await getEquipment(user.companyId);
        setFleetEquipment(equips);

        // Fetch service tickets and vendors
        const [tickets, vendorList] = await Promise.all([
          getServiceTickets(),
          getVendors(),
        ]);
        setServiceTickets(tickets);
        setVendors(vendorList);

        // Fetch FMCSA safety score (non-blocking — uses company DOT if available)
        const dotNumber = c?.dotNumber;
        if (dotNumber) {
          try {
            const resp = await fetch(`/api/safety/fmcsa/${dotNumber}`);
            if (resp.ok) {
              const fmcsa = await resp.json();
              setFmcsaData(fmcsa);
            }
          } catch {
            // FMCSA fetch is non-critical — silently degrade
          }
        }

        // Fetch notification jobs (non-blocking)
        try {
          const nResp = await fetch("/api/notification-jobs");
          if (nResp.ok) {
            const jobs: NotificationJob[] = await nResp.json();
            setNotificationJobs(jobs);
          }
        } catch {
          // Notification jobs fetch is non-critical — silently degrade
        }

        // Fetch quiz courses (non-blocking)
        try {
          const qResp = await fetch("/api/safety/quizzes");
          if (qResp.ok) {
            const courses: SafetyQuizCourse[] = await qResp.json();
            setQuizCourses(courses);
          }
        } catch {
          // Quiz fetch is non-critical — silently degrade
        }

        // Fetch quiz results (non-blocking)
        try {
          const qrResp = await fetch("/api/safety/quiz-results");
          if (qrResp.ok) {
            const results: SafetyQuizResult[] = await qrResp.json();
            setQuizResults(results);
          }
        } catch {
          // Quiz results fetch is non-critical — silently degrade
        }

        // Fetch safety settings (non-blocking)
        try {
          const sResp = await fetch("/api/safety/settings");
          if (sResp.ok) {
            const settings: SafetySettings = await sResp.json();
            setSafetySettings(settings);
          }
        } catch {
          // Settings fetch is non-critical — silently degrade
        }
      }
    } catch (error) {
      setLoadError("Failed to load safety data. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPayload();
  }, [loadPayload]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading safety data"
        className="h-full flex flex-col bg-[#020617] text-slate-100 p-10"
      >
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col bg-[#020617] text-slate-100">
        <ErrorState message={loadError} onRetry={loadPayload} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100">
      {/* Safety & Compliance Header */}
      <div className="bg-slate-900 border-b border-slate-800 shadow-sm px-8 pt-8 relative overflow-hidden shrink-0">
        <div className="flex items-center gap-5 mb-8">
          <div className="w-14 h-14 bg-blue-600/10 rounded-xl flex items-center justify-center border border-blue-500/20">
            <ShieldCheck className="w-8 h-8 text-blue-500" />
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                Safety & Compliance
              </h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2">
                Global Fleet Governance Matrix
              </p>
            </div>
            <div className="flex items-center gap-3 bg-blue-600/10 px-6 py-3 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_12px_#3b82f6]" />
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">
                Logic Plane: Synchronized
              </span>
            </div>
          </div>
        </div>

        <nav className="flex space-x-8">
          {[
            { id: "overview", label: "Monitor", icon: ShieldCheck },
            { id: "roster", label: "Roster", icon: Users },
            { id: "equipment", label: "Assets", icon: Truck },
            { id: "maintenance", label: "Service", icon: Wrench },
            { id: "quizzes", label: "Academy", icon: FileText },
            { id: "settings", label: "Rules", icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
              }}
              className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id ? "border-blue-500 text-blue-500" : "border-transparent text-slate-600 hover:text-slate-400"}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {feedback && (
        <div className="fixed top-24 right-8 z-[100] bg-slate-900 border border-blue-500/50 text-blue-400 px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-8 animate-in slide-in-from-right-8">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-blue-500" />
            <span className="text-sm font-bold uppercase tracking-widest">
              {feedback}
            </span>
          </div>
          <button onClick={clearFeedback} aria-label="Dismiss feedback">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar pb-24">
        {activeTab === "overview" && (
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                {
                  label: "Fleet Safety Score",
                  value: fmcsaData?.available && fmcsaData.data?.safetyRating
                    ? fmcsaData.data.safetyRating
                    : "N/A",
                  target: fmcsaData?.isMock
                    ? "Mock Data"
                    : fmcsaData?.available
                      ? "FMCSA Verified"
                      : "Target: 95+",
                  color: fmcsaData?.available && fmcsaData.data?.safetyRating === "Satisfactory"
                    ? "text-green-400"
                    : fmcsaData?.available
                      ? "text-yellow-400"
                      : "text-red-400",
                },
                {
                  label: "Pending Maintenance",
                  value: "0",
                  target: "Submitted Reports",
                  color: "text-blue-400",
                },
                {
                  label: "Non-Compliant",
                  value: "13",
                  target: "Drivers Flagged",
                  color: "text-red-400",
                },
                {
                  label: "Out of Service",
                  value: "0",
                  target: "Red Tagged Units",
                  color: "text-red-400",
                },
              ].map((kpi, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900 p-8 rounded-xl border border-slate-800 text-center shadow-sm"
                >
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
                    {kpi.label}
                  </div>
                  <div className={`text-4xl font-bold mb-1 ${kpi.color}`}>
                    {kpi.value}
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {kpi.target}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-2 bg-slate-900 p-8 rounded-xl border border-slate-800">
                <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                  <Activity className="w-5 h-5 text-red-500" /> Fleet Chain of
                  Custody
                </h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto no-scrollbar">
                  {incidents && incidents.length > 0 ? (
                    incidents.map((inc, idx) => (
                      <div key={inc.id || idx} className="space-y-2">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-2">
                          Incident: #{inc.id?.slice(0, 8)} - {inc.type}
                        </div>
                        {(inc.timeline || []).map(
                          (action: any, aIdx: number) => (
                            <div
                              key={aIdx}
                              className="flex justify-between items-start bg-slate-950 p-4 rounded-xl border border-slate-800 hover:border-blue-500/50 transition-all"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-blue-500 uppercase">
                                    {action.actorName || action.actor_name}
                                  </span>
                                  <span className="text-[9px] font-bold text-slate-600 tracking-tighter">
                                    —{" "}
                                    {new Date(
                                      action.timestamp,
                                    ).toLocaleTimeString()}
                                  </span>
                                </div>
                                <div className="font-bold text-white text-[12px] mt-1">
                                  {action.action}
                                </div>
                                <div className="text-[10px] text-slate-400 mt-1 leading-tight">
                                  {action.notes}
                                </div>
                              </div>
                              <span
                                className={`text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase ${inc.severity === "Critical" ? "text-red-400 bg-red-900/20 border-red-900/50" : "text-orange-400 bg-orange-900/20 border-orange-900/50"}`}
                              >
                                {inc.severity}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-[10px] font-black text-slate-600 uppercase tracking-widest opacity-30">
                      No active incidents
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3 bg-slate-900 p-8 rounded-xl border border-slate-800">
                <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                  <Gauge className="w-5 h-5 text-green-500" /> Fleet Health
                  Status
                </h3>
                <div className="space-y-8">
                  {(() => {
                    const avgQuizProgress = quizCourses.length > 0
                      ? Math.round(quizCourses.reduce((sum, q) => sum + q.progress, 0) / quizCourses.length)
                      : 0;
                    const activeEquipCount = fleetEquipment.filter(e => e.status === "Active").length;
                    const totalEquipCount = fleetEquipment.length;
                    const maintPct = totalEquipCount > 0 ? Math.round((activeEquipCount / totalEquipCount) * 100) : 0;
                    return [
                      {
                        label: "Quiz Completion",
                        value: avgQuizProgress,
                        color: "bg-blue-500",
                      },
                      {
                        label: "Vehicle Maintenance",
                        value: maintPct,
                        color: "bg-green-500",
                      },
                      {
                        label: "Incident Free Days",
                        value: incidents.length === 0 ? 0 : 0,
                        color: "bg-purple-500",
                        max: 365,
                        display: incidents.length === 0 ? "No incidents" : "0 Days",
                      },
                    ];
                  })().map((bar, idx) => (
                    <div key={idx} className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>{bar.label}</span>
                        <span>{bar.display || `${bar.value}%`}</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${bar.color} rounded-full transition-all duration-1000`}
                          style={{
                            width: `${(bar.value / (bar.max || 100)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Certificate Expiry Warnings — real data from API */}
            <CertExpiryWarnings companyId={user.companyId} daysAhead={30} />

            {/* Recent Notification Status */}
            {notificationJobs.length > 0 && (
              <div
                data-testid="notification-jobs-section"
                className="bg-slate-900 p-6 rounded-xl border border-slate-800"
              >
                <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-3">
                  <Activity className="w-5 h-5 text-blue-500" />
                  Recent Notifications
                  <span className="text-[9px] font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded-full border border-blue-900/50">
                    {notificationJobs.length}
                  </span>
                </h4>
                <div className="space-y-2 max-h-[300px] overflow-y-auto no-scrollbar">
                  {notificationJobs.slice(0, 10).map((job) => (
                    <div
                      key={job.id}
                      data-testid="notification-job-item"
                      className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-all"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="text-xs font-medium text-white truncate">
                          {job.message}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {job.channel} &middot;{" "}
                          {new Date(job.sent_at).toLocaleString()}
                        </div>
                      </div>
                      <NotificationStatusBadge
                        status={job.status}
                        syncError={
                          job.status === "FAILED" && job.sync_error
                            ? String(job.sync_error)
                            : undefined
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "roster" && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {operators.map((op) => (
              <div
                key={op.user.id}
                className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm flex flex-col"
              >
                <div className="p-8 space-y-8">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xl font-bold text-slate-400">
                        {op.user.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-white">
                          {op.user.name}
                        </h4>
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-900/20 px-3 py-1 rounded-full border border-blue-900/50 uppercase tracking-widest mt-2 inline-block">
                          {op.user.role.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <div
                        className={`w-16 h-16 rounded-full border-4 ${op.performance.totalScore >= 90 ? "border-green-500 bg-green-900/10" : "border-blue-500 bg-blue-900/10"} flex flex-col items-center justify-center`}
                      >
                        <span
                          className={`text-lg font-bold ${op.performance.totalScore >= 90 ? "text-green-500" : "text-blue-500"} leading-none`}
                        >
                          {op.performance.totalScore}
                        </span>
                        <span
                          className={`text-[8px] font-bold ${op.performance.totalScore >= 90 ? "text-green-600" : "text-blue-600"} uppercase`}
                        >
                          Score
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center">
                    <div className="flex items-center justify-center gap-2 text-white font-bold mb-1">
                      {op.performance.grade === "Elite" ? (
                        <Award className="w-4 h-4 text-yellow-500" />
                      ) : (
                        <Target className="w-4 h-4 text-blue-500" />
                      )}
                      {op.performance.grade} Performer
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium italic">
                      Based on recent load activity
                    </div>
                    <div className="text-2xl font-bold text-white mt-2">
                      {op.performance.totalScore}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs px-2">
                    <div className="space-y-1">
                      <div className="text-slate-500 font-medium">
                        On-Time Rate
                      </div>
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />{" "}
                        {Math.round(op.performance.metrics.onTimeRate)}%
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-slate-500 font-medium">
                        Doc Quality
                      </div>
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <FileText className="w-3.5 h-3.5 text-green-500" />{" "}
                        {Math.round(op.performance.metrics.paperworkScore)}%
                      </div>
                    </div>
                  </div>

                  <div className="bg-red-900/10 border border-red-500/20 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-red-400 font-bold text-[10px] uppercase">
                      <AlertTriangle className="w-4 h-4" /> Non-Compliant
                    </div>
                    <ul className="text-[10px] text-red-300 space-y-1 list-disc pl-4 font-medium">
                      <li>
                        Mandatory Quiz Missing: Winter Driving Safety 2024
                      </li>
                      <li>Missing Maintenance Report for December</li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4">
                    <button
                      onClick={async () => {
                        const records = await getComplianceRecords(op.user.id);
                        setComplianceRecords(records);
                        setSelectedDriverCompliance(op.user.name);
                        setShowForm("compliance");
                      }}
                      className="col-span-2 py-4 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-black text-slate-400 hover:text-white border border-white/10 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                    >
                      <ClipboardList className="w-4 h-4" /> Compliance History
                    </button>
                    <button
                      onClick={() => {
                        setFormData({ driverId: op.user.id });
                        setShowForm("incident");
                      }}
                      className="py-3 px-4 rounded-lg bg-orange-600/10 hover:bg-orange-600 text-[10px] font-black text-orange-500 hover:text-white border border-orange-500/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                    >
                      <ShieldAlert className="w-4 h-4" /> Incident
                    </button>
                    <button
                      onClick={() => onOpenHub?.("feed", true)}
                      className="py-3 px-4 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-[10px] font-black text-blue-400 hover:text-white border border-blue-500/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                    >
                      <Phone className="w-4 h-4" /> Call Driver
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "equipment" && (
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Fleet Registry</h2>
              <button
                onClick={() => setShowForm("asset")}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Register Asset
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {fleetEquipment.length > 0 ? (
                fleetEquipment.map((asset) => (
                  <div
                    key={asset.id}
                    className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm space-y-4 hover:border-blue-500/50 transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start">
                      <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center border border-white/5 group-hover:bg-blue-600/20 transition-colors">
                        {asset.type === "Truck" ? (
                          <Truck className="w-5 h-5 text-blue-400 group-hover:text-blue-300" />
                        ) : (
                          <Container className="w-5 h-5 text-purple-400 group-hover:text-purple-300" />
                        )}
                      </div>
                      <span
                        className={`text-[9px] font-black px-2.5 py-1 rounded-full border uppercase tracking-widest ${asset.status === "Active" ? "text-green-400 bg-green-900/20 border-green-500/20" : "text-orange-400 bg-orange-900/20 border-orange-500/20"}`}
                      >
                        {asset.status}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-[15px] font-black text-white uppercase tracking-tight">
                        {asset.unit_number || asset.id}
                      </h4>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {asset.ownership_type || "Owned"} •{" "}
                        {asset.provider_name || "Generic"}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-white/5 flex justify-between items-center opacity-70">
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                        Op Cost
                      </div>
                      <div className="text-[11px] text-white font-black">
                        ${asset.daily_cost || 0}/Day
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => showFeedback(`Service request initiated for ${asset.unit_number || asset.id}`)}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 transition-all border border-white/5"
                      >
                        Service
                      </button>
                      <button
                        onClick={() => showFeedback(`Viewing maintenance history for ${asset.unit_number || asset.id}`)}
                        className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 transition-all border border-white/5"
                      >
                        History
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center opacity-30">
                  <Truck className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    Inventory Syncing with Registry...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "vendors" && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Certified Provider Network
                </h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">
                  Vendor Compliance & Performance Registry
                </p>
              </div>
              <button
                onClick={() => setShowForm("maintenance")} // Reuse or adapt
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Onboard Vendor
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {vendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-slate-900/50 p-8 rounded-[2rem] border border-white/5 group hover:border-blue-500/30 transition-all"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-slate-950 flex items-center justify-center border border-white/5">
                        <Package className="w-7 h-7 text-blue-500" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                          {vendor.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {vendor.type}
                          </span>
                          <div className="w-1 h-1 rounded-full bg-slate-700" />
                          <span className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">
                            {vendor.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {vendor.capabilities.slice(0, 2).map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-1 bg-white/5 rounded text-[8px] font-black uppercase text-slate-400 border border-white/5"
                        >
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-center gap-3 text-slate-400 group-hover:text-blue-400 transition-colors">
                      <Phone className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-black tracking-widest">
                        {vendor.contacts[0]?.phone}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-black uppercase tracking-tight">
                        {vendor.coverage.regions.join(", ")} Coverage
                      </span>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-1">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className="w-5 h-5 rounded-full border border-slate-900 bg-slate-800"
                          />
                        ))}
                      </div>
                      <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                        {serviceTickets.length} Recent Jobs
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigate ? onNavigate("accounting") : showFeedback("Navigate to Accounting to view financials")}
                      className="text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-white transition-colors"
                    >
                      View Financials
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === "maintenance" && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end mb-6">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Maintenance & Service Tickets
                </h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">
                  Lifecycle Fleet Health Governance
                </p>
              </div>
              <button
                onClick={() => setShowForm("maintenance")}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
              >
                <Wrench className="w-4 h-4" /> Open Service Ticket
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[
                {
                  label: "Open Tickets",
                  value: serviceTickets.filter((t) => t.status !== "Closed")
                    .length,
                  color: "text-blue-500",
                },
                {
                  label: "Awaiting Vendor",
                  value: serviceTickets.filter((t) => t.status === "Open")
                    .length,
                  color: "text-orange-500",
                },
                {
                  label: "In Progress",
                  value: serviceTickets.filter(
                    (t) => t.status === "In_Progress",
                  ).length,
                  color: "text-yellow-500",
                },
                { label: "SLA Breach", value: String(serviceTickets.filter((t) => t.status === "Open" && t.eta && new Date(t.eta) < new Date()).length), color: "text-red-500" },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl flex flex-col items-center"
                >
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    {stat.label}
                  </span>
                  <span className={`text-2xl font-black ${stat.color}`}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-slate-900/50 rounded-[2rem] border border-white/5 overflow-hidden backdrop-blur-md">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950/50 border-b border-white/5">
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Ticket ID
                      </th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Unit / Type
                      </th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Vendor Status
                      </th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        ETA / Progress
                      </th>
                      <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                        Estimate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {serviceTickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <td className="px-8 py-6">
                          <div className="text-[11px] font-black text-white uppercase">
                            #{ticket.id.slice(0, 8)}
                          </div>
                          <div className="text-[9px] font-bold text-slate-500 uppercase">
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center border border-white/5 group-hover:border-blue-500/50 transition-colors">
                              <Truck className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                              <div className="text-[11px] font-black text-white uppercase">
                                {ticket.unitId}
                              </div>
                              <div className="text-[9px] font-bold text-slate-500 uppercase">
                                {ticket.type.replace("_", " ")}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div
                            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest ${ticket.status === "Closed" ? "border-green-500/30 bg-green-500/10 text-green-500" : "border-blue-500/30 bg-blue-500/10 text-blue-500"}`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${ticket.status === "Closed" ? "bg-green-500" : "bg-blue-500 animate-pulse"}`}
                            />
                            {ticket.status.replace("_", " ")}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-[11px] font-black text-white uppercase">
                            {ticket.eta || "N/A"}
                          </div>
                          <div className="w-32 h-1 bg-slate-950 rounded-full mt-2 overflow-hidden">
                            <div className="h-full bg-blue-500 w-[45%]" />
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="text-[12px] font-black text-white italic">
                            ${ticket.estimatedCost?.toLocaleString()}
                          </div>
                          <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest">
                            Auth Required
                          </div>
                        </td>
                      </tr>
                    ))}
                    {serviceTickets.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <div className="opacity-10 mb-4 flex justify-center">
                            <Wrench className="w-16 h-16" />
                          </div>
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">
                            No open service tickets
                          </span>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === "quizzes" && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Safety Academy & Training
                </h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1">
                  Fleet Certification & Compliance Matrix
                </p>
              </div>
              <button
                onClick={() => setShowForm("quiz")}
                className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-purple-500/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" /> Create Course
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {quizCourses.length > 0 ? (
                quizCourses.map((course) => (
                  <div
                    key={course.id}
                    className="bg-slate-900/50 p-8 rounded-[2rem] border border-white/5 shadow-sm flex flex-col group hover:border-blue-500/30 transition-all cursor-pointer"
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 bg-slate-950 border border-white/5"
                    >
                      <BookOpen className="w-6 h-6 text-blue-500" />
                    </div>
                    <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-2">
                      {course.title}
                    </h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-8">
                      {course.type} • REQUIRED FOR ALL FLEET
                    </p>

                    <div className="mt-auto space-y-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">Fleet Completion</span>
                        <span className="text-white">{course.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                      <div className="pt-4 flex justify-between items-center">
                        <div className="text-[8px] font-black text-slate-600 uppercase">
                          {course.certifiedCount} Certified Units
                        </div>
                        <button
                          onClick={() => showFeedback(`Managing course: ${course.title}`)}
                          className="text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                          Manage <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center opacity-30">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    No data yet
                  </p>
                </div>
              )}
            </div>

            {/* Recent Tests Ticker */}
            <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-6">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">
                Recent Test Submissions
              </h3>
              <div className="space-y-4">
                {quizResults.length > 0 ? (
                  quizResults.slice(0, 10).map((t) => (
                    <div
                      key={t.id}
                      className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight"
                    >
                      <div className="flex gap-4">
                        <span className="text-white w-32">{t.driverName}</span>
                        <span className="text-slate-500">{t.quizTitle}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="text-slate-400">{t.score}%</span>
                        <span
                          className={
                            t.passed
                              ? "text-green-500"
                              : "text-red-500"
                          }
                        >
                          {t.passed ? "Passed" : "Failed"}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 opacity-30">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                      No data yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-sm">
            <h2 className="text-xl font-bold text-white mb-8">
              Safety Configuration
            </h2>
            <div className="space-y-8">
              {[
                {
                  label: "Minimum Safety Score",
                  desc: "Drivers below this score will be blocked from new dispatches.",
                  value: safetySettings ? String(safetySettings.minSafetyScore) : "N/A",
                },
                {
                  label: "Auto-Lock Compliance",
                  desc: "Block drivers automatically if mandatory quizzes are expired.",
                  value: safetySettings ? (safetySettings.autoLockCompliance ? "On" : "Off") : "N/A",
                },
                {
                  label: "Maintenance Interval",
                  desc: "Default days between PM inspections.",
                  value: safetySettings ? `${safetySettings.maintenanceIntervalDays} Days` : "N/A",
                },
              ].map((s, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-white">
                      {s.label}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-medium">
                      {s.desc}
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-lg text-xs font-bold border border-slate-700 transition-colors">
                    {s.value}
                  </button>
                </div>
              ))}
              <div className="pt-8 border-t border-slate-800">
                <button
                  onClick={() =>
                    showFeedback("Safety Policy Updated & Synced to Fleet")
                  }
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                >
                  Save Safety Policy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showForm && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-white capitalize">
                {showForm.replace("_", " ")} Registration
              </h2>
              <button
                onClick={() => setShowForm(null)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
              {showForm === "asset" && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="svAssetIDUnitNumber" className="text-[10px] font-bold text-slate-500 uppercase">
                      Asset ID / Unit Number *
                    </label>
                    <input id="svAssetIDUnitNumber"
                      type="text"
                      placeholder="e.g. TR-101"
                      className={`w-full bg-slate-950 border ${safetyFormErrors.id ? "border-red-500" : "border-slate-800"} rounded-lg px-4 py-3 text-white focus:border-blue-500 transition-colors outline-none`}
                      onChange={(e) =>
                        setFormData({ ...formData, id: e.target.value })
                      }
                    />
                    {safetyFormErrors.id && <p className="text-red-400 text-xs mt-1">{safetyFormErrors.id}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="svType" className="text-[10px] font-bold text-slate-500 uppercase">
                        Type
                      </label>
                      <select id="svType"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white outline-none"
                        onChange={(e) =>
                          setFormData({ ...formData, type: e.target.value })
                        }
                      >
                        <option value="Truck">Truck</option>
                        <option value="Trailer">Trailer</option>
                        <option value="Chassis">Chassis</option>
                        <option value="Container">Container</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="svOwnership" className="text-[10px] font-bold text-slate-500 uppercase">
                        Ownership
                      </label>
                      <select id="svOwnership"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white outline-none"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            ownershipType: e.target.value,
                          })
                        }
                      >
                        <option value="Company Owned">Company Owned</option>
                        <option value="Leased">Leased</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              {showForm === "maintenance" && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="svSelectAsset" className="text-[10px] font-bold text-slate-500 uppercase">
                      Select Asset
                    </label>
                    <select id="svSelectAsset"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white outline-none"
                      onChange={(e) =>
                        setFormData({ ...formData, unitId: e.target.value })
                      }
                    >
                      <option value="">Select Unit...</option>
                      {fleetEquipment.map((eq) => (
                        <option key={eq.id} value={eq.id}>
                          {eq.unit_number || eq.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="svServiceDescription" className="text-[10px] font-bold text-slate-500 uppercase">
                      Service Description *
                    </label>
                    <textarea id="svServiceDescription"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white h-24 outline-none"
                      placeholder="e.g. Annual Inspection and Oil Change"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                    />
                    {safetyFormErrors.description && <p className="text-red-400 text-xs mt-1">{safetyFormErrors.description}</p>}
                  </div>
                </>
              )}
              {showForm === "quiz" && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="svCourseTitle" className="text-[10px] font-bold text-slate-500 uppercase">
                      Course Title
                    </label>
                    <input id="svCourseTitle"
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white outline-none"
                      placeholder="e.g. Hazardous Materials Handling"
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="mandatory"
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isMandatory: e.target.checked,
                        })
                      }
                    />
                    <label
                      htmlFor="mandatory"
                      className="text-sm text-slate-300"
                    >
                      Mandatory for all operators
                    </label>
                  </div>
                </>
              )}
              {showForm === "incident" && (
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="svSelectRelevantManifest" className="text-[10px] font-bold text-slate-500 uppercase">
                        Select Relevant Manifest
                      </label>
                      <select id="svSelectRelevantManifest"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none"
                        onChange={(e) =>
                          setFormData({ ...formData, loadId: e.target.value })
                        }
                        required
                      >
                        <option value="">Select Load...</option>
                        {loads
                          .filter((l) => l.driverId === formData.driverId)
                          .map((l) => (
                            <option key={l.id} value={l.id}>
                              PRO {l.loadNumber} - {l.pickup?.city ?? ""}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="svIncidentSeverity" className="text-[10px] font-bold text-slate-500 uppercase">
                        Incident Severity
                      </label>
                      <select id="svIncidentSeverity"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none"
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                      >
                        <option value="Safety">Safety Violation</option>
                        <option value="Maintenance">Equipment Failure</option>
                        <option value="Incident">Generic Incident</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="svDescriptionOfEvent" className="text-[10px] font-bold text-slate-500 uppercase">
                        Description of Event *
                      </label>
                      <textarea id="svDescriptionOfEvent"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-4 text-sm text-white h-32 outline-none resize-none placeholder:text-slate-700"
                        placeholder="DESCRIBE THE INCIDENT IN DETAIL FOR AUDIT CONTROL..."
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="p-8 border-t border-slate-800 bg-slate-950/50">
              <button
                disabled={isSubmitting || !isSafetyFormValid}
                onClick={async () => {
                  const errs: Record<string, string> = {};
                  if (showForm === "asset") {
                    if (!formData.id?.trim()) errs.id = "Unit number is required";
                  }
                  if (showForm === "maintenance") {
                    if (!formData.description?.trim()) errs.description = "Description is required";
                  }
                  if (showForm === "incident") {
                    if (!formData.description?.trim()) errs.description = "Description is required";
                  }
                  // R-P3-03: Validate quiz title before submission
                  if (showForm === "quiz") {
                    if (!formData.title?.trim()) errs.title = "Course title is required";
                  }
                  if (Object.keys(errs).length > 0) {
                    setSafetyFormErrors(errs);
                    return;
                  }
                  setSafetyFormErrors({});
                  setIsSubmitting(true);
                  try {
                    if (showForm === "asset")
                      await registerAsset(user.companyId, formData, user);
                    else if (showForm === "maintenance")
                      await saveMaintenanceRecord({
                        ...formData,
                        id: uuidv4(),
                        date: new Date().toISOString(),
                      });
                    else if (showForm === "quiz")
                      await saveQuiz({
                        ...formData,
                        id: uuidv4(),
                        createdAt: new Date().toISOString(),
                        questions: [],
                        assignedTo: ["all"],
                      });
                    else if (showForm === "incident") {
                      const newIncident = {
                        id: uuidv4(),
                        loadId: formData.loadId,
                        type: formData.category || "Incident",
                        severity:
                          formData.category === "Safety" ? "Critical" : "High",
                        status: "Open",
                        description: formData.description,
                        reportedAt: new Date().toISOString(),
                        reportedBy: user.name,
                        timeline: [
                          {
                            id: uuidv4(),
                            timestamp: new Date().toISOString(),
                            action: "Incident Created",
                            notes: `Incident created by Safety Department: ${formData.description}`,
                            actorName: user.name,
                          },
                        ],
                        isAtRisk: true,
                        serviceTickets: [],
                        billingItems: [],
                      };
                      await createIncident(newIncident as any);

                      // Also add an issue to the load for visibility in Dispatch Board
                      const targetLoad = loads.find(
                        (l) => l.id === formData.loadId,
                      );
                      if (targetLoad) {
                        const newIssue = {
                          id: uuidv4(),
                          category: formData.category || "Incident",
                          description:
                            formData.description || "No description provided.",
                          reportedAt: new Date().toISOString(),
                          reportedBy: user.name,
                          status: "Open" as const,
                        };
                        const updatedLoad = {
                          ...targetLoad,
                          issues: [...(targetLoad.issues || []), newIssue],
                          isActionRequired: true,
                          actionSummary: `CRISIS ALERT: ${formData.description}`,
                        };
                        await saveLoad(updatedLoad, user);
                      }
                    }

                    showFeedback(
                      `${showForm.charAt(0).toUpperCase() + showForm.slice(1)} Saved Successfully`,
                    );
                    setShowForm(null);
                    setFormData({});
                  } catch (err) {
                    console.error(`Failed to save ${showForm}:`, err);
                    showFeedback(
                      `Failed to save ${showForm}. Please try again.`,
                    );
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting
                  ? "Submitting..."
                  : `Submit ${showForm?.replace("_", " ")}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {showForm === "compliance" && (
        <div className="fixed inset-0 z-[1000] bg-[#050810]/95 backdrop-blur-xl flex items-center justify-center p-8">
          <div className="w-full max-w-4xl bg-slate-900 border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-2xl flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                    Compliance History
                  </h3>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {selectedDriverCompliance}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowForm(null)}
                className="p-3 hover:bg-white/10 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4 no-scrollbar">
              {complianceRecords.length > 0 ? (
                <div className="space-y-4">
                  {complianceRecords.map((record) => (
                    <div
                      key={record.id}
                      className="p-6 bg-slate-950 border border-white/5 rounded-2xl flex justify-between items-center group hover:border-blue-500/30 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest bg-blue-500/10 px-2 py-0.5 rounded">
                            {record.type}
                          </span>
                          <h4 className="text-sm font-black text-white uppercase">
                            {record.title}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-500">
                          {record.description}
                        </p>
                        <div className="flex gap-4 pt-2">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Expires:{" "}
                            {new Date(record.expires_at).toLocaleDateString()}
                          </span>
                          {record.reference_number && (
                            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Ref:{" "}
                              {record.reference_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-widest ${record.status === "Valid" ? "text-green-400 bg-green-900/20 border-green-500/20" : "text-red-400 bg-red-900/20 border-red-500/20"}`}
                        >
                          {record.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center opacity-30">
                  <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-slate-600" />
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    No active compliance violations logged.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
