import React, { useState, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { User, RolePermissions, PayModel } from "../types";
import {
  X,
  Save,
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  Unlock,
  DollarSign,
  Percent,
  Clock,
  Map as MapIcon,
  Briefcase,
  Award,
  ShieldAlert,
  Eye,
  Users,
  TrendingUp,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface Props {
  user: User;
  onSave: (updatedUser: User) => void;
  onCancel: () => void;
}

export const UserProfilePanel: React.FC<Props> = ({ user, onSave, onCancel }) => {
  const [formData, setFormData] = useState<User>(user);
  const [activeTab, setActiveTab] = useState<"info" | "financials" | "access">(
    "info",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onCancel);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = "Name is required";
    if (!formData.email.trim()) {
      errs.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = "Invalid email format";
    }
    if (formData.payRate !== undefined && formData.payRate < 0) {
      errs.payRate = "Pay rate cannot be negative";
    }
    return errs;
  };

  const isFormValid =
    !!formData.name.trim() &&
    !!formData.email.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
    (formData.payRate === undefined || formData.payRate >= 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      await Promise.resolve(onSave(formData));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePermission = (key: keyof RolePermissions, value: boolean) => {
    setFormData({
      ...formData,
      permissions: { ...(formData.permissions || {}), [key]: value },
    });
  };

  const isStaff = [
    "dispatcher",
    "safety_manager",
    "admin",
    "payroll_manager",
  ].includes(formData.role);

  return (
    <>
    <div
      className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
      aria-hidden="true"
    />
    <div
      ref={panelRef}
      className="fixed inset-y-0 right-0 z-[100] w-full md:max-w-2xl flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl animate-slide-in-right overflow-hidden"
    >
        {/* Modal Header */}
        <div className="p-8 border-b border-slate-800 flex justify-between items-center bg-slate-800/30 shrink-0">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-800 rounded-3xl flex items-center justify-center font-black text-blue-500 text-2xl border border-slate-700 shadow-xl">
              {formData.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                {formData.name}
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded uppercase font-black tracking-widest bg-slate-950 text-slate-500 border border-slate-800 mt-1 block w-fit">
                {formData.role.replace("_", " ")}
              </span>
            </div>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close modal"
            className="p-3 text-slate-500 hover:text-white transition-colors bg-slate-800 rounded-full"
          >
            <X />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-900 border-b border-slate-800 shrink-0">
          {["info", "financials", "access"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 ${activeTab === tab ? "bg-blue-900/10 border-blue-500 text-blue-400" : "border-transparent text-slate-600 hover:text-slate-300"}`}
            >
              {tab === "info"
                ? "Identity"
                : tab === "financials"
                  ? "Pay Profile"
                  : "Access"}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-10 space-y-8 bg-slate-950/50 scrollbar-hide">
          {activeTab === "info" && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="eumFullLegalName"
                    className="text-[10px] text-slate-600 uppercase font-black mb-2 block"
                  >
                    Full Legal Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="eumFullLegalName"
                    className={`w-full bg-slate-900 border ${errors.name ? "border-red-500" : "border-slate-800"} rounded-2xl p-4 text-white font-black`}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                  {errors.name && (
                    <p className="text-red-400 text-xs mt-1">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="eumEmail"
                    className="text-[10px] text-slate-600 uppercase font-black mb-2 block"
                  >
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="eumEmail"
                    className={`w-full bg-slate-900 border ${errors.email ? "border-red-500" : "border-slate-800"} rounded-2xl p-4 text-white font-mono`}
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    onBlur={() => {
                      if (
                        formData.email &&
                        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
                      ) {
                        setErrors((prev) => ({
                          ...prev,
                          email: "Invalid email format",
                        }));
                      } else {
                        setErrors((prev) => {
                          const { email, ...rest } = prev;
                          return rest;
                        });
                      }
                    }}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                  )}
                </div>
              </div>

              {/* Agile Operations additions */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="eumPrimaryWorkspace"
                    className="text-[10px] text-slate-600 uppercase font-black mb-2 block"
                  >
                    Primary Workspace
                  </label>
                  <select
                    id="eumPrimaryWorkspace"
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-black uppercase"
                    value={formData.primaryWorkspace || "Balanced"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        primaryWorkspace: e.target.value as any,
                      })
                    }
                  >
                    <option value="Quotes">Quotes-First (Sales)</option>
                    <option value="Dispatch">Dispatch-First (Ops)</option>
                    <option value="Balanced">Balanced Hybrid</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="eumDutyMode"
                    className="text-[10px] text-slate-600 uppercase font-black mb-2 block"
                  >
                    Duty Mode
                  </label>
                  <select
                    id="eumDutyMode"
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white font-black uppercase"
                    value={formData.dutyMode || "Both"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        dutyMode: e.target.value as any,
                      })
                    }
                  >
                    <option value="Pricing">On Pricing Desk</option>
                    <option value="Dispatch">On Dispatch Desk</option>
                    <option value="Both">Operating Both</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === "financials" && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 space-y-6">
                <h3 className="text-[10px] text-slate-600 uppercase font-black flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-500" /> Core Pay
                  Model
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "percent", label: "Load Revenue %", icon: Percent },
                    { id: "mileage", label: "Rate / Mile ($)", icon: MapIcon },
                    { id: "hourly", label: "Hourly Rate ($)", icon: Clock },
                    {
                      id: "salary",
                      label: "Staff Salary (Fixed)",
                      icon: Briefcase,
                    },
                  ].map((model) => (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          payModel: model.id as PayModel,
                        })
                      }
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${formData.payModel === model.id ? "bg-blue-900/20 border-blue-500/50 shadow-lg" : "bg-slate-950 border-slate-800 hover:border-slate-700"}`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`p-2 rounded-xl ${formData.payModel === model.id ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-500"}`}
                        >
                          <model.icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-black text-white uppercase">
                          {model.label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="pt-4 border-t border-slate-800">
                  <label className="text-[10px] text-slate-500 uppercase font-black mb-2 block">
                    {formData.payModel === "salary"
                      ? "Annual Compensation"
                      : "Base Rate Policy"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-4 font-black text-slate-500 text-xl">
                      {formData.payModel === "percent" ? "%" : "$"}
                    </span>
                    <input
                      aria-label="Base rate value"
                      type="number"
                      step="0.01"
                      className={`w-full bg-slate-950 border ${errors.payRate ? "border-red-500" : "border-slate-800"} rounded-2xl p-4 pl-12 text-2xl font-black text-white font-mono shadow-inner outline-none focus:border-blue-500 transition-colors`}
                      value={
                        formData.payModel === "salary"
                          ? formData.salaryAmount
                          : formData.payRate
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (formData.payModel === "salary")
                          setFormData({ ...formData, salaryAmount: val });
                        else setFormData({ ...formData, payRate: val });
                      }}
                    />
                  </div>
                  {errors.payRate && <p className="text-red-400 text-xs mt-1">{errors.payRate}</p>}
                </div>
              </div>
            </div>
          )}

          {activeTab === "access" && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-xl">
                <h3 className="text-[10px] text-slate-600 uppercase font-black mb-8 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-500" /> Sensitivity
                  Controls
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: "createLoads", label: "Create Manifests" },
                    { key: "showRates", label: "See Gross Rates" },
                    { key: "manageLegs", label: "Itemize Custom Stops" },
                    { key: "createBrokers", label: "Create New Clients" },
                    { key: "viewIntelligence", label: "View Market IQ" },
                    { key: "manageSafety", label: "Manage Global Safety" },
                    { key: "manageDrivers", label: "Hierarchy Control" },
                    {
                      key: "canAutoCreateClientFromScan",
                      label: "Auto-DB Clients",
                    },
                  ].map((perm) => (
                    <label
                      key={perm.key}
                      className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800 cursor-pointer hover:border-slate-600 transition-colors"
                    >
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                        {perm.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={
                          (formData.permissions as any)?.[perm.key] || false
                        }
                        onChange={(e) =>
                          updatePermission(perm.key as any, e.target.checked)
                        }
                        className="w-5 h-5 accent-blue-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-900 border-t border-slate-800 flex flex-col gap-4 shrink-0">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-5 rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-slate-600 font-black uppercase text-[10px] tracking-widest hover:text-slate-300 transition-colors"
          >
            Discard Modifications
          </button>
        </div>
      </div>
    </>
  );
};

/** Backward-compatible re-export so existing imports continue to work. */
export { UserProfilePanel as EditUserModal };
