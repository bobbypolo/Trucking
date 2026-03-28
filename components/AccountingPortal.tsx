import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useAutoFeedback } from "../hooks/useAutoFeedback";
import { LoadingSkeleton } from "./ui/LoadingSkeleton";
import { ErrorState } from "./ui/ErrorState";
import { API_URL } from "../services/config";
import {
  DollarSign,
  Receipt,
  CreditCard,
  Activity,
  Plus,
  FileText,
  Fuel,
  CheckCircle,
  X,
  HardDrive,
  FileSpreadsheet,
  Phone,
  Clock,
} from "lucide-react";
import {
  getGLAccounts,
  getLoadProfitLoss,
  createARInvoice,
  createAPBill,
  createJournalEntry,
  getInvoices,
  getBills,
} from "../services/financialService";
import {
  GLAccount,
  ARInvoice,
  APBill,
  LoadData,
  User as UserType,
} from "../types";
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
import { exportToExcel, exportToPDF } from "../services/exportService";

interface Props {
  loads: LoadData[];
  users: UserType[];
  onUserUpdate?: () => void;
  initialTab?: "DASHBOARD" | "AR" | "AP" | "GL" | "IFTA" | "VAULT";
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
    "DASHBOARD" | "AR" | "AP" | "GL" | "IFTA" | "VAULT"
  >(initialTab || "DASHBOARD");
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [bills, setBills] = useState<APBill[]>([]);
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

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [accs, invs, bs] = await Promise.all([
        getGLAccounts(signal),
        getInvoices(signal),
        getBills(signal),
      ]);
      if (signal?.aborted) return;
      setAccounts(Array.isArray(accs) ? accs : []);
      setInvoices(Array.isArray(invs) ? invs : []);
      setBills(Array.isArray(bs) ? bs : []);
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
              { id: "IFTA", icon: Fuel, label: "Fuel & IFTA" },
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
                  trend: null as string | null,
                  color: "text-emerald-500",
                  bg: "bg-emerald-500/5",
                },
                {
                  label: "Accounts Payable",
                  val: `$${(Array.isArray(bills) ? bills : []).reduce((s, b) => s + (b.balanceDue || 0), 0).toLocaleString()}`,
                  sub: "Due this week",
                  trend: null as string | null,
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
                    {kpi.trend !== null && (
                      <span className="text-[9px] font-black text-white px-2 py-1 bg-white/5 rounded-lg">
                        {kpi.trend}
                      </span>
                    )}
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
                    Quick Actions
                  </h2>
                </div>
                <div className="bg-slate-950/30 rounded-[2.5rem] border border-white/5 p-8 space-y-6 backdrop-blur-sm shadow-xl">
                  <button
                    onClick={() => setActiveTab("AR")}
                    className="w-full py-5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20"
                  >
                    Manage Invoices
                  </button>
                  <button
                    onClick={() => setShowBillForm(true)}
                    className="w-full py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                  >
                    Create New Bill
                  </button>
                  <button
                    onClick={() => setActiveTab("IFTA")}
                    className="w-full py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                  >
                    Fuel & IFTA Compliance
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
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-[9px] text-slate-500 font-bold uppercase">
                            Due {bill.dueDate}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <span
                          className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase border ${bill.status === "Approved" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"}`}
                        >
                          {bill.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {bills.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
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
