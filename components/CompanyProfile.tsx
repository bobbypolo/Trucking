import React, { useState, useEffect, useCallback } from "react";
import { useAutoFeedback } from "../hooks/useAutoFeedback";
import {
  User,
  Company,
  AccessorialRates,
  RolePermissions,
  FreightType,
  TimeLog,
  OperatingMode,
} from "../types";
import {
  getCompany,
  updateCompany,
  getCompanyUsers,
  updateUser,
  getCurrentUser,
  checkCapability,
  CAPABILITY_PRESETS,
} from "../services/authService";
import { logTime, getTimeLogs } from "../services/storageService";
import {
  Building2,
  Save,
  Users,
  DollarSign,
  Info,
  Lock,
  ShieldCheck,
  MapPin,
  Globe,
  Edit2,
  Truck,
  Container,
  Box,
  Mail,
  Phone,
  Hash,
  Zap,
  ThermometerSnowflake,
  Construction,
  Check,
  Briefcase,
  FileText,
  Scale,
  Plus,
  Clock,
  Award,
  X,
  Play,
  Square,
  History,
  Navigation,
  User as UserIcon,
  CreditCard,
  ExternalLink,
  Link2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { AccountType } from "../types";
import { EditUserModal } from "./EditUserModal";

// ---------------------------------------------------------------------------
// Defensive defaults for optional nested config objects
// ---------------------------------------------------------------------------
const DEFAULT_LOAD_NUMBERING = {
  prefix: "LD",
  nextSequence: 1,
  separator: "-",
  enabled: true,
};

const DEFAULT_SCORING_CONFIG = {
  enabled: false,
  minimumDispatchScore: 75,
  weights: {
    safety: 40,
    onTime: 30,
    paperwork: 30,
  },
};

const DEFAULT_GOVERNANCE = {
  autoLockCompliance: false,
  requireQuizPass: false,
  requireMaintenancePass: false,
  maxLoadsPerDriverPerWeek: 5,
  preferredCurrency: "USD",
};

const DEFAULT_DRIVER_PERMISSIONS: Record<string, boolean> = {
  viewSettlements: true,
  viewSafety: true,
  showRates: false,
};

const DEFAULT_DISPATCHER_PERMISSIONS: Record<string, boolean> = {
  manageSafety: true,
  createLoads: true,
  viewIntelligence: false,
};

// ---------------------------------------------------------------------------
// Safe accessors — prevent crashes from undefined nested objects
// ---------------------------------------------------------------------------
function safeLoadNumbering(company: Company) {
  return {
    ...DEFAULT_LOAD_NUMBERING,
    ...(company.loadNumberingConfig ?? {}),
  };
}

function safeScoringConfig(company: Company) {
  return {
    ...DEFAULT_SCORING_CONFIG,
    ...(company.scoringConfig ?? {}),
  };
}

function safeGovernance(company: Company) {
  return {
    ...DEFAULT_GOVERNANCE,
    ...(company.governance ?? {}),
  };
}

function safeDriverPerms(
  company: Company,
): Record<string, boolean | undefined> {
  return {
    ...DEFAULT_DRIVER_PERMISSIONS,
    ...((company.driverPermissions as Record<string, boolean | undefined>) ??
      {}),
  };
}

function safeDispatcherPerms(
  company: Company,
): Record<string, boolean | undefined> {
  return {
    ...DEFAULT_DISPATCHER_PERMISSIONS,
    ...((company.dispatcherPermissions as Record<
      string,
      boolean | undefined
    >) ?? {}),
  };
}

// ---------------------------------------------------------------------------
// Tab error boundary — catches render errors per-tab
// ---------------------------------------------------------------------------
class TabErrorBoundary extends React.Component<
  { tabName: string; children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { tabName: string; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-4xl mx-auto animate-fade-in">
          <div className="bg-red-950/30 border border-red-500/30 rounded-[2.5rem] p-10 text-center space-y-4">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
            <h3 className="text-sm font-black text-red-400 uppercase tracking-tight">
              {this.props.tabName} failed to render
            </h3>
            <p className="text-[10px] text-red-300/70 font-bold uppercase tracking-widest">
              {this.state.error}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: "" })}
              className="bg-red-600/20 text-red-400 border border-red-500/30 px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Loading skeleton for initial data fetch
// ---------------------------------------------------------------------------
function SettingsLoadingSkeleton() {
  return (
    <div
      className="h-full flex flex-col bg-[#020617] text-slate-100 font-sans"
      data-testid="settings-loading"
    >
      {/* Header skeleton */}
      <div className="bg-slate-900 px-10 pt-10 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-6 mb-10">
          <div className="w-16 h-16 bg-slate-800 rounded-[1.5rem] animate-pulse" />
          <div className="space-y-3">
            <div className="h-8 w-48 bg-slate-800 rounded-xl animate-pulse" />
            <div className="h-3 w-32 bg-slate-800/60 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex space-x-10 pb-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-4 w-20 bg-slate-800/50 rounded animate-pulse"
            />
          ))}
        </div>
      </div>
      {/* Content skeleton */}
      <div className="flex-1 p-10 space-y-8">
        <p className="text-center text-slate-700 font-black uppercase tracking-[0.3em] animate-pulse text-[10px]">
          Loading company settings...
        </p>
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 space-y-6"
            >
              <div className="h-5 w-36 bg-slate-800 rounded animate-pulse" />
              <div className="space-y-4">
                <div className="h-12 bg-slate-800/50 rounded-2xl animate-pulse" />
                <div className="h-12 bg-slate-800/50 rounded-2xl animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state for failed data load
// ---------------------------------------------------------------------------
function SettingsErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div
      className="h-full flex flex-col bg-[#020617] text-slate-100 font-sans items-center justify-center"
      data-testid="settings-error"
    >
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 bg-red-600/10 rounded-[2rem] flex items-center justify-center mx-auto border border-red-500/20">
          <AlertTriangle className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-xl font-black text-white uppercase tracking-tight">
          Failed to load settings
        </h2>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {error}
        </p>
        <button
          onClick={onRetry}
          className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-3 mx-auto shadow-2xl active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
interface Props {
  user: User;
  company?: Company;
  users?: User[];
  onUserRegistryChange?: () => void;
}

type TabId =
  | "identity"
  | "company_profile"
  | "registry"
  | "permissions"
  | "policy"
  | "driver_cockpit";

export const CompanyProfile: React.FC<Props> = ({
  user,
  onUserRegistryChange,
}) => {
  const [company, setCompany] = useState<Company | undefined>(undefined);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("identity");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    role: "driver",
    onboardingStatus: "Pending",
  });
  const [msg, showMsg] = useAutoFeedback<string>({ clearValue: "" });
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [clockNotes, setClockNotes] = useState("");
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [timeLogs, setTimeLogs] = useState<
    { type: string; time: string; date: string; status: string }[]
  >([]);
  const [timeLogsLoading, setTimeLogsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billingAvailable, setBillingAvailable] = useState<boolean | null>(
    null,
  );
  const [qbStatus, setQbStatus] = useState<{
    available: boolean | null;
    connected: boolean;
    companyName?: string;
  }>({ available: null, connected: false });
  const [billingLoading, setBillingLoading] = useState(false);

  // Loading / error state for initial fetch
  const [loadingState, setLoadingState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [loadError, setLoadError] = useState("");
  // Track dirty state per tab
  const [isDirty, setIsDirty] = useState(false);

  const isAdmin =
    user.role === "admin" ||
    user.role === "payroll_manager" ||
    user.role === "dispatcher" ||
    user.role === "OWNER_ADMIN";
  const isDriver = user.role === "driver" || user.role === "owner_operator";

  const loadData = useCallback(async () => {
    setLoadingState("loading");
    setLoadError("");
    try {
      if (user.companyId) {
        const [c, u] = await Promise.all([
          getCompany(user.companyId),
          getCompanyUsers(user.companyId),
        ]);
        if (c) setCompany(c);
        setUsers(u);
      }
      if (isDriver) setActiveTab("driver_cockpit");
      setLoadingState("ready");
    } catch (err) {
      console.error("[CompanyProfile] Failed to load company data:", err);
      setLoadError(
        err instanceof Error
          ? err.message
          : "Unable to reach the server. Please check your connection.",
      );
      setLoadingState("error");
    }
  }, [user.companyId, isDriver]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Mark dirty when company state changes (after initial load)
  const updateCompanyField = useCallback(
    (updater: (prev: Company) => Company) => {
      setCompany((prev) => {
        if (!prev) return prev;
        setIsDirty(true);
        return updater(prev);
      });
    },
    [],
  );

  // Fetch QuickBooks connection status
  useEffect(() => {
    if (!isAdmin) return;
    const checkQb = async () => {
      try {
        const res = await fetch("/api/quickbooks/status", {
          headers: { "Content-Type": "application/json" },
        });
        if (res.status === 503) {
          setQbStatus({ available: false, connected: false });
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setQbStatus({
            available: true,
            connected: data.connected || false,
            companyName: data.companyName,
          });
        } else {
          setQbStatus({ available: false, connected: false });
        }
      } catch {
        setQbStatus({ available: false, connected: false });
      }
    };
    checkQb();
  }, [isAdmin]);

  // Determine billing availability from company stripe data
  useEffect(() => {
    if (!isAdmin || !company) return;
    if (company.stripeCustomerId) {
      setBillingAvailable(true);
    } else {
      setBillingAvailable(false);
    }
  }, [isAdmin, company]);

  useEffect(() => {
    if (!isDriver) return;
    const fetchLogs = async () => {
      setTimeLogsLoading(true);
      try {
        const logs = await getTimeLogs(user.id);
        const recent = logs.slice(0, 5).map((log) => ({
          type: log.clockOut ? "ClockOut" : "ClockIn",
          time: new Date(log.clockOut || log.clockIn || "").toLocaleTimeString(
            [],
            { hour: "2-digit", minute: "2-digit" },
          ),
          date: new Date(log.clockOut || log.clockIn || "").toLocaleDateString(
            [],
            { month: "short", day: "numeric" },
          ),
          status: log.clockOut ? "Completed" : "Active",
        }));
        setTimeLogs(recent);
      } catch (err) {
        console.error("[CompanyProfile] Failed to load time logs:", err);
        setTimeLogs([]);
      } finally {
        setTimeLogsLoading(false);
      }
    };
    fetchLogs();
  }, [user.id, isDriver, isClockedIn]);

  const handleClockIn = async () => {
    const now = new Date().toISOString();
    try {
      const success = await logTime({
        userId: user.id,
        activityType: "Driving/Active Duty",
        clockIn: now,
        location: undefined,
      });
      if (success !== undefined) {
        setIsClockedIn(true);
        setClockInTime(now);
        showMsg("Clocked In Successfully.", 3000);
      } else {
        showMsg("Clock-in failed. Please try again.", 3000);
      }
    } catch (err) {
      console.error("[CompanyProfile] Clock-in failed:", err);
      showMsg("Clock-in failed. Please try again.", 3000);
    }
  };

  const handleClockOut = async () => {
    try {
      const success = await logTime({
        userId: user.id,
        activityType: "Off Duty",
        clockOut: new Date().toISOString(),
      });
      if (success !== undefined) {
        setIsClockedIn(false);
        setClockInTime(null);
        setShowClockOutModal(false);
        setClockNotes("");
        showMsg("Shift ended.", 3000);
      } else {
        showMsg("Clock-out failed. Please try again.", 3000);
      }
    } catch (err) {
      console.error("[CompanyProfile] Clock-out failed:", err);
      showMsg("Clock-out failed. Please try again.", 3000);
    }
  };

  const handleManageSubscription = async () => {
    if (!company?.stripeCustomerId) return;
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/create-billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stripeCustomerId: company.stripeCustomerId,
          returnUrl: window.location.href,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.assign(data.url);
        }
      } else {
        showMsg("Unable to open billing portal. Please try again.", 4000);
      }
    } catch {
      showMsg("Unable to open billing portal. Please try again.", 4000);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleConnectQuickBooks = async () => {
    try {
      const res = await fetch("/api/quickbooks/auth-url", {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.assign(data.url);
        }
      } else {
        showMsg("Unable to connect QuickBooks. Please try again.", 4000);
      }
    } catch {
      showMsg("Unable to connect QuickBooks. Please try again.", 4000);
    }
  };

  const handleSaveCompany = async () => {
    if (!company || !isAdmin) return;
    setIsSubmitting(true);
    try {
      await updateCompany(company);
      setIsDirty(false);
      showMsg("Save Changes.", 4000);
    } catch (err) {
      console.error("[CompanyProfile] Save company failed:", err);
      showMsg("Failed to save changes. Please try again.", 4000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserUpdate = async (updatedUser: User) => {
    await updateUser(updatedUser);
    setEditingUser(null);
    const u = await getCompanyUsers(user.companyId);
    setUsers(u);
    if (onUserRegistryChange) onUserRegistryChange();
  };

  const toggleFreightAuthorization = (type: FreightType) => {
    if (!company) return;
    const current = company.supportedFreightTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];

    if (updated.length > 0) {
      let newDefault = company.defaultFreightType;
      if (!updated.includes(newDefault)) newDefault = updated[0];
      updateCompanyField((prev) => ({
        ...prev,
        supportedFreightTypes: updated,
        defaultFreightType: newDefault,
      }));
    }
  };

  const handleOperatingModeChange = (mode: OperatingMode) => {
    if (!company) return;
    updateCompanyField((prev) => ({
      ...prev,
      operatingMode: mode,
      capabilityMatrix: CAPABILITY_PRESETS[mode],
    }));
    showMsg(`System reconfigured to ${mode} mode.`, 3000);
  };

  const freightOptions: {
    id: FreightType;
    label: string;
    icon: React.ElementType;
  }[] = [
    { id: "Dry Van", label: "Dry Van", icon: Box },
    { id: "Reefer", label: "Reefer", icon: ThermometerSnowflake },
    { id: "Flatbed", label: "Flatbed", icon: Construction },
    { id: "Intermodal", label: "Intermodal", icon: Container },
  ];

  // --- Render: Loading state ---
  if (loadingState === "loading") {
    return <SettingsLoadingSkeleton />;
  }

  // --- Render: Error state ---
  if (loadingState === "error") {
    return <SettingsErrorState error={loadError} onRetry={loadData} />;
  }

  // --- Render: No company data (edge case) ---
  if (!company) {
    return (
      <div
        className="p-12 text-center text-slate-700 font-black uppercase tracking-[0.3em] text-[10px]"
        data-testid="settings-no-company"
      >
        No company data available. Please contact support.
      </div>
    );
  }

  // Safe config accessors for rendering
  const loadNumbering = safeLoadNumbering(company);
  const scoring = safeScoringConfig(company);
  const governance = safeGovernance(company);
  const driverPerms = safeDriverPerms(company);
  const dispatcherPerms = safeDispatcherPerms(company);

  return (
    <div className="h-full flex flex-col bg-[#020617] animate-fade-in text-slate-100 relative overflow-hidden font-sans">
      {editingUser && (
        <EditUserModal
          user={editingUser}
          onSave={handleUserUpdate}
          onCancel={() => setEditingUser(null)}
        />
      )}

      {msg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] bg-blue-600 text-white px-8 py-4 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl animate-scale-in flex items-center gap-4 border border-blue-400 text-[10px]">
          <ShieldCheck className="w-5 h-5" /> {msg}
        </div>
      )}

      {/* Premium Header */}
      <div className="bg-slate-900 px-10 pt-10 border-b border-slate-800 shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-blue-600 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/30 border border-blue-400/20">
              {isDriver ? (
                <Truck className="w-8 h-8 text-white" />
              ) : (
                <Building2 className="w-8 h-8 text-white" />
              )}
            </div>
            <div>
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">
                {isDriver ? user.name : company.name || "Company Settings"}
              </h2>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-2">
                {isDriver
                  ? `${user.role.replace("_", " ")} unit`
                  : "Company Profile"}
              </p>
            </div>
          </div>
          {!isDriver && (
            <div className="flex items-center gap-4">
              {isDirty && (
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-widest animate-pulse">
                  Unsaved changes
                </span>
              )}
              <button
                onClick={isAdmin ? handleSaveCompany : undefined}
                disabled={!isAdmin || isSubmitting}
                title={
                  !isAdmin ? "Only administrators can save changes" : undefined
                }
                aria-label={
                  !isAdmin
                    ? "Save Changes - Only administrators can save changes"
                    : undefined
                }
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />{" "}
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        <nav className="flex space-x-10 overflow-x-auto no-scrollbar">
          {isDriver && (
            <button
              onClick={() => setActiveTab("driver_cockpit")}
              className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-3 whitespace-nowrap ${activeTab === "driver_cockpit" ? "border-blue-500 text-blue-500" : "border-transparent text-slate-600 hover:text-slate-400"}`}
            >
              <Clock className="w-4 h-4" /> Time Clock
            </button>
          )}
          {isAdmin &&
            [
              { id: "identity" as TabId, label: "Identity", icon: FileText },
              {
                id: "company_profile" as TabId,
                label: "Operations",
                icon: Zap,
              },
              { id: "registry" as TabId, label: "Personnel", icon: Users },
              { id: "permissions" as TabId, label: "Security", icon: Lock },
              { id: "policy" as TabId, label: "Governance", icon: Scale },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] border-b-2 transition-all flex items-center gap-3 whitespace-nowrap ${activeTab === tab.id ? "border-blue-500 text-blue-500" : "border-transparent text-slate-600 hover:text-slate-400"}`}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
              </button>
            ))}
        </nav>
      </div>

      <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar pb-24 bg-slate-900/50">
        {!isAdmin && !isDriver && (
          <div
            className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 flex items-center gap-3"
            role="status"
            aria-live="polite"
          >
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
              Viewing as read-only — Only administrators can modify company
              settings
            </p>
          </div>
        )}

        {/* ============================================================= */}
        {/* DRIVER COCKPIT TAB                                            */}
        {/* ============================================================= */}
        {activeTab === "driver_cockpit" && (
          <TabErrorBoundary tabName="Time Clock">
            <div className="max-w-4xl mx-auto space-y-12 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-slate-950 p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                  <div
                    className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-20 transition-colors ${isClockedIn ? "bg-green-500" : "bg-blue-500"}`}
                  />
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-10 flex items-center gap-3">
                    <Clock className="w-4 h-4" /> Time Tracker
                  </div>
                  <div className="flex flex-col items-center text-center py-6">
                    <div
                      className={`w-24 h-24 rounded-[2rem] flex items-center justify-center mb-6 border-2 transition-all duration-700 ${isClockedIn ? "bg-green-600/10 border-green-500/50 scale-110 shadow-2xl shadow-green-500/20" : "bg-slate-900 border-slate-800"}`}
                    >
                      {isClockedIn ? (
                        <Navigation className="w-10 h-10 text-green-500 animate-pulse" />
                      ) : (
                        <Play className="w-10 h-10 text-blue-500" />
                      )}
                    </div>
                    <div className="text-4xl font-black text-white uppercase tracking-tighter mb-2">
                      {isClockedIn ? "Active Duty" : "Off Duty"}
                    </div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      {isClockedIn && clockInTime
                        ? `Since ${new Date(clockInTime).toLocaleTimeString()}`
                        : "System Standby"}
                    </div>
                  </div>
                  <div className="mt-12">
                    {!isClockedIn ? (
                      <button
                        onClick={handleClockIn}
                        className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <Play className="w-4 h-4" /> Clock In
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowClockOutModal(true)}
                        className="w-full py-6 bg-red-600 hover:bg-red-500 text-white rounded-[2rem] font-black uppercase tracking-[0.3em] text-xs shadow-2xl shadow-red-500/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                      >
                        <Square className="w-4 h-4" /> Clock Out
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-slate-950 p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-10 flex items-center gap-3">
                    <History className="w-4 h-4" /> Recent Transitions
                  </div>
                  <div className="space-y-6">
                    {timeLogsLoading ? (
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center py-8 animate-pulse">
                        Loading time entries...
                      </div>
                    ) : timeLogs.length === 0 ? (
                      <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center py-8">
                        No time entries yet
                      </div>
                    ) : (
                      timeLogs.map((log, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50"
                        >
                          <div className="flex items-center gap-4">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.type === "ClockIn" ? "bg-blue-600/10 text-blue-500" : "bg-red-600/10 text-red-500"}`}
                            >
                              {log.type === "ClockIn" ? (
                                <Play className="w-4 h-4" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </div>
                            <div>
                              <div className="text-xs font-black text-white uppercase tracking-tight">
                                {log.type === "ClockIn"
                                  ? "Began Duty"
                                  : "Duty Cycle Exit"}
                              </div>
                              <div className="text-[9px] text-slate-500 font-bold uppercase">
                                {log.date} @ {log.time}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${log.status === "Active" ? "bg-green-600/20 text-green-400" : "text-slate-600"}`}
                          >
                            {log.status}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </TabErrorBoundary>
        )}

        {/* ============================================================= */}
        {/* IDENTITY TAB — now editable for admins                        */}
        {/* ============================================================= */}
        {activeTab === "identity" && (
          <TabErrorBoundary tabName="Identity">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
              <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <FileText className="w-5 h-5 text-blue-500" /> Company Info
                </h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[9px] text-slate-500 uppercase font-black px-1">
                        MC #
                      </label>
                      <div
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-mono font-black"
                        title="e.g., MC-123456"
                        data-testid="mc-hint"
                      >
                        {company.mcNumber || "Not provided"}
                      </div>
                      <p className="text-[8px] text-slate-600 font-bold px-1">
                        e.g., MC-123456
                      </p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] text-slate-500 uppercase font-black px-1">
                        DOT #
                      </label>
                      <div
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-mono font-black"
                        title="e.g., DOT-123456"
                        data-testid="dot-hint"
                      >
                        {company.dotNumber || "Not provided"}
                      </div>
                      <p className="text-[8px] text-slate-600 font-bold px-1">
                        e.g., DOT-123456
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cpLegalName"
                      className="text-[9px] text-slate-500 uppercase font-black px-1"
                    >
                      Legal Name
                    </label>
                    <input
                      id="cpLegalName"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-white font-black uppercase tracking-tight"
                      value={company.name || ""}
                      readOnly
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cpPhone"
                      className="text-[9px] text-slate-500 uppercase font-black px-1"
                    >
                      Phone
                    </label>
                    <input
                      id="cpPhone"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-white font-bold focus:border-blue-500 outline-none transition-all"
                      value={company.phone || ""}
                      placeholder="(555) 123-4567"
                      readOnly={!isAdmin}
                      onChange={(e) =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cpEmail"
                      className="text-[9px] text-slate-500 uppercase font-black px-1"
                    >
                      Email
                    </label>
                    <input
                      id="cpEmail"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-white font-bold focus:border-blue-500 outline-none transition-all"
                      value={company.email || ""}
                      placeholder="contact@company.com"
                      readOnly={!isAdmin}
                      onChange={(e) =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-indigo-500" /> Office Address
                </h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label
                      htmlFor="cpMainTerminalAddress"
                      className="text-[9px] text-slate-500 uppercase font-black px-1"
                    >
                      Main Terminal Address
                    </label>
                    <input
                      id="cpMainTerminalAddress"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-sm text-white font-bold focus:border-blue-500 outline-none transition-all"
                      value={company.address || ""}
                      placeholder="123 Main Street"
                      readOnly={!isAdmin}
                      onChange={(e) =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          address: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="cpCity"
                        className="text-[9px] text-slate-500 uppercase font-black px-1"
                      >
                        City
                      </label>
                      <input
                        id="cpCity"
                        aria-label="CITY"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-bold focus:border-blue-500 outline-none transition-all"
                        value={company.city || ""}
                        placeholder="CITY"
                        readOnly={!isAdmin}
                        onChange={(e) =>
                          updateCompanyField((prev) => ({
                            ...prev,
                            city: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="cpState"
                        className="text-[9px] text-slate-500 uppercase font-black px-1"
                      >
                        State
                      </label>
                      <input
                        id="cpState"
                        aria-label="ST"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-bold text-center focus:border-blue-500 outline-none transition-all"
                        value={company.state || ""}
                        placeholder="ST"
                        readOnly={!isAdmin}
                        onChange={(e) =>
                          updateCompanyField((prev) => ({
                            ...prev,
                            state: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="cpZip"
                        className="text-[9px] text-slate-500 uppercase font-black px-1"
                      >
                        ZIP
                      </label>
                      <input
                        id="cpZip"
                        aria-label="ZIP"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-bold text-center focus:border-blue-500 outline-none transition-all"
                        value={company.zip || ""}
                        placeholder="ZIP"
                        readOnly={!isAdmin}
                        onChange={(e) =>
                          updateCompanyField((prev) => ({
                            ...prev,
                            zip: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Billing & Subscription Section */}
              {billingAvailable && company.stripeCustomerId && (
                <div
                  data-testid="billing-section"
                  className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8"
                >
                  <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-emerald-500" /> Billing
                    & Subscription
                  </h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase font-black mb-2">
                          Current Plan
                        </div>
                        <div className="text-lg font-black text-white uppercase tracking-tight">
                          {company.subscriptionTier || "Free"}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                          company.subscriptionStatus === "active"
                            ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                            : company.subscriptionStatus === "trial"
                              ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                              : "bg-red-600/20 text-red-400 border border-red-500/30"
                        }`}
                      >
                        {company.subscriptionStatus || "unknown"}
                      </span>
                    </div>
                    {company.subscriptionPeriodEnd && (
                      <div data-testid="billing-period-end">
                        <div className="text-[9px] text-slate-500 uppercase font-black mb-1">
                          Period Ends
                        </div>
                        <div className="text-xs text-slate-300 font-bold">
                          {new Date(
                            company.subscriptionPeriodEnd,
                          ).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    )}
                    <button
                      data-testid="manage-subscription-btn"
                      onClick={handleManageSubscription}
                      disabled={billingLoading}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-60"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {billingLoading
                        ? "Opening Portal..."
                        : "Manage Subscription"}
                    </button>
                  </div>
                </div>
              )}

              {/* QuickBooks Integration Section */}
              {qbStatus.available !== false && (
                <div
                  data-testid="quickbooks-section"
                  className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8"
                >
                  <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <Link2 className="w-5 h-5 text-blue-500" /> QuickBooks
                    Integration
                  </h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[9px] text-slate-500 uppercase font-black mb-2">
                          Connection Status
                        </div>
                        <div className="text-sm font-bold text-white">
                          {qbStatus.connected
                            ? qbStatus.companyName || "Connected"
                            : "Not Connected"}
                        </div>
                      </div>
                      <span
                        className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${
                          qbStatus.connected
                            ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-slate-700/30 text-slate-400 border border-slate-600/30"
                        }`}
                      >
                        {qbStatus.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>
                    {!qbStatus.connected && (
                      <button
                        data-testid="connect-quickbooks-btn"
                        onClick={handleConnectQuickBooks}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" /> Connect QuickBooks
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabErrorBoundary>
        )}

        {/* ============================================================= */}
        {/* OPERATIONS TAB — defensive access for loadNumberingConfig      */}
        {/* ============================================================= */}
        {activeTab === "company_profile" && (
          <TabErrorBoundary tabName="Operations">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
              <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <Zap className="w-5 h-5 text-yellow-500" /> Fleet
                  Configuration
                </h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] text-slate-500 uppercase font-black px-1">
                      Authorized Freight Types
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {freightOptions.map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => toggleFreightAuthorization(opt.id)}
                          className={`p-4 rounded-2xl border text-left transition-all flex items-center gap-3 ${(company.supportedFreightTypes ?? []).includes(opt.id) ? "bg-blue-600/10 border-blue-500/50" : "bg-slate-900 border-slate-800 opacity-50"}`}
                        >
                          <opt.icon
                            className={`w-4 h-4 ${(company.supportedFreightTypes ?? []).includes(opt.id) ? "text-blue-500" : "text-slate-600"}`}
                          />
                          <span
                            className={`text-[10px] font-black uppercase ${(company.supportedFreightTypes ?? []).includes(opt.id) ? "text-white" : "text-slate-600"}`}
                          >
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cpCompanyStructure"
                      className="text-[9px] text-slate-500 uppercase font-black px-1"
                    >
                      Company Structure
                    </label>
                    <select
                      id="cpCompanyStructure"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-black uppercase outline-none focus:border-blue-500 transition-all"
                      value={company.accountType || "fleet"}
                      onChange={(e) =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          accountType: e.target.value as AccountType,
                        }))
                      }
                    >
                      <option value="fleet">Fleet Operation</option>
                      <option value="owner_operator">
                        Leased Owner Operator
                      </option>
                      <option value="independent_driver">
                        Independent Operator
                      </option>
                    </select>
                  </div>
                  <div className="space-y-4 pt-4 border-t border-slate-800">
                    <label className="text-[9px] text-slate-500 uppercase font-black px-1 flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3 text-blue-500" /> System
                      Operating Mode (Owner Switch)
                    </label>
                    <div className="grid grid-cols-1 gap-3">
                      {(
                        [
                          "Small Team",
                          "Split Roles",
                          "Enterprise",
                        ] as OperatingMode[]
                      ).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => handleOperatingModeChange(mode)}
                          className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${(company.operatingMode ?? "Small Team") === mode ? "bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.2)]" : "bg-slate-900 border-slate-800 hover:border-slate-700"}`}
                        >
                          <div className="flex justify-between items-center relative z-10">
                            <div>
                              <div
                                className={`text-[11px] font-black uppercase ${(company.operatingMode ?? "Small Team") === mode ? "text-white" : "text-slate-300"}`}
                              >
                                {mode}
                              </div>
                              <div
                                className={`text-[8px] font-bold uppercase mt-1 ${(company.operatingMode ?? "Small Team") === mode ? "text-blue-100" : "text-slate-500"}`}
                              >
                                {mode === "Small Team" &&
                                  "Everyone helps: Dispatch can quote + convert"}
                                {mode === "Split Roles" &&
                                  "Sales quotes, Dispatch executes"}
                                {mode === "Enterprise" &&
                                  "Strict Pricing Desk + Approval thresholds"}
                              </div>
                            </div>
                            {(company.operatingMode ?? "Small Team") ===
                              mode && <Check className="w-4 h-4 text-white" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <Truck className="w-5 h-5 text-blue-500" /> Load Number
                  Settings
                </h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="cpPrefix"
                        className="text-[9px] text-slate-500 uppercase font-black px-1"
                      >
                        Prefix
                      </label>
                      <input
                        id="cpPrefix"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-black uppercase focus:border-blue-500 outline-none transition-all"
                        value={loadNumbering.prefix}
                        onChange={(e) =>
                          updateCompanyField((prev) => ({
                            ...prev,
                            loadNumberingConfig: {
                              ...safeLoadNumbering(prev),
                              prefix: e.target.value,
                            },
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="cpAutoSequence"
                        className="text-[9px] text-slate-500 uppercase font-black px-1"
                      >
                        Auto-Sequence
                      </label>
                      <input
                        id="cpAutoSequence"
                        type="number"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-black focus:border-blue-500 outline-none transition-all"
                        value={loadNumbering.nextSequence ?? 1}
                        onChange={(e) =>
                          updateCompanyField((prev) => ({
                            ...prev,
                            loadNumberingConfig: {
                              ...safeLoadNumbering(prev),
                              nextSequence: parseInt(e.target.value) || 1,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cpSeparator"
                      className="text-[9px] text-slate-500 uppercase font-black px-1"
                    >
                      Separator
                    </label>
                    <input
                      id="cpSeparator"
                      className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-black focus:border-blue-500 outline-none transition-all"
                      value={loadNumbering.separator ?? "-"}
                      onChange={(e) =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          loadNumberingConfig: {
                            ...safeLoadNumbering(prev),
                            separator: e.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50">
                    <div className="text-[9px] text-slate-500 uppercase font-black mb-2">
                      Preview
                    </div>
                    <div className="text-sm font-mono font-black text-blue-400">
                      {loadNumbering.prefix}
                      {loadNumbering.separator}
                      {String(loadNumbering.nextSequence ?? 1).padStart(5, "0")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabErrorBoundary>
        )}

        {/* ============================================================= */}
        {/* PERSONNEL (REGISTRY) TAB                                      */}
        {/* ============================================================= */}
        {activeTab === "registry" && (
          <TabErrorBoundary tabName="Personnel">
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                <div className="flex justify-between items-center mb-10">
                  <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <Users className="w-5 h-5 text-indigo-500" /> Team Members
                    <span className="text-[9px] font-bold text-slate-600 ml-2">
                      ({users.length}{" "}
                      {users.length === 1 ? "member" : "members"})
                    </span>
                  </h3>
                  <button className="bg-blue-600/10 text-blue-500 border border-blue-500/20 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all">
                    Export CSV
                  </button>
                </div>
                <div className="space-y-4">
                  {users.length === 0 ? (
                    <div className="text-center py-12 space-y-4">
                      <Users className="w-10 h-10 text-slate-700 mx-auto" />
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        No team members found
                      </p>
                      <p className="text-[9px] text-slate-700 font-bold">
                        Team members will appear here once added to your company
                      </p>
                    </div>
                  ) : (
                    users.map((u) => (
                      <div
                        key={u.id}
                        className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800/50 hover:bg-slate-900 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all">
                            {(u.name || "?").charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-black text-white uppercase">
                              {u.name || "Unnamed User"}
                            </div>
                            <div className="text-[9px] text-slate-500 font-bold uppercase">
                              {(u.role || "member").replace("_", " ")}{" "}
                              {u.email ? `\u2022 ${u.email}` : ""}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setEditingUser(u)}
                          className="p-2 text-slate-600 hover:text-white transition-all"
                          aria-label={`Edit ${u.name || "user"}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabErrorBoundary>
        )}

        {/* ============================================================= */}
        {/* GOVERNANCE (POLICY) TAB — defensive scoringConfig + governance */}
        {/* ============================================================= */}
        {activeTab === "policy" && (
          <TabErrorBoundary tabName="Governance">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
              <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <Scale className="w-5 h-5 text-blue-500" /> Safety Rules
                </h3>
                <div className="space-y-6">
                  <div className="flex justify-between items-center p-4 bg-slate-900 rounded-2xl border border-slate-800">
                    <div className="space-y-1">
                      <div className="text-[9px] font-black text-white uppercase tracking-tight">
                        Auto-Lock Compliance
                      </div>
                      <div className="text-[8px] text-slate-500 font-bold uppercase">
                        Restricts dispatch for non-compliant drivers
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          governance: {
                            ...safeGovernance(prev),
                            autoLockCompliance:
                              !safeGovernance(prev).autoLockCompliance,
                          },
                        }))
                      }
                      className={`w-12 h-6 rounded-full relative transition-all ${governance.autoLockCompliance ? "bg-blue-600" : "bg-slate-700"}`}
                      role="switch"
                      aria-checked={governance.autoLockCompliance}
                      aria-label="Toggle Auto-Lock Compliance"
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${governance.autoLockCompliance ? "left-7" : "left-1"}`}
                      />
                    </button>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-900 rounded-2xl border border-slate-800">
                    <div className="space-y-1">
                      <div className="text-[9px] font-black text-white uppercase tracking-tight">
                        Require Quiz Pass
                      </div>
                      <div className="text-[8px] text-slate-500 font-bold uppercase">
                        Drivers must pass safety quiz before dispatch
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          governance: {
                            ...safeGovernance(prev),
                            requireQuizPass:
                              !safeGovernance(prev).requireQuizPass,
                          },
                        }))
                      }
                      className={`w-12 h-6 rounded-full relative transition-all ${governance.requireQuizPass ? "bg-blue-600" : "bg-slate-700"}`}
                      role="switch"
                      aria-checked={governance.requireQuizPass}
                      aria-label="Toggle Require Quiz Pass"
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${governance.requireQuizPass ? "left-7" : "left-1"}`}
                      />
                    </button>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-900 rounded-2xl border border-slate-800">
                    <div className="space-y-1">
                      <div className="text-[9px] font-black text-white uppercase tracking-tight">
                        Require Maintenance Pass
                      </div>
                      <div className="text-[8px] text-slate-500 font-bold uppercase">
                        Vehicle must pass inspection before dispatch
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          governance: {
                            ...safeGovernance(prev),
                            requireMaintenancePass:
                              !safeGovernance(prev).requireMaintenancePass,
                          },
                        }))
                      }
                      className={`w-12 h-6 rounded-full relative transition-all ${governance.requireMaintenancePass ? "bg-blue-600" : "bg-slate-700"}`}
                      role="switch"
                      aria-checked={governance.requireMaintenancePass}
                      aria-label="Toggle Require Maintenance Pass"
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${governance.requireMaintenancePass ? "left-7" : "left-1"}`}
                      />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="cpMinSafetyScoreForDispatch"
                      className="text-[9px] text-slate-500 uppercase font-black px-1"
                    >
                      Min. Safety Score for Dispatch
                    </label>
                    <input
                      id="cpMinSafetyScoreForDispatch"
                      type="range"
                      min="0"
                      max="100"
                      className="w-full accent-blue-600"
                      value={scoring.minimumDispatchScore}
                      onChange={(e) =>
                        updateCompanyField((prev) => ({
                          ...prev,
                          scoringConfig: {
                            ...safeScoringConfig(prev),
                            minimumDispatchScore: parseInt(e.target.value),
                          },
                        }))
                      }
                    />
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase">
                        Block &lt; 75
                      </span>
                      <span className="text-[12px] font-black text-blue-500">
                        {scoring.minimumDispatchScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-8">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-green-500" /> Billing
                  Settings
                </h3>
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label
                        htmlFor="cpPreferredCurrency"
                        className="text-[9px] text-slate-500 uppercase font-black px-1"
                      >
                        Preferred Currency
                      </label>
                      <select
                        id="cpPreferredCurrency"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-black outline-none focus:border-blue-500 transition-all"
                        value={governance.preferredCurrency}
                        onChange={(e) =>
                          updateCompanyField((prev) => ({
                            ...prev,
                            governance: {
                              ...safeGovernance(prev),
                              preferredCurrency: e.target.value,
                            },
                          }))
                        }
                      >
                        <option value="USD">USD - US Dollar</option>
                        <option value="CAD">CAD - Canadian Dollar</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="cpMaxLoadsWeek"
                        className="text-[9px] text-slate-500 uppercase font-black px-1"
                      >
                        Max Loads/Week
                      </label>
                      <input
                        id="cpMaxLoadsWeek"
                        type="number"
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-white font-black focus:border-blue-500 outline-none transition-all"
                        value={governance.maxLoadsPerDriverPerWeek}
                        onChange={(e) =>
                          updateCompanyField((prev) => ({
                            ...prev,
                            governance: {
                              ...safeGovernance(prev),
                              maxLoadsPerDriverPerWeek:
                                parseInt(e.target.value) || 5,
                            },
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabErrorBoundary>
        )}

        {/* ============================================================= */}
        {/* SECURITY (PERMISSIONS) TAB — defensive permission access       */}
        {/* ============================================================= */}
        {activeTab === "permissions" && (
          <TabErrorBoundary tabName="Security">
            <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
              <div className="bg-slate-950 p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl">
                <h3 className="text-sm font-black text-white uppercase tracking-tight flex items-center gap-3 mb-10">
                  <Lock className="w-5 h-5 text-red-500" /> Role Permissions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
                      Driver Tier
                    </div>
                    {[
                      { id: "viewSettlements", label: "View Own Settlements" },
                      { id: "viewSafety", label: "Access Safety Training" },
                      { id: "showRates", label: "View Load Revenue" },
                    ].map((perm) => (
                      <div
                        key={perm.id}
                        className="flex justify-between items-center p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50"
                      >
                        <span className="text-[10px] font-black text-white uppercase tracking-tight">
                          {perm.label}
                        </span>
                        <button
                          onClick={() =>
                            updateCompanyField((prev) => ({
                              ...prev,
                              driverPermissions: {
                                ...safeDriverPerms(prev),
                                [perm.id]: !safeDriverPerms(prev)[perm.id],
                              } as RolePermissions,
                            }))
                          }
                          className={`w-10 h-5 rounded-full relative transition-all ${driverPerms[perm.id] ? "bg-blue-600" : "bg-slate-700"}`}
                          role="switch"
                          aria-checked={!!driverPerms[perm.id]}
                          aria-label={`Toggle ${perm.label}`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${driverPerms[perm.id] ? "left-5" : "left-0.5"}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-6">
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">
                      Dispatch Tier
                    </div>
                    {[
                      { id: "manageSafety", label: "Manage Fleet Safety" },
                      { id: "createLoads", label: "Authorized Load Creation" },
                      { id: "viewIntelligence", label: "Permission Settings" },
                    ].map((perm) => (
                      <div
                        key={perm.id}
                        className="flex justify-between items-center p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50"
                      >
                        <span className="text-[10px] font-black text-white uppercase tracking-tight">
                          {perm.label}
                        </span>
                        <button
                          onClick={() =>
                            updateCompanyField((prev) => ({
                              ...prev,
                              dispatcherPermissions: {
                                ...safeDispatcherPerms(prev),
                                [perm.id]: !safeDispatcherPerms(prev)[perm.id],
                              } as RolePermissions,
                            }))
                          }
                          className={`w-10 h-5 rounded-full relative transition-all ${dispatcherPerms[perm.id] ? "bg-blue-600" : "bg-slate-700"}`}
                          role="switch"
                          aria-checked={!!dispatcherPerms[perm.id]}
                          aria-label={`Toggle ${perm.label}`}
                        >
                          <div
                            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${dispatcherPerms[perm.id] ? "left-5" : "left-0.5"}`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabErrorBoundary>
        )}
      </div>

      {/* Clock Out Modal */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden scale-in">
            <div className="p-10 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-5">
                <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center">
                  <Square className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                    End Shift
                  </h2>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                    Saving shift notes
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowClockOutModal(false)}
                className="text-slate-500 hover:text-white transition-all active:scale-75"
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <label
                  htmlFor="cpTripDutyCompletionNotes"
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1"
                >
                  Trip / Duty Completion Notes
                </label>
                <textarea
                  id="cpTripDutyCompletionNotes"
                  className="w-full bg-slate-950 border border-slate-800 rounded-3xl p-6 text-white font-bold text-sm h-40 focus:border-red-500 outline-none shadow-inner placeholder:text-slate-800"
                  placeholder="Describe shifts, delays, or chassis observations..."
                  value={clockNotes}
                  onChange={(e) => setClockNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowClockOutModal(false)}
                  className="px-10 py-5 bg-slate-800 text-slate-400 rounded-[2rem] font-black uppercase tracking-widest text-[9px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClockOut}
                  className="flex-1 py-5 bg-red-600 hover:bg-red-500 text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[10px] shadow-2xl shadow-red-500/30"
                >
                  Confirm End Shift
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
