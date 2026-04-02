import React, { useMemo, useState } from "react";
import { Truck, UserCheck } from "lucide-react";
import { LoadData, User } from "../types";

interface Props {
  loads: LoadData[];
  users: User[];
  onAssignLoad: (load: LoadData) => Promise<void> | void;
}

const ACTIVE_LOAD_STATUSES = new Set([
  "draft",
  "planned",
  "dispatched",
  "in_transit",
  "arrived",
  "delivered",
]);

export const DriverAssignmentPanel: React.FC<Props> = ({
  loads,
  users,
  onAssignLoad,
}) => {
  const [selectedLoadId, setSelectedLoadId] = useState<string>("");
  const [selectedDriverId, setSelectedDriverId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unassignedLoads = useMemo(
    () => loads.filter((load) => !load.driverId?.trim()),
    [loads],
  );

  const busyDriverIds = useMemo(
    () =>
      new Set(
        loads
          .filter(
            (load) =>
              Boolean(load.driverId?.trim()) &&
              ACTIVE_LOAD_STATUSES.has(load.status),
          )
          .map((load) => load.driverId),
      ),
    [loads],
  );

  const availableDrivers = useMemo(
    () =>
      users.filter(
        (user) =>
          (user.role === "driver" || user.role === "owner_operator") &&
          !busyDriverIds.has(user.id),
      ),
    [busyDriverIds, users],
  );

  const selectedLoad =
    unassignedLoads.find((load) => load.id === selectedLoadId) ?? null;
  const selectedDriver =
    availableDrivers.find((driver) => driver.id === selectedDriverId) ?? null;

  const handleAssign = async () => {
    if (!selectedLoad || !selectedDriver || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAssignLoad({
        ...selectedLoad,
        driverId: selectedDriver.id,
      });
      setSelectedLoadId("");
      setSelectedDriverId("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      aria-label="Driver assignment panel"
      className="rounded-3xl border border-white/10 bg-[#0a0f18] p-6 shadow-2xl shadow-black/20"
    >
      <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-400">
            Dispatch Assignment
          </p>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">
            Assign Unassigned Loads
          </h2>
        </div>
        <div className="flex gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
          <span>{unassignedLoads.length} unassigned</span>
          <span>{availableDrivers.length} available drivers</span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">
              Unassigned Loads
            </h3>
          </div>
          <div className="space-y-2">
            {unassignedLoads.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-400">
                No unassigned loads are waiting for dispatch.
              </p>
            )}
            {unassignedLoads.map((load) => {
              const isSelected = load.id === selectedLoadId;
              return (
                <button
                  key={load.id}
                  type="button"
                  aria-label={`Select load ${load.loadNumber}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedLoadId(load.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isSelected
                      ? "border-blue-500 bg-blue-500/10 text-white"
                      : "border-white/5 bg-slate-900 text-slate-200 hover:border-blue-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black uppercase tracking-wide">
                      {load.loadNumber}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {load.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {load.pickup.city}, {load.pickup.state} to {load.dropoff.city}
                    , {load.dropoff.state}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">
              Available Drivers
            </h3>
          </div>
          <div className="space-y-2">
            {availableDrivers.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-800 px-4 py-5 text-sm text-slate-400">
                No drivers are currently available for assignment.
              </p>
            )}
            {availableDrivers.map((driver) => {
              const isSelected = driver.id === selectedDriverId;
              return (
                <button
                  key={driver.id}
                  type="button"
                  aria-label={`Select driver ${driver.name}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedDriverId(driver.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10 text-white"
                      : "border-white/5 bg-slate-900 text-slate-200 hover:border-emerald-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-black uppercase tracking-wide">
                      {driver.name}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      {driver.role.replace("_", " ")}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-400">
                    {driver.email}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/5 bg-slate-950/70 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-sm text-slate-300">
          <span className="font-black uppercase tracking-[0.18em] text-slate-400">
            Ready to assign:
          </span>{" "}
          {selectedLoad && selectedDriver
            ? `${selectedLoad.loadNumber} to ${selectedDriver.name}`
            : "Select one load and one driver."}
        </div>
        <button
          type="button"
          aria-label="Assign selected load to selected driver"
          disabled={!selectedLoad || !selectedDriver || isSubmitting}
          onClick={handleAssign}
          className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white transition-all hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          {isSubmitting ? "Assigning..." : "Assign Load"}
        </button>
      </div>
    </section>
  );
};
