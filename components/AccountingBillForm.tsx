import React, { useState } from "react";
import {
  Plus,
  Trash2,
  DollarSign,
  Briefcase,
  Truck,
  User,
  Package,
  Calculator,
  CheckCircle,
  X,
  Save,
  FilePlus,
  ChevronRight,
} from "lucide-react";
import { Toast } from "./Toast";
import {
  APBill,
  APBillLine,
  BillLineCategory,
  LineAllocationType,
  Vendor,
  LoadData,
  User as UserType,
} from "../types";

interface Props {
  loads: LoadData[];
  onSave: (bill: Partial<APBill>) => void;
  onClose: () => void;
}

export const AccountingBillForm: React.FC<Props> = ({
  loads,
  onSave,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);
  const [bill, setBill] = useState<Partial<APBill>>({
    billNumber: "",
    billDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000)
      .toISOString()
      .split("T")[0],
    vendorId: "",
    totalAmount: 0,
    status: "Draft",
    lines: [
      {
        id: Math.random().toString(36).substr(2, 9),
        description: "",
        category: "Labor",
        amount: 0,
        allocationType: "Overhead",
        allocationId: "SYSTEM",
        glAccountId: "GL-6000",
        billId: "pending",
      },
    ],
  });

  const addLine = () => {
    const newLine: APBillLine = {
      id: Math.random().toString(36).substr(2, 9),
      billId: "pending",
      description: "",
      category: "Other",
      amount: 0,
      allocationType: "Overhead",
      allocationId: "SYSTEM",
      glAccountId: "GL-6000",
    };
    setBill({ ...bill, lines: [...(bill.lines || []), newLine] });
  };

  const removeLine = (id: string) => {
    const updatedLines = (bill.lines || []).filter((l) => l.id !== id);
    setBill({ ...bill, lines: updatedLines });
    updateTotal(updatedLines);
  };

  const updateLine = (id: string, field: keyof APBillLine, value: any) => {
    const updatedLines = (bill.lines || []).map((l) =>
      l.id === id ? { ...l, [field]: value } : l,
    );
    setBill({ ...bill, lines: updatedLines });
    if (field === "amount") {
      updateTotal(updatedLines);
    }
  };

  const updateTotal = (lines: APBillLine[]) => {
    const total = lines.reduce(
      (sum, line) => sum + (Number(line.amount) || 0),
      0,
    );
    setBill({ ...bill, totalAmount: total });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSave(bill));
      setToast({ message: "Bill submitted for approval.", type: "success" });
    } catch (err) {
      console.error("[AccountingBillForm] Submit failed:", err);
      setToast({
        message: "Failed to submit bill. Please try again.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAllocationIcon = (type: LineAllocationType) => {
    switch (type) {
      case "Load":
        return <Package className="w-3.5 h-3.5" />;
      case "Truck":
      case "Trailer":
        return <Truck className="w-3.5 h-3.5" />;
      case "Driver":
        return <User className="w-3.5 h-3.5" />;
      case "Overhead":
        return <Briefcase className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[100] flex items-center justify-center p-10 overflow-auto">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      <div className="bg-[#020617] border border-white/10 w-full max-w-5xl rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* HEADER */}
        <div className="p-10 border-b border-white/5 bg-slate-900/20 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-4">
              <FilePlus className="w-8 h-8 text-emerald-500" />
              Log Vendor Bill
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1 ml-1">
              Itemized breakdown • multi-ledger allocation • approval routing
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-4 bg-white/5 hover:bg-white/10 rounded-3xl transition-all"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-10 space-y-10">
          {/* TOP INFO */}
          <div className="grid grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Bill Reference #
              </label>
              <input
                type="text"
                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-[11px] font-black uppercase text-white outline-none focus:border-emerald-500/50"
                value={bill.billNumber}
                onChange={(e) =>
                  setBill({ ...bill, billNumber: e.target.value })
                }
                placeholder="E.G. MHC-88291"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Vendor Entity
              </label>
              <select
                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-[11px] font-black uppercase text-white outline-none focus:border-emerald-500/50 appearance-none"
                value={bill.vendorId}
                onChange={(e) => setBill({ ...bill, vendorId: e.target.value })}
              >
                <option value="">SELECT VENDOR</option>
                <option value="V-101">MHC KENWORTH</option>
                <option value="V-102">PILOT FLYING J</option>
                <option value="V-103">RUSH TRUCK CENTERS</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Invoice Date
              </label>
              <input
                type="date"
                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-[11px] font-black uppercase text-white outline-none focus:border-emerald-500/50"
                value={bill.billDate}
                onChange={(e) => setBill({ ...bill, billDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                Payment Due
              </label>
              <input
                type="date"
                className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-[11px] font-black uppercase text-white outline-none focus:border-emerald-500/50"
                value={bill.dueDate}
                onChange={(e) => setBill({ ...bill, dueDate: e.target.value })}
              />
            </div>
          </div>

          {/* LINE ITEMS */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">
                Line Itemization
              </h3>
              <button
                onClick={addLine}
                className="px-4 py-2 bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600/20 transition-all flex items-center gap-2"
              >
                <Plus className="w-3 h-3" /> Add Detail Line
              </button>
            </div>

            <div className="bg-slate-950/50 border border-white/5 rounded-[2.5rem] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-black/20 border-b border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-[8px] font-black text-slate-600 uppercase">
                      Description
                    </th>
                    <th className="px-6 py-4 text-[8px] font-black text-slate-600 uppercase">
                      Category
                    </th>
                    <th className="px-6 py-4 text-[8px] font-black text-slate-600 uppercase">
                      Allocation
                    </th>
                    <th className="px-6 py-4 text-[8px] font-black text-slate-600 uppercase">
                      Alloc ID
                    </th>
                    <th className="px-6 py-4 text-[8px] font-black text-slate-600 uppercase text-right">
                      Amount
                    </th>
                    <th className="px-6 py-4 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bill.lines?.map((line) => (
                    <tr key={line.id} className="group">
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          className="w-full bg-transparent border-none text-[11px] font-black uppercase text-white outline-none"
                          placeholder="E.G. ENGINE OIL REPLACEMENT"
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.id, "description", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          className="bg-transparent border-none text-[10px] font-black uppercase text-slate-400 outline-none appearance-none"
                          value={line.category}
                          onChange={(e) =>
                            updateLine(line.id, "category", e.target.value)
                          }
                        >
                          <option value="Labor">LABOR</option>
                          <option value="Parts">PARTS</option>
                          <option value="Tow">TOW</option>
                          <option value="Tire">TIRE</option>
                          <option value="Fuel">FUEL</option>
                          <option value="Other">OTHER</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 bg-slate-900 rounded-lg text-slate-500">
                            {getAllocationIcon(line.allocationType)}
                          </div>
                          <select
                            className="bg-transparent border-none text-[10px] font-black uppercase text-slate-400 outline-none appearance-none"
                            value={line.allocationType}
                            onChange={(e) =>
                              updateLine(
                                line.id,
                                "allocationType",
                                e.target.value,
                              )
                            }
                          >
                            <option value="Overhead">OVERHEAD</option>
                            <option value="Load">LOAD</option>
                            <option value="Truck">TRUCK</option>
                            <option value="Trailer">TRAILER</option>
                            <option value="Driver">DRIVER</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          className="w-full bg-transparent border-none text-[10px] font-mono text-slate-500 uppercase outline-none"
                          placeholder="ID..."
                          value={line.allocationId}
                          onChange={(e) =>
                            updateLine(line.id, "allocationId", e.target.value)
                          }
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] text-emerald-500/50 font-black">
                            $
                          </span>
                          <input
                            type="number"
                            className="bg-transparent border-none text-[12px] font-black text-emerald-500 outline-none text-right w-24"
                            value={line.amount}
                            onChange={(e) =>
                              updateLine(line.id, "amount", e.target.value)
                            }
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => removeLine(line.id)}
                          className="p-2 text-slate-700 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="p-10 border-t border-white/5 bg-slate-900/20 shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <div className="px-8 py-4 bg-black/40 border border-white/5 rounded-2xl flex flex-col">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] mb-1">
                Total Bill Exposure
              </span>
              <span className="text-3xl font-black text-white tracking-tighter">
                ${bill.totalAmount?.toLocaleString()}
              </span>
            </div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest max-w-[200px]">
              Auto-posts to GL upon approval routing.
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-10 py-5 bg-white/5 text-white border border-white/10 rounded-3xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all font-inter"
            >
              Discard Draft
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-12 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3 font-inter disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />{" "}
              {isSubmitting ? "Submitting..." : "Submit for Approval"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
