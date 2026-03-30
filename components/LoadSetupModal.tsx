import React, { useState, useEffect, useRef } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { Broker, User, FreightType } from "../types";
import {
  Building2,
  ArrowRight,
  X,
  PhoneCall,
  Plus,
  Check,
  Loader2,
} from "lucide-react";
import { getBrokers, saveBroker } from "../services/brokerService";
import { getCompanyUsers, getCompany, updateUser } from "../services/authService";
import { generateNextLoadNumber } from "../services/storageService";
import { Toast } from "./Toast";

/** Sentinel value for "Direct / No Broker" selection */
const DIRECT_BROKER_ID = "__direct__";

interface QuickAddBrokerForm {
  name: string;
  email: string;
  phone: string;
}

interface QuickAddDriverForm {
  name: string;
  email: string;
  phone: string;
}

interface Props {
  currentUser: User;
  preSelectedBrokerId?: string;
  onContinue: (
    brokerId: string,
    driverId: string,
    loadNumber?: string,
    callNotes?: string,
    overrideFreightType?: FreightType,
    intermodalData?: any,
  ) => void;
  onCancel: () => void;
}

export const LoadSetupModal: React.FC<Props> = ({
  currentUser,
  preSelectedBrokerId,
  onContinue,
  onCancel,
}) => {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [selectedBrokerId, setSelectedBrokerId] = useState(
    preSelectedBrokerId || "",
  );
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [isPhoneOrder, setIsPhoneOrder] = useState(false);
  const [callNotes, setCallNotes] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "error" | "success" | "info";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Quick Add Broker state
  const [showQuickAddBroker, setShowQuickAddBroker] = useState(false);
  const [quickAddBrokerForm, setQuickAddBrokerForm] =
    useState<QuickAddBrokerForm>({ name: "", email: "", phone: "" });
  const [quickAddBrokerErrors, setQuickAddBrokerErrors] = useState<
    Record<string, string>
  >({});
  const [isSavingBroker, setIsSavingBroker] = useState(false);

  // Quick Add Driver state
  const [showQuickAddDriver, setShowQuickAddDriver] = useState(false);
  const [quickAddDriverForm, setQuickAddDriverForm] =
    useState<QuickAddDriverForm>({ name: "", email: "", phone: "" });
  const [quickAddDriverErrors, setQuickAddDriverErrors] = useState<
    Record<string, string>
  >({});
  const [isSavingDriver, setIsSavingDriver] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(panelRef, true, onCancel);

  useEffect(() => {
    loadInitialData();
  }, [currentUser]);

  const loadInitialData = async () => {
    const bList = await getBrokers();
    setBrokers(bList);
    const coUsers = await getCompanyUsers(currentUser.companyId);
    setUsers(coUsers);
  };

  const handleContinue = async (forcePhoneOrder: boolean = false) => {
    if (selectedDriverId && selectedBrokerId) {
      setIsSubmitting(true);
      // Resolve "Direct / No Broker" sentinel to empty string for downstream
      const resolvedBrokerId =
        selectedBrokerId === DIRECT_BROKER_ID ? "" : selectedBrokerId;
      try {
        if (forcePhoneOrder || isPhoneOrder) {
          const company = await getCompany(currentUser.companyId);
          const broker = brokers.find((b) => b.id === resolvedBrokerId);
          if (company && broker) {
            const newLoadNumber = generateNextLoadNumber(company, broker.name);
            onContinue(
              resolvedBrokerId,
              selectedDriverId,
              newLoadNumber,
              callNotes,
            );
          } else {
            onContinue(
              resolvedBrokerId,
              selectedDriverId,
              undefined,
              callNotes,
            );
          }
        } else {
          onContinue(resolvedBrokerId, selectedDriverId);
        }
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const errs: Record<string, string> = {};
      if (!selectedBrokerId) errs.broker = "Broker or Direct is required";
      if (!selectedDriverId) errs.driver = "Driver is required";
      if (callNotes.length > 500)
        errs.callNotes = "Call notes must be 500 characters or fewer";
      setFormErrors(errs);
    }
  };

  // ── Quick Add Broker ───────────────────────────────────────────────────────

  const openQuickAddBroker = () => {
    setShowQuickAddBroker(true);
    setShowQuickAddDriver(false);
    setQuickAddBrokerForm({ name: "", email: "", phone: "" });
    setQuickAddBrokerErrors({});
  };

  const cancelQuickAddBroker = () => {
    setShowQuickAddBroker(false);
    setQuickAddBrokerErrors({});
  };

  const handleQuickAddBrokerChange = (
    field: keyof QuickAddBrokerForm,
    value: string,
  ) => {
    setQuickAddBrokerForm((prev) => ({ ...prev, [field]: value }));
    if (quickAddBrokerErrors[field]) {
      setQuickAddBrokerErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveQuickBroker = async () => {
    const errs: Record<string, string> = {};
    if (!quickAddBrokerForm.name.trim()) errs.name = "Name is required";
    if (Object.keys(errs).length > 0) {
      setQuickAddBrokerErrors(errs);
      return;
    }

    setIsSavingBroker(true);
    try {
      const newBroker: Broker = {
        id: `broker-${Date.now()}`,
        name: quickAddBrokerForm.name.trim(),
        email: quickAddBrokerForm.email.trim() || undefined,
        phone: quickAddBrokerForm.phone.trim() || undefined,
        isShared: false,
        clientType: "Broker",
        approvedChassis: [],
      };
      await saveBroker(newBroker);
      // Refresh broker list and auto-select the new broker
      const refreshed = await getBrokers();
      setBrokers(refreshed);
      // Try to find the saved broker by name (server may assign a real id)
      const saved = refreshed.find(
        (b) => b.name === newBroker.name,
      );
      setSelectedBrokerId(saved?.id ?? newBroker.id);
      if (formErrors.broker) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next.broker;
          return next;
        });
      }
      setShowQuickAddBroker(false);
      setToast({ message: `Broker "${newBroker.name}" created`, type: "success" });
    } catch (err) {
      setToast({ message: "Failed to create broker. Please try again.", type: "error" });
    } finally {
      setIsSavingBroker(false);
    }
  };

  // ── Quick Add Driver ───────────────────────────────────────────────────────

  const openQuickAddDriver = () => {
    setShowQuickAddDriver(true);
    setShowQuickAddBroker(false);
    setQuickAddDriverForm({ name: "", email: "", phone: "" });
    setQuickAddDriverErrors({});
  };

  const cancelQuickAddDriver = () => {
    setShowQuickAddDriver(false);
    setQuickAddDriverErrors({});
  };

  const handleQuickAddDriverChange = (
    field: keyof QuickAddDriverForm,
    value: string,
  ) => {
    setQuickAddDriverForm((prev) => ({ ...prev, [field]: value }));
    if (quickAddDriverErrors[field]) {
      setQuickAddDriverErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSaveQuickDriver = async () => {
    const errs: Record<string, string> = {};
    if (!quickAddDriverForm.name.trim()) errs.name = "Name is required";
    if (Object.keys(errs).length > 0) {
      setQuickAddDriverErrors(errs);
      return;
    }

    setIsSavingDriver(true);
    try {
      const newDriver: User = {
        id: `driver-${Date.now()}`,
        companyId: currentUser.companyId,
        email: quickAddDriverForm.email.trim() || `driver-${Date.now()}@placeholder.local`,
        name: quickAddDriverForm.name.trim(),
        role: "driver",
        onboardingStatus: "Pending",
        safetyScore: 0,
      };
      await updateUser(newDriver);
      // Refresh user list and auto-select the new driver
      const refreshed = await getCompanyUsers(currentUser.companyId);
      setUsers(refreshed);
      // Find driver by id or name
      const saved = refreshed.find(
        (u) => u.id === newDriver.id || u.name === newDriver.name,
      );
      setSelectedDriverId(saved?.id ?? newDriver.id);
      if (formErrors.driver) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next.driver;
          return next;
        });
      }
      setShowQuickAddDriver(false);
      setToast({ message: `Driver "${newDriver.name}" created`, type: "success" });
    } catch (err) {
      setToast({ message: "Failed to create driver. Please try again.", type: "error" });
    } finally {
      setIsSavingDriver(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const drivers = users.filter(
    (u) => u.role === "driver" || u.role === "owner_operator",
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
      <div
        ref={panelRef}
        className="bg-[#1a2235] rounded-2xl border border-slate-800 w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/10 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-white">Setup New Load</h2>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close modal"
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Broker Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="lsmSelectBroker"
                className="text-xs font-bold text-slate-400"
              >
                Select Broker / Customer *
              </label>
              {!preSelectedBrokerId && (
                <button
                  type="button"
                  onClick={showQuickAddBroker ? cancelQuickAddBroker : openQuickAddBroker}
                  aria-label={showQuickAddBroker ? "Cancel add broker" : "Add new broker"}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {showQuickAddBroker ? (
                    <X className="w-3 h-3" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                  {showQuickAddBroker ? "Cancel" : "Add New"}
                </button>
              )}
            </div>

            {preSelectedBrokerId ? (
              /* Locked display when broker is pre-selected (e.g. from Broker Network) */
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <div className="w-full bg-slate-900/50 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-sm font-bold flex justify-between items-center text-slate-200">
                  {brokers.find((b) => b.id === selectedBrokerId)?.name ||
                    "Loading..."}
                  <span className="text-[10px] text-blue-500">(Locked)</span>
                </div>
              </div>
            ) : (
              /* Interactive dropdown for generic Create Load path */
              <div>
                <select
                  id="lsmSelectBroker"
                  value={selectedBrokerId}
                  onChange={(e) => {
                    setSelectedBrokerId(e.target.value);
                    if (formErrors.broker) {
                      setFormErrors((prev) => {
                        const next = { ...prev };
                        delete next.broker;
                        return next;
                      });
                    }
                  }}
                  className={`w-full bg-[#0a0f18] border ${formErrors.broker ? "border-red-500" : "border-slate-800"} rounded-xl px-4 py-3 text-sm text-white font-bold appearance-none focus:border-blue-500 outline-none`}
                >
                  <option value="">Select Broker / Customer</option>
                  <option value={DIRECT_BROKER_ID}>Direct / No Broker</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.mcNumber ? ` (${b.mcNumber})` : ""}
                    </option>
                  ))}
                </select>
                {brokers.length === 0 && (
                  <p className="text-slate-500 text-xs mt-1">
                    No brokers found. Use "Add New" to create one, or select "Direct / No Broker".
                  </p>
                )}
              </div>
            )}

            {formErrors.broker && (
              <p className="text-red-400 text-xs mt-1">{formErrors.broker}</p>
            )}

            {/* Quick Add Broker Form */}
            {showQuickAddBroker && (
              <div
                aria-label="Quick add broker form"
                className="mt-2 p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-3 animate-in slide-in-from-top-2 duration-200"
              >
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  New Broker / Customer
                </p>
                <div>
                  <label
                    htmlFor="qabroker-name"
                    className="text-[10px] text-slate-400 font-semibold mb-1 block"
                  >
                    Name *
                  </label>
                  <input
                    id="qabroker-name"
                    type="text"
                    value={quickAddBrokerForm.name}
                    onChange={(e) =>
                      handleQuickAddBrokerChange("name", e.target.value)
                    }
                    placeholder="e.g. Acme Logistics"
                    className={`w-full bg-[#0a0f18] border ${quickAddBrokerErrors.name ? "border-red-500" : "border-slate-700"} rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 outline-none`}
                  />
                  {quickAddBrokerErrors.name && (
                    <p className="text-red-400 text-xs mt-1">
                      {quickAddBrokerErrors.name}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="qabroker-email"
                      className="text-[10px] text-slate-400 font-semibold mb-1 block"
                    >
                      Email (optional)
                    </label>
                    <input
                      id="qabroker-email"
                      type="email"
                      value={quickAddBrokerForm.email}
                      onChange={(e) =>
                        handleQuickAddBrokerChange("email", e.target.value)
                      }
                      placeholder="contact@broker.com"
                      className="w-full bg-[#0a0f18] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="qabroker-phone"
                      className="text-[10px] text-slate-400 font-semibold mb-1 block"
                    >
                      Phone (optional)
                    </label>
                    <input
                      id="qabroker-phone"
                      type="tel"
                      value={quickAddBrokerForm.phone}
                      onChange={(e) =>
                        handleQuickAddBrokerChange("phone", e.target.value)
                      }
                      placeholder="555-123-4567"
                      className="w-full bg-[#0a0f18] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveQuickBroker}
                    disabled={isSavingBroker}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingBroker ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    {isSavingBroker ? "Saving..." : "Save Broker"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelQuickAddBroker}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Driver Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="lsmAssignDriver"
                className="text-xs font-bold text-slate-400"
              >
                Assign Driver *
              </label>
              <button
                type="button"
                onClick={showQuickAddDriver ? cancelQuickAddDriver : openQuickAddDriver}
                aria-label={showQuickAddDriver ? "Cancel add driver" : "Add new driver"}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {showQuickAddDriver ? (
                  <X className="w-3 h-3" />
                ) : (
                  <Plus className="w-3 h-3" />
                )}
                {showQuickAddDriver ? "Cancel" : "Add New"}
              </button>
            </div>

            <div>
              <select
                id="lsmAssignDriver"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className={`w-full bg-[#0a0f18] border ${formErrors.driver ? "border-red-500" : "border-slate-800"} rounded-xl px-4 py-3 text-sm text-white font-bold appearance-none focus:border-blue-500 outline-none`}
              >
                <option value="">Select Carrier / Driver</option>
                {drivers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              {drivers.length === 0 && (
                <p className="text-slate-500 text-xs mt-1">
                  No drivers found. Use "Add New" to create one.
                </p>
              )}
            </div>

            {formErrors.driver && (
              <p className="text-red-400 text-xs mt-1">{formErrors.driver}</p>
            )}

            {/* Quick Add Driver Form */}
            {showQuickAddDriver && (
              <div
                aria-label="Quick add driver form"
                className="mt-2 p-4 bg-slate-900/60 border border-slate-700 rounded-xl space-y-3 animate-in slide-in-from-top-2 duration-200"
              >
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                  New Driver
                </p>
                <div>
                  <label
                    htmlFor="qadriver-name"
                    className="text-[10px] text-slate-400 font-semibold mb-1 block"
                  >
                    Name *
                  </label>
                  <input
                    id="qadriver-name"
                    type="text"
                    value={quickAddDriverForm.name}
                    onChange={(e) =>
                      handleQuickAddDriverChange("name", e.target.value)
                    }
                    placeholder="e.g. John Smith"
                    className={`w-full bg-[#0a0f18] border ${quickAddDriverErrors.name ? "border-red-500" : "border-slate-700"} rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 outline-none`}
                  />
                  {quickAddDriverErrors.name && (
                    <p className="text-red-400 text-xs mt-1">
                      {quickAddDriverErrors.name}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="qadriver-email"
                      className="text-[10px] text-slate-400 font-semibold mb-1 block"
                    >
                      Email (optional)
                    </label>
                    <input
                      id="qadriver-email"
                      type="email"
                      value={quickAddDriverForm.email}
                      onChange={(e) =>
                        handleQuickAddDriverChange("email", e.target.value)
                      }
                      placeholder="driver@example.com"
                      className="w-full bg-[#0a0f18] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="qadriver-phone"
                      className="text-[10px] text-slate-400 font-semibold mb-1 block"
                    >
                      Phone (optional)
                    </label>
                    <input
                      id="qadriver-phone"
                      type="tel"
                      value={quickAddDriverForm.phone}
                      onChange={(e) =>
                        handleQuickAddDriverChange("phone", e.target.value)
                      }
                      placeholder="555-123-4567"
                      className="w-full bg-[#0a0f18] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveQuickDriver}
                    disabled={isSavingDriver}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingDriver ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Check className="w-3 h-3" />
                    )}
                    {isSavingDriver ? "Saving..." : "Save Driver"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelQuickAddDriver}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Phone Order Notes */}
          {isPhoneOrder && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label
                htmlFor="lsmInitialCallNotes"
                className="text-[10px] font-black text-yellow-500 uppercase tracking-widest"
              >
                Initial Call Notes
              </label>
              <textarea
                id="lsmInitialCallNotes"
                value={callNotes}
                onChange={(e) => {
                  if (e.target.value.length <= 500)
                    setCallNotes(e.target.value);
                }}
                maxLength={500}
                placeholder="e.g. Appointment required for pickup, strict delivery window..."
                className="w-full bg-[#0a0f18] border border-slate-800 rounded-xl p-4 text-xs text-white h-24 focus:border-blue-500 outline-none placeholder:text-slate-500"
              />
              <p className="text-[11px] text-slate-600 mt-1 text-right">
                {callNotes.length}/500
              </p>
              {formErrors.callNotes && (
                <p className="text-red-400 text-xs mt-1">
                  {formErrors.callNotes}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              onClick={() => handleContinue(false)}
              disabled={isSubmitting || !selectedBrokerId || !selectedDriverId}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Loading..." : "Scan Doc"}{" "}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() =>
                isPhoneOrder ? handleContinue(true) : setIsPhoneOrder(true)
              }
              disabled={isSubmitting}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <PhoneCall className="w-4 h-4" />{" "}
              {isSubmitting
                ? "Creating..."
                : isPhoneOrder
                  ? "Create Order"
                  : "Phone Order"}
            </button>
          </div>

          <p className="text-[10px] text-slate-500 italic text-center">
            "Phone Order" will auto-generate the next Load # based on company
            settings.
          </p>
        </div>
      </div>
    </div>
  );
};
