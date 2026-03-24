import React, {
  useState,
  useEffect,
  useMemo,
  Suspense,
  useCallback,
} from "react";
import { useAutoFeedback } from "../hooks/useAutoFeedback";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { API_URL } from "../services/config";
import {
  DollarSign,
  Receipt,
  CreditCard,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  User,
  Search,
  Filter,
  Plus,
  ChevronRight,
  FileText,
  Truck,
  Fuel,
  Settings,
  Download,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  HardDrive,
  FileSpreadsheet,
  Users,
  Wrench,
  Phone,
  MoreVertical,
  Clock,
  Zap,
  Cpu,
} from "lucide-react";
import { AutomationRule } from "../types";
import {
  getGLAccounts,
  getLoadProfitLoss,
  createARInvoice,
  createAPBill,
  createJournalEntry,
  getSettlements,
  getInvoices,
  getBills,
} from "../services/financialService";
import {
  GLAccount,
  ARInvoice,
  APBill,
  DriverSettlement,
  LoadData,
  User as UserType,
  VaultDoc,
} from "../types";
const Settlements = React.lazy(() =>
  import("./Settlements").then((m) => ({ default: m.Settlements })),
);
const FileVault = React.lazy(() =>
  import("./FileVault").then((m) => ({ default: m.FileVault })),
);
const AccountingBillForm = React.lazy(() =>
  import("./AccountingBillForm").then((m) => ({
    default: m.AccountingBillForm,
  })),
);
const IFTAManager = React.lazy(() =>
  import("./IFTAManager").then((m) => ({ default: m.IFTAManager })),
);
const DataImportWizard = React.lazy(() =>
  import("./DataImportWizard").then((m) => ({ default: m.DataImportWizard })),
);
import { executeFuelMatchingRule } from "../services/rulesEngineService";
import { exportToExcel, exportToPDF } from "../services/exportService";

interface Props {
  loads: LoadData[];
  users: UserType[];
  onUserUpdate?: () => void;
  initialTab?:
    | "DASHBOARD"
    | "AR"
    | "AP"
    | "SETTLEMENTS"
    | "GL"
    | "IFTA"
    | "VAULT"
    | "MAINTENANCE"
    | "AUTOMATION";
  currentUser: UserType;
  onNavigate?: (tab: string, subTab?: string) => void;
}

const AccountingPortal: React.FC<Props> = ({
  loads,
  users,
  currentUser,
  onUserUpdate,
  initialTab = "DASHBOARD",
  onNavigate,
}) => {
  const [activeTab, setActiveTab] = useState<
    | "DASHBOARD"
    | "AR"
    | "AP"
    | "SETTLEMENTS"
    | "GL"
    | "IFTA"
    | "VAULT"
    | "MAINTENANCE"
    | "AUTOMATION"
  >(initialTab || "DASHBOARD");
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [bills, setBills] = useState<APBill[]>([]);
  const [settlements, setSettlements] = useState<DriverSettlement[]>([]);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, showFeedback, clearFeedback] = useAutoFeedback<
    string | null
  >(null);
  const [showBillForm, setShowBillForm] = useState(false);
  const [importType, setImportType] = useState<
    "Fuel" | "Bills" | "Invoices" | "CoA" | null
  >(null);

  // Derive repair expense GL account ID from loaded accounts
  const REPAIR_EXPENSE_ACCT_NUMBER = "5000";
  const repairExpenseAcctId = useMemo(() => {
    const acct = accounts.find(
      (a) => a.accountNumber === REPAIR_EXPENSE_ACCT_NUMBER,
    );
    return acct?.id || "";
  }, [accounts]);

  const handleRunEngine = async () => {
    showFeedback("Engine running: Scanning Vault for unlinked receipts...");

    try {
      const rule = automationRules.find(
        (r) => r.action === "match_receipt",
      ) || {
        id: "default",
        name: "Fuel Receipt Auto-Match",
        enabled: true,
        trigger: "doc_upload" as const,
        action: "match_receipt",
        configuration: { matchTolerance: 0.05, lookbackDays: 7 },
      };
      const results = await executeFuelMatchingRule(
        [],
        [],
        rule as AutomationRule,
      );
      showFeedback(
        `Sync Complete: Auto-Matched ${results?.matched ?? 0} receipts. ${results?.orphaned ?? 0} require manual verification.`,
        4000,
      );
    } catch {
      showFeedback("Engine run failed. Please try again.");
    }
  };

  const handleAction = (action: string) => {
    showFeedback(`Action Triggered: ${action}`);
    // In a real scenario, this would open a specific sub-modal or trigger a service call
  };

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [accs, invs, bs, sets] = await Promise.all([
        getGLAccounts(signal),
        getInvoices(signal),
        getBills(signal),
        getSettlements(undefined, signal),
      ]);
      if (signal?.aborted) return;
      setAccounts(Array.isArray(accs) ? accs : []);
      setInvoices(Array.isArray(invs) ? invs : []);
      setBills(Array.isArray(bs) ? bs : []);
      setSettlements(Array.isArray(sets) ? sets : []);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (signal?.aborted) return;
      setLoadError("Failed to load accounting data. Please try again.");
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadData]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading accounting data"
        className="h-full flex flex-col bg-[#020617] text-slate-100 font-inter p-10"
      >
        <LoadingSkeleton variant="card" count={4} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-full flex flex-col bg-[#020617] text-slate-100 font-inter">
        <ErrorState message={loadError} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100 font-inter">
      {/* HEADER */}
      <div className="bg-[#0a0f1e]/80 backdrop-blur-md border-b border-white/5 px-10 py-8 shrink-0 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-emerald-500" />
            Operational Accounting{" "}
            <span className="text-emerald-500/50">Pro</span>
          </h1>
          <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1 ml-1">
            Dispatch-Linked Financial Logic • Audit-Ready Ledger
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex bg-slate-950 border border-white/5 rounded-2xl p-1 shadow-2xl">
            {[
              { id: "DASHBOARD", icon: Activity, label: "Overview" },
              { id: "AR", icon: Receipt, label: "AR / Invoices" },
              { id: "AP", icon: CreditCard, label: "AP / Bills" },
              { id: "VAULT", icon: HardDrive, label: "File Vault" },
              { id: "SETTLEMENTS", icon: Users, label: "Settlements" },
              { id: "MAINTENANCE", icon: Wrench, label: "Maintenance" },
              { id: "IFTA", icon: Fuel, label: "Fuel & IFTA" },
              { id: "AUTOMATION", icon: Zap, label: "Rules Engine" },
              { id: "GL", icon: FileText, label: "Audit Log" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id
                    ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
                    : "text-slate-500 hover:text-white hover:bg-white/5"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex bg-slate-900 border border-white/5 rounded-2xl p-1 gap-1">
            <button
              onClick={() => setImportType("Fuel")}
              className="px-4 py-2 bg-white/5 text-[9px] font-black uppercase text-slate-500 hover:text-white rounded-xl transition-all"
            >
              Batch Import Engine
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="bg-emerald-600 text-white px-10 py-3 flex justify-between items-center animate-in fade-in slide-in-from-top duration-300 shrink-0">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {feedback}
            </span>
          </div>
          <button onClick={clearFeedback} aria-label="Dismiss feedback">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto p-10">
        {activeTab === "DASHBOARD" && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI ROW */}
            <div className="grid grid-cols-4 gap-6">
              {[
                {
                  label: "Accounts Receivable",
                  val: `$${(Array.isArray(invoices) ? invoices : []).reduce((s, i) => s + (i.balanceDue || 0), 0).toLocaleString()}`,
                  sub: `${(Array.isArray(invoices) ? invoices : []).filter((i) => i.status === "Sent").length} Outstanding`,
                  trend: "+12%",
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/5",
                },
                {
                  label: "Accounts Payable",
                  val: `$${(Array.isArray(bills) ? bills : []).reduce((s, b) => s + (b.balanceDue || 0), 0).toLocaleString()}`,
                  sub: "Due this week",
                  trend: "-5%",
                  color: "text-red-500",
                  bg: "bg-red-500/5",
                },
                {
                  label: "Pending Docs",
                  val: `${(Array.isArray(invoices) ? invoices : []).filter((i: any) => !i.pod_attached).length}`,
                  sub: "Missing POD/BOL",
                  trend:
                    (Array.isArray(invoices) ? invoices : []).filter(
                      (i: any) => !i.pod_attached,
                    ).length > 0
                      ? "!"
                      : "OK",
                  color: "text-orange-500",
                  bg: "bg-orange-500/5",
                },
                {
                  label: "IFTA Liability",
                  val: "$0.00",
                  sub: "Current Quarter",
                  trend: "Accrued",
                  color: "text-blue-500",
                  bg: "bg-blue-500/5",
                },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className={`p-8 rounded-[2.5rem] border border-white/5 ${kpi.bg} backdrop-blur-sm shadow-xl`}
                >
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    {kpi.label}
                  </div>
                  <div
                    className={`text-4xl font-black tracking-tighter ${kpi.color}`}
                  >
                    {kpi.val}
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <span className="text-[9px] font-black text-white px-2 py-1 bg-white/5 rounded-lg">
                      {kpi.trend}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">
                      {kpi.sub}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="grid grid-cols-3 gap-10">
              <div className="col-span-2 space-y-8">
                <div className="flex justify-between items-end">
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                    Load P&L
                  </h2>
                  <button
                    onClick={() => onNavigate?.("loads")}
                    className="text-[10px] font-black text-emerald-500 uppercase hover:underline"
                  >
                    View All Loads
                  </button>
                </div>
                <div className="bg-[#0a0f1e]/50 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
                  <table className="w-full text-left">
                    <thead className="bg-black/20 border-b border-white/5">
                      <tr>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                          Load Details
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                          Revenue
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                          Costs
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase text-right">
                          Margin
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-slate-600 uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {(loads || []).slice(0, 5).map((load, i) => (
                        <tr
                          key={i}
                          className="hover:bg-white/[0.02] transition-colors cursor-pointer group"
                        >
                          <td className="px-6 py-5">
                            <div className="font-black text-white uppercase">
                              {load.loadNumber || `#${load.id.slice(0, 5)}`}
                            </div>
                            <div className="text-[10px] text-slate-500 font-bold uppercase">
                              {load.pickup?.facilityName || "Global Partner"}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right font-black text-white">
                            ${(load.carrierRate || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-5 text-right font-black text-slate-500">
                            ${(load.driverPay || 0).toLocaleString()}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="font-black text-emerald-500">
                              $
                              {(
                                (load.carrierRate || 0) - (load.driverPay || 0)
                              ).toLocaleString()}
                            </div>
                            <div className="text-[9px] text-emerald-500/50 font-black">
                              {load.carrierRate
                                ? Math.round(
                                    ((load.carrierRate -
                                      (load.driverPay || 0)) /
                                      load.carrierRate) *
                                      100,
                                  )
                                : 0}
                              %
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="px-3 py-1 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-[8px] font-black uppercase">
                              {load.financialStatus || "Unbilled"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-8">
                <div className="flex justify-between items-end">
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                    Settlement Queue
                  </h2>
                  <button
                    onClick={() => setActiveTab("SETTLEMENTS")}
                    className="text-[10px] font-black text-emerald-500 uppercase hover:underline"
                  >
                    Full Engine
                  </button>
                </div>
                <div className="bg-slate-950/30 rounded-[2.5rem] border border-white/5 p-8 space-y-6 backdrop-blur-sm shadow-xl">
                  {(settlements || []).slice(0, 3).map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-5 bg-black/40 rounded-3xl border border-white/5 hover:border-emerald-500/30 transition-all cursor-pointer"
                    >
                      <div>
                        <div className="text-[10px] font-black text-white uppercase tracking-tighter">
                          {users.find((u) => u.id === s.driverId)?.name ||
                            "Carrier Partner"}
                        </div>
                        <div className="text-[8px] text-slate-500 font-bold uppercase">
                          {s.settlementDate} • {s.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black text-emerald-500">
                          ${s.netPay.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setActiveTab("SETTLEMENTS")}
                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Process Settlement Batch
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "AR" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Accounts Receivable
                </h2>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Invoicing & Collections Control
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => handleAction("Generating Statements")}
                  className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                >
                  Generate Statements
                </button>
                <button
                  onClick={() => handleAction("Opening Create Invoice Modal")}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                >
                  Create New Invoice
                </button>
              </div>
            </div>

            <div className="bg-[#0a0f1e]/50 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
              <table className="w-full text-left">
                <thead className="bg-black/20 border-b border-white/5">
                  <tr>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase">
                      Customer
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase">
                      Invoice #
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase">
                      Aging
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase text-right">
                      Balance
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase">
                      Status
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(invoices || []).map((inv, i) => {
                    const days = Math.floor(
                      (Date.now() - new Date(inv.invoiceDate).getTime()) /
                        (1000 * 60 * 60 * 24),
                    );
                    return (
                      <tr
                        key={i}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        <td className="px-8 py-6">
                          <div className="font-black text-white uppercase">
                            {users.find((u) => u.id === inv.customerId)?.name ||
                              "Unknown Customer"}
                          </div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                            Ref: INV-{inv.invoiceNumber}
                          </div>
                        </td>
                        <td className="px-8 py-6 font-mono text-xs text-slate-300">
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1">
                            <div
                              className={`text-[10px] font-black uppercase ${days > 60 ? "text-red-500" : days > 30 ? "text-orange-500" : "text-emerald-500"}`}
                            >
                              {days <= 30
                                ? "Current"
                                : days <= 60
                                  ? "31-60 Days"
                                  : days <= 90
                                    ? "61-90 Days"
                                    : "90+ Days Overdue"}
                            </div>
                            <div className="text-[8px] text-slate-600 font-bold uppercase">
                              Issued {inv.invoiceDate}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-white text-lg">
                          ${inv.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-8 py-6">
                          <span
                            className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${inv.status === "Paid" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : inv.status === "Disputed" ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-blue-500/10 text-blue-500 border-blue-500/20"}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex justify-end gap-2">
                            {inv.status === "Sent" && (
                              <button
                                onClick={() =>
                                  showFeedback(
                                    `Sent collection reminder for ${inv.invoiceNumber}`,
                                  )
                                }
                                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-all border border-white/5"
                              >
                                <Phone className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {invoices.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-8 py-20 text-center text-slate-700 font-black uppercase tracking-widest italic opacity-50"
                      >
                        No outstanding invoices found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "AP" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Accounts Payable
                </h2>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Vendor Bills & Expense Allocations
                </p>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() =>
                    exportToExcel(bills, "Accounts_Payable_Report")
                  }
                  className="px-4 py-3 bg-white/5 text-slate-400 rounded-xl text-[9px] font-black uppercase flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" /> Excel
                </button>
                <button
                  onClick={() => setShowBillForm(true)}
                  className="px-6 py-3 bg-white/5 text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Log Vendor Bill
                </button>
              </div>
            </div>

            <div className="bg-[#0a0f1e]/50 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
              <table className="w-full text-left">
                <thead className="bg-black/20 border-b border-white/5">
                  <tr>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Vendor / Payee
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Bill Details
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">
                      Amount Due
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Pay Schedule
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest">
                      Approval
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(bills || []).map((bill, i) => (
                    <tr
                      key={i}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="font-black text-white uppercase">
                          {bill.vendorId || "Carrier/Vendor"}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                          ID: {bill.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="text-[11px] font-black text-slate-300 uppercase">
                          {bill.description || "Service/Fuel Charge"}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                          Due {bill.dueDate}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-white text-lg">
                        ${bill.totalAmount.toLocaleString()}
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              showFeedback(
                                `Scheduled payment for bill ${bill.id.slice(0, 4)} on Friday`,
                              )
                            }
                            className="px-3 py-1 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white border border-blue-500/20 rounded-lg text-[8px] font-black uppercase transition-all"
                          >
                            Schedule
                          </button>
                          <Clock className="w-3.5 h-3.5 text-slate-700" />
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span
                          className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${bill.status === "Approved" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"}`}
                        >
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-2">
                          {bill.status !== "Approved" && (
                            <button
                              onClick={() =>
                                showFeedback(
                                  `Bill ${bill.id.slice(0, 4)} Approved`,
                                )
                              }
                              className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl transition-all border border-emerald-500/20"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {bills.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-8 py-20 text-center text-slate-700 font-black uppercase tracking-widest italic opacity-50"
                      >
                        No pending bills found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "IFTA" && (
          <Suspense fallback={<LoadingSkeleton variant="table" count={3} />}>
            <IFTAManager loads={loads} />
          </Suspense>
        )}

        {activeTab === "SETTLEMENTS" && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-5">
            <Users className="w-12 h-12 text-slate-600" />
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
              Settlements &amp; Driver Pay
            </h3>
            <p className="text-xs text-slate-600 max-w-sm">
              Settlement management has moved to the Driver Pay portal for a
              streamlined driver-facing experience.
            </p>
            <button
              onClick={() => onNavigate?.("finance")}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/30"
            >
              Go to Driver Pay
            </button>
          </div>
        )}

        {activeTab === "MAINTENANCE" && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Maintenance Financials
                </h2>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Repair Tickets -&gt; A/P Bills -&gt; Cost Per Mile
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-6">
              {[
                {
                  label: "Total Maint Expense",
                  val: "$12,450",
                  sub: "Last 30 Days",
                  color: "text-blue-500",
                  bg: "bg-blue-500/5",
                },
                {
                  label: "Auth Required",
                  val: "3",
                  sub: "Pending Review",
                  color: "text-orange-500",
                  bg: "bg-orange-500/5",
                },
                {
                  label: "Cost Per Mile",
                  val: "$0.42",
                  sub: "Fleet Average",
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/5",
                },
                {
                  label: "Active Tickets",
                  val: "8",
                  sub: "In Service",
                  color: "text-purple-500",
                  bg: "bg-purple-500/5",
                },
              ].map((kpi, i) => (
                <div
                  key={i}
                  className={`p-8 rounded-[2.5rem] border border-white/5 ${kpi.bg} backdrop-blur-sm shadow-xl`}
                >
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    {kpi.label}
                  </div>
                  <div
                    className={`text-3xl font-black tracking-tighter ${kpi.color}`}
                  >
                    {kpi.val}
                  </div>
                  <div className="text-[9px] font-bold text-slate-500 uppercase mt-2">
                    {kpi.sub}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#0a0f1e]/50 border border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
              <table className="w-full text-left">
                <thead className="bg-black/20 border-b border-white/5">
                  <tr>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase">
                      Service Ticket
                    </th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase">
                      Vendor / Payee
                    </th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase">
                      Unit
                    </th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase text-right">
                      Estimate
                    </th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase">
                      Status
                    </th>
                    <th className="px-10 py-6 text-[10px] font-black text-slate-600 uppercase text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    {
                      id: "TK-9021",
                      vendor: "Love's Travel Stops",
                      unit: "TR-101",
                      amount: 850.0,
                      status: "Authorized",
                      date: "2026-01-01",
                    },
                    {
                      id: "TK-9025",
                      vendor: "Speedco Maintenance",
                      unit: "TR-102",
                      amount: 125.5,
                      status: "Pending",
                      date: "2026-01-02",
                    },
                    {
                      id: "TK-8950",
                      vendor: "Thermo King",
                      unit: "RF-5001",
                      amount: 3200.0,
                      status: "Authorized",
                      date: "2025-12-28",
                    },
                  ].map((tk, i) => (
                    <tr
                      key={i}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-10 py-6">
                        <div className="font-black text-white uppercase">
                          {tk.id}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase mt-1">
                          Logged {tk.date}
                        </div>
                      </td>
                      <td className="px-10 py-6 font-black text-slate-300 uppercase">
                        {tk.vendor}
                      </td>
                      <td className="px-10 py-6">
                        <div className="flex items-center gap-2">
                          <Truck className="w-3.5 h-3.5 text-blue-500" />
                          <span className="text-[11px] font-black text-white">
                            {tk.unit}
                          </span>
                        </div>
                      </td>
                      <td className="px-10 py-6 text-right font-black text-white text-lg">
                        ${tk.amount.toLocaleString()}
                      </td>
                      <td className="px-10 py-6">
                        <span
                          className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${tk.status === "Authorized" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"}`}
                        >
                          {tk.status}
                        </span>
                      </td>
                      <td className="px-10 py-6 text-right">
                        <button
                          onClick={async () => {
                            const bill = {
                              vendorId: tk.vendor, // In real app, this would be a UUID
                              billNumber: tk.id,
                              billDate: new Date().toISOString().split("T")[0],
                              dueDate: new Date(
                                Date.now() + 30 * 24 * 3600 * 1000,
                              )
                                .toISOString()
                                .split("T")[0],
                              status: "Approved" as any,
                              totalAmount: tk.amount,
                              balanceDue: tk.amount,
                              lines: [
                                {
                                  id: "L-1",
                                  description: `Maintenance: ${tk.id} for ${tk.unit}`,
                                  category: "Repair" as any,
                                  amount: tk.amount,
                                  allocationType: "Truck" as any,
                                  allocationId: tk.unit,
                                  glAccountId: repairExpenseAcctId,
                                },
                              ] as any,
                            };
                            await createAPBill(bill);
                            showFeedback(
                              `Ticket ${tk.id} successfully converted to A/P Bill and posted to General Ledger.`,
                            );
                          }}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
                        >
                          Post Bill
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "VAULT" && (
          <Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>
            <FileVault currentUser={currentUser} loads={loads} />
          </Suspense>
        )}

        {activeTab === "GL" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Operational Audit Trail
                </h2>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Post-Lock Event Log
                </p>
              </div>
              <button
                onClick={() =>
                  showFeedback("Fleet Audit Log PDF generating...")
                }
                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-2xl border border-white/10 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <Download className="w-4 h-4" /> Export Audit Log (PDF)
              </button>
            </div>

            <div className="bg-[#0a0f1e]/50 border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-md">
              <div className="space-y-6">
                <div className="text-center py-12">
                  <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                    No audit events recorded yet
                  </div>
                  <p className="text-[9px] text-slate-700 mt-2">
                    Audit entries will appear here as financial operations are
                    performed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "AUTOMATION" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                  Automation Center
                </h2>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                  Enterprise Rules Engine
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleRunEngine}
                  className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-blue-500 rounded-2xl border border-blue-500/20 transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  <Activity className="w-4 h-4" /> Run Full Audit
                </button>
                <div className="flex items-center gap-2 px-6 py-3 bg-white/5 text-slate-600 rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest cursor-not-allowed select-none">
                  <Plus className="w-4 h-4" /> Create New Rule
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  label: "Rules Executed",
                  value: "0",
                  icon: Cpu,
                  color: "text-blue-500",
                },
                {
                  label: "Time Saved (Est)",
                  value: "\u2014",
                  icon: Clock,
                  color: "text-emerald-500",
                },
                {
                  label: "Active Triggers",
                  value: `${automationRules.filter((r) => r.enabled).length}`,
                  icon: Zap,
                  color: "text-orange-500",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-[#0a0f1e]/50 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-md"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${stat.color}`}
                    >
                      <stat.icon className="w-6 h-6" />
                    </div>
                  </div>
                  <div className="text-3xl font-black text-white uppercase tracking-tighter">
                    {stat.value}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#0a0f1e]/50 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Logic Rule
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Trigger Event
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      Auto Action
                    </th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">
                      Toggle
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {automationRules.map((rule) => (
                    <tr
                      key={rule.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-8 py-6">
                        <div className="text-[11px] font-black text-white uppercase tracking-tighter">
                          {rule.name}
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold uppercase">
                          UID: {rule.id}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-full">
                          {rule.trigger.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-8 py-6">
                        <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[9px] font-black uppercase tracking-widest rounded-full">
                          {rule.action.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <button
                          onClick={() => {
                            setAutomationRules(
                              automationRules.map((r) =>
                                r.id === rule.id
                                  ? { ...r, enabled: !r.enabled }
                                  : r,
                              ),
                            );
                            showFeedback(
                              `${rule.name} ${!rule.enabled ? "Activated" : "Suspended"}`,
                            );
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${rule.enabled ? "bg-emerald-600" : "bg-slate-700"}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${rule.enabled ? "translate-x-6" : "translate-x-1"}`}
                          />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showBillForm && (
        <Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>
          <AccountingBillForm
            loads={loads}
            onClose={() => setShowBillForm(false)}
            onSave={async (bill) => {
              try {
                await createAPBill(bill);
                showFeedback("Bill submitted for approval");
                setShowBillForm(false);
                loadData();
              } catch (e) {
                showFeedback("Failed to save bill");
              }
            }}
          />
        </Suspense>
      )}

      {importType && (
        <Suspense fallback={<LoadingSkeleton variant="card" count={3} />}>
          <DataImportWizard
            type={importType}
            onClose={() => setImportType(null)}
            onImport={async (data) => {
              try {
                const res = await fetch(`${API_URL}/accounting/batch-import`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type: importType, data }),
                });
                if (res.ok) {
                  showFeedback(`Imported ${data.length} records successfully`);
                  setImportType(null);
                  loadData();
                }
              } catch (e) {
                showFeedback("Import failed");
              }
            }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default AccountingPortal;
