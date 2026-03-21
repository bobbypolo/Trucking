import React, { useState, useMemo } from "react";
import { useAutoFeedback } from "../hooks/useAutoFeedback";
import {
  LoadData,
  User,
  LoadStatus,
  Broker,
  DriverSettlement,
  SettlementLine,
} from "../types";
import {
  DollarSign,
  Wallet,
  Printer,
  FileText,
  Send,
  TrendingUp,
  UserPlus,
  Building2,
  X,
  AlertTriangle,
  CheckCircle,
  Search,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  Briefcase,
  AlertOctagon,
  Layers,
  Plus,
  Phone,
  Activity,
  Scissors,
} from "lucide-react";
import { generateInvoicePDF, settleLoad } from "../services/storageService";
import { addDriver, getCurrentUser } from "../services/authService";
import {
  createSettlement,
  uploadToVault,
  getSettlements,
  getBills,
} from "../services/financialService";
import { v4 as uuidv4 } from "uuid";

interface Props {
  loads: LoadData[];
  users: User[];
  onUserUpdate?: () => void;
  onNavigate?: (tab: string) => void;
  isDashboardMode?: boolean;
  onOpenHub?: (tab: "feed" | "messaging", startCall?: boolean) => void;
}

export const Settlements: React.FC<Props> = ({
  loads = [],
  users = [],
  onUserUpdate,
  onNavigate,
  onOpenHub,
  isDashboardMode,
}) => {
  const [activeTab, setActiveTab] = useState<"payroll" | "invoices" | "pnl">(
    isDashboardMode ? "payroll" : "payroll",
  );
  const [dateRange, setDateRange] = useState({
    start: "2025-12-01",
    end: "2025-12-31",
  });
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [feedback, showFeedback, clearFeedback] =
    useAutoFeedback<string | null>(null);
  const [settlements, setSettlements] = useState<DriverSettlement[]>([]);
  const [bills, setBills] = useState<any[]>([]);

  const currentUser = getCurrentUser();

  React.useEffect(() => {
    const loadAccountingData = async () => {
      const [sData, bData] = await Promise.all([getSettlements(), getBills()]);
      setSettlements(sData);
      setBills(bData);
    };
    loadAccountingData();
  }, [feedback]);

  const calculatePayData = (user: User) => {
    const userLoads = loads.filter(
      (l) =>
        l.driverId === user.id &&
        (l.status === "delivered" || l.financialStatus === "Invoiced"),
    );

    let earnings = 0;
    if (user.payModel === "salary") earnings = user.payRate || 0;
    else if (user.payModel === "percent") {
      earnings = userLoads.reduce(
        (sum, l) => sum + (l.carrierRate || 0) * ((user.payRate || 25) / 100),
        0,
      );
    } else if (user.payModel === "mileage") {
      earnings = userLoads.reduce(
        (sum, l) => sum + ((l as any).mileage || 0) * (user.payRate || 0.6),
        0,
      );
    } else {
      earnings = userLoads.reduce((sum, l) => sum + (l.driverPay || 0), 0);
    }

    // Deductions come from the API/service layer (settlements data); default empty
    const deductions: SettlementLine[] = [];

    const reimbursements = userLoads.reduce(
      (sum, l) => sum + (l.expenses?.reduce((s, e) => s + e.amount, 0) || 0),
      0,
    );
    const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
    const netPay = earnings + reimbursements - totalDeductions;

    return { earnings, deductions, reimbursements, netPay, userLoads };
  };

  const handleAuthorize = async (user: User) => {
    const data = calculatePayData(user);

    const settlement: Partial<DriverSettlement> = {
      id: uuidv4(),
      tenantId: currentUser?.companyId || "",
      driverId: user.id,
      settlementDate: new Date().toISOString(),
      periodStart: dateRange.start,
      periodEnd: dateRange.end,
      totalEarnings: data.earnings,
      totalDeductions: data.deductions.reduce((s, d) => s + d.amount, 0),
      totalReimbursements: data.reimbursements,
      netPay: data.netPay,
      status: "Paid",
      lines: [
        {
          id: uuidv4(),
          settlementId: "",
          type: "Earning",
          description: "Verified Load Pay",
          amount: data.earnings,
        },
        ...data.deductions.map((d) => ({
          ...d,
          id: uuidv4(),
          settlementId: "",
        })),
        {
          id: uuidv4(),
          settlementId: "",
          type: "Reimbursement",
          description: "Load Expenses",
          amount: data.reimbursements,
        },
      ] as SettlementLine[],
    };

    await createSettlement(settlement);
    await Promise.all(data.userLoads.map((l) => settleLoad(l.id)));

    showFeedback(`Settlement finalized for ${user.name}. Ledger updated.`);
    if (onUserUpdate) onUserUpdate();
  };

  const handleGenerateStatement = async (user: User) => {
    const data = calculatePayData(user);
    const docId = uuidv4();

    // Statement vault entry — URL is populated by real PDF generation in production.
    await uploadToVault({
      id: docId,
      tenantId: currentUser?.companyId || "",
      type: "Statement",
      filename: `Statement_${user.name.replace(" ", "_")}_${new Date().toISOString().split("T")[0]}.pdf`,
      url: "",
      driverId: user.id,
      status: "Locked",
      isLocked: true,
      createdBy: currentUser?.name || "System",
    });

    showFeedback(
      `Audit-Ready Statement generated and saved to Vault for ${user.name}`,
    );
  };

  const pnlStats = useMemo(() => {
    const totalRev = loads.reduce((sum, l) => sum + (l.carrierRate || 0), 0);
    const driverPay = users.reduce(
      (sum, u) => sum + calculatePayData(u).netPay,
      0,
    );
    const otherExpenses = loads.reduce(
      (sum, l) => sum + (l.expenses?.reduce((s, e) => s + e.amount, 0) || 0),
      0,
    );
    const totalExp = driverPay + otherExpenses;
    return {
      revenue: totalRev,
      expenses: totalExp,
      profit: totalRev - totalExp,
      driverPay,
      otherExpenses,
    };
  }, [loads, users]);

  const filteredPersonnel = useMemo(() => {
    if (!currentUser) return [];
    if (["admin", "payroll_manager", "dispatcher"].includes(currentUser.role)) {
      return users.filter((u) =>
        [
          "admin",
          "dispatcher",
          "safety_manager",
          "payroll_manager",
          "driver",
          "owner_operator",
        ].includes(u.role),
      );
    }
    return [currentUser];
  }, [currentUser, users]);

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100">
      {/* Financial Command Center Header */}
      <div className="bg-slate-900 border-b border-slate-800 shadow-sm px-8 pt-8 relative overflow-hidden shrink-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 mb-8">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-green-600/10 rounded-xl flex items-center justify-center border border-green-500/20">
              <Wallet className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Financial Command Center
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                Payroll Approval, Invoicing, and Profitability Analysis.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onUserUpdate?.()}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all shadow-lg"
              title="Force Financial Sync"
            >
              <Activity className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-2">
                Pay Period:
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value="12/01/2025"
                  readOnly
                  aria-label="Pay period start date"
                  className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1 text-sm font-mono text-white w-28 text-center"
                />
                <span className="text-slate-500">-</span>
                <input
                  type="text"
                  value="12/31/2025"
                  readOnly
                  aria-label="Pay period end date"
                  className="bg-slate-900 border border-slate-700 rounded-md px-3 py-1 text-sm font-mono text-white w-28 text-center"
                />
              </div>
            </div>
          </div>
        </div>

        <nav className="flex space-x-8">
          {[
            { id: "payroll", label: "Payroll Approval", icon: DollarSign },
            {
              id: "invoices",
              label: "Accounts Receivable (Invoicing)",
              icon: FileText,
            },
            { id: "pnl", label: "Profit & Loss", icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-4 text-sm font-semibold transition-all relative flex items-center gap-2 ${activeTab === tab.id ? "text-blue-500" : "text-slate-400 hover:text-slate-200"}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {feedback && (
        <div className="bg-blue-600 text-white px-8 py-3 flex justify-between items-center animate-in fade-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5" />
            <span className="text-sm font-bold">{feedback}</span>
          </div>
          <button onClick={clearFeedback}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar pb-24">
        {activeTab === "payroll" && (
          <div className="max-w-6xl mx-auto space-y-4">
            {users.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 bg-slate-900/50 rounded-[3rem] border border-slate-800 border-dashed text-center">
                <AlertOctagon className="w-16 h-16 text-slate-800 mb-6" />
                <h3 className="text-xl font-black text-slate-700 uppercase tracking-tighter">
                  System Data Syncing
                </h3>
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-2">
                  Waiting for company personnel registry to synchronize.
                </p>
              </div>
            )}
            {users.length > 0 && filteredPersonnel.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 bg-slate-900/50 rounded-[3rem] border border-slate-800 border-dashed text-center">
                <Users className="w-16 h-16 text-slate-800 mb-6" />
                <h3 className="text-xl font-black text-slate-700 uppercase tracking-tighter">
                  No eligible personnel found
                </h3>
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest mt-2 text-center max-w-xs">
                  Ensure your company users are assigned appropriate roles and
                  are part of your authorized fleet.
                </p>
              </div>
            )}
            {filteredPersonnel.map((u) => {
              const isExpanded = expandedUser === u.id;
              const {
                earnings,
                deductions,
                reimbursements,
                netPay,
                userLoads,
              } = calculatePayData(u);

              return (
                <div
                  key={u.id}
                  className={`bg-slate-900 rounded-2xl border ${isExpanded ? "border-blue-500/50 shadow-lg shadow-blue-500/5" : "border-slate-800"} transition-all overflow-hidden`}
                >
                  <div
                    onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                    className="p-6 cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-5">
                      <div
                        className={`w-12 h-12 rounded-full border-2 ${netPay > 0 ? "border-green-500 bg-green-900/10" : "border-slate-700 bg-slate-800"} flex items-center justify-center relative`}
                      >
                        {netPay > 0 ? (
                          <CheckCircle className="w-6 h-6 text-green-500" />
                        ) : (
                          <Users className="w-6 h-6 text-slate-500" />
                        )}
                        {netPay > 0 && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-slate-900">
                            <CheckCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                          {u.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {u.payModel && (
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                              {u.payModel}
                            </span>
                          )}
                          <span className="text-green-500 text-[10px] font-bold uppercase tracking-widest">
                            Ready for Payroll
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenHub?.("feed", true);
                            }}
                            className="w-8 h-8 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white transition-all border border-blue-500/20 flex items-center justify-center ml-2"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">
                          TOTAL PAYABLE
                        </div>
                        <div className="text-2xl font-bold text-white font-mono">
                          $
                          {netPay.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </div>
                      </div>
                      <button className="text-slate-500 hover:text-white transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="w-7 h-7" />
                        ) : (
                          <ChevronDown className="w-7 h-7" />
                        )}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-8 pb-8 space-y-8 animate-in slide-in-from-top-4 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {[
                          {
                            label: "Gross Earnings",
                            value: earnings,
                            color: "text-white",
                          },
                          {
                            label: "Reimbursements",
                            value: reimbursements,
                            color: "text-emerald-400",
                            bg: "bg-emerald-400/5",
                          },
                          {
                            label: "Total Deductions",
                            value: deductions.reduce((s, d) => s + d.amount, 0),
                            color: "text-red-400",
                            bg: "bg-red-400/5",
                          },
                          {
                            label: "NET PAYABLE",
                            value: netPay,
                            color: "text-blue-400",
                            bg: "bg-blue-400/5",
                          },
                        ].map((stat, i) => (
                          <div
                            key={i}
                            className={`p-6 rounded-xl border border-slate-800/50 ${stat.bg || "bg-slate-800/20"} flex flex-col items-center justify-center text-center space-y-2`}
                          >
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              {stat.label}
                            </div>
                            <div
                              className={`text-2xl font-bold font-mono ${stat.color}`}
                            >
                              $
                              {stat.value.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-slate-400 px-1">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                                Validated Loads
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold text-blue-500 bg-blue-500/5 px-2 py-0.5 rounded-md border border-blue-500/10 tracking-widest uppercase">
                              {userLoads.length} Records
                            </span>
                          </div>
                          <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="bg-slate-900/50 border-b border-slate-800">
                                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    Load #
                                  </th>
                                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">
                                    Pay
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {userLoads.map((l) => (
                                  <tr
                                    key={l.id}
                                    className="text-[11px] font-medium text-slate-300 hover:bg-slate-900/40 transition-colors"
                                  >
                                    <td className="px-6 py-4 font-bold text-white uppercase">
                                      {l.loadNumber}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-white">
                                      $
                                      {(l.driverPay || 0).toLocaleString(
                                        undefined,
                                        { minimumFractionDigits: 2 },
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {userLoads.length === 0 && (
                                  <tr>
                                    <td
                                      colSpan={2}
                                      className="px-6 py-12 text-center text-slate-500 text-[10px] uppercase font-bold italic bg-slate-900/50"
                                    >
                                      No activity.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between text-slate-400 px-1">
                            <div className="flex items-center gap-2">
                              <Scissors className="w-4 h-4" />
                              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em]">
                                Itemized Deductions
                              </h4>
                            </div>
                            <span className="text-[10px] font-bold text-red-500 bg-red-500/5 px-2 py-0.5 rounded-md border border-red-500/10 tracking-widest uppercase">
                              {deductions.length} Deductions
                            </span>
                          </div>
                          <div className="bg-slate-950/50 rounded-xl border border-slate-800 overflow-hidden">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="bg-slate-900/50 border-b border-slate-800">
                                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    Description
                                  </th>
                                  <th className="px-6 py-4 text-[9px] font-black text-slate-500 uppercase tracking-widest text-right">
                                    Amount
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/50">
                                {deductions.map((d) => (
                                  <tr
                                    key={d.id}
                                    className="text-[11px] font-medium text-slate-300 hover:bg-slate-900/40 transition-colors"
                                  >
                                    <td className="px-6 py-4 uppercase font-bold text-slate-400">
                                      {d.description}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono font-bold text-red-400">
                                      (${d.amount.toFixed(2)})
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-900/20 border-t border-slate-800">
                                  <td className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                    Total Offset
                                  </td>
                                  <td className="px-6 py-4 text-right font-mono font-bold text-red-500">
                                    -$
                                    {deductions
                                      .reduce((s, d) => s + d.amount, 0)
                                      .toLocaleString()}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-6">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleGenerateStatement(u);
                          }}
                          className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold flex items-center gap-2 border border-slate-700 transition-all active:scale-95"
                        >
                          <Printer className="w-4 h-4" /> Generate Statement
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAuthorize(u);
                          }}
                          className="bg-green-600 hover:bg-green-500 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-3 transition-all shadow-lg shadow-green-500/20 active:scale-95 border border-green-400/30"
                        >
                          <DollarSign className="w-5 h-5" /> Authorize & Pay $
                          {netPay.toLocaleString()}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">
                Accounts Receivable
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={() =>
                    showFeedback("Batch Print Command Sent to Spooler")
                  }
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-sm font-bold border border-slate-700 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" /> Batch Print
                </button>
                <button
                  onClick={() =>
                    showFeedback(
                      "Accounts Receivable Finalized & Ledger Updated",
                    )
                  }
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm"
                >
                  <Send className="w-4 h-4" /> Finalize All
                </button>
              </div>
            </div>

            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">
                      Load #
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">
                      Customer
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loads
                    .filter((l) => l.status === "delivered")
                    .map((load) => (
                      <tr
                        key={load.id}
                        className="hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="px-6 py-4 text-sm font-bold text-white">
                          {load.loadNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-400">
                          {load.pickup?.facilityName ?? ''}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-white">
                          ${(load.carrierRate || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold text-blue-400 bg-blue-900/20 px-2 py-1 rounded-full border border-blue-900/50 uppercase">
                            Pending Invoice
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={async () => await generateInvoicePDF(load)}
                            className="text-slate-500 hover:text-white"
                            title="Generate PDF"
                          >
                            <FileText className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {loads.filter((l) => l.status === "delivered").length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-12 text-center text-slate-500 bg-slate-900/50 italic text-sm"
                      >
                        No pending deliveries found for invoicing.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "pnl" && (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  label: "Gross Revenue",
                  value: `$${pnlStats.revenue.toLocaleString()}`,
                  color: "text-white",
                },
                {
                  label: "Operating Expenses",
                  value: `-$${pnlStats.expenses.toLocaleString()}`,
                  color: "text-red-400",
                },
                {
                  label: "Net Profit",
                  value: `$${pnlStats.profit.toLocaleString()}`,
                  color: "text-green-500",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-sm text-center"
                >
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                    {stat.label}
                  </div>
                  <div className={`text-3xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 shadow-sm">
              <h3 className="text-lg font-bold text-white mb-6">
                Financial breakdown
              </h3>
              <div className="space-y-6">
                {[
                  {
                    label: "Driver Settlements",
                    amount: `$${pnlStats.driverPay.toLocaleString()}`,
                    percent:
                      pnlStats.revenue > 0
                        ? (pnlStats.driverPay / pnlStats.revenue) * 100
                        : 0,
                  },
                  {
                    label: "Fuel & Other Expenses",
                    amount: `$${pnlStats.otherExpenses.toLocaleString()}`,
                    percent:
                      pnlStats.revenue > 0
                        ? (pnlStats.otherExpenses / pnlStats.revenue) * 100
                        : 0,
                  },
                ].map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400 font-medium">
                        {item.label}
                      </span>
                      <span className="text-white font-bold">
                        {item.amount}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.min(100, item.percent)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
