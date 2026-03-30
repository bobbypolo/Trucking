import React, { useState, useMemo } from "react";
import {
  Layout,
  Grid3X3,
  Sidebar,
  ScrollText,
  Calculator,
  ChevronDown,
  ChevronUp,
  X,
  Maximize2,
  Minimize2,
  Settings2,
  Filter,
  Download,
  Printer,
  Columns,
  Database,
  Truck,
  Plus,
} from "lucide-react";
import { LoadList } from "./LoadList";
import { LoadSetupModal } from "./LoadSetupModal";
import { LoadData, User, Broker } from "../types";
import { EmptyState } from "./EmptyState";
import { useCurrentUser } from "../hooks/useCurrentUser";

interface LoadBoardExpandedProps {
  loads: LoadData[];
  users: User[];
  brokers: Broker[];
  onView: (load: LoadData) => void;
  onEdit: (load: LoadData) => void;
  onDelete: (id: string) => void;
  canViewRates: boolean;
  onOpenHub?: (tab: "messaging", startCall?: boolean) => void;
  onCreateLoad?: () => void;
  testId?: string;
}

export const LoadBoardEnhanced: React.FC<LoadBoardExpandedProps> = ({
  loads,
  users,
  brokers,
  onView,
  onEdit,
  onDelete,
  canViewRates,
  onOpenHub,
  onCreateLoad,
  testId,
}) => {
  const currentUser = useCurrentUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGridViewOpen, setIsGridViewOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleCreateLoad = () => {
    if (currentUser) {
      setShowCreateModal(true);
    } else if (onCreateLoad) {
      onCreateLoad();
    }
  };

  const handleSetupContinue = (
    _brokerId: string,
    _driverId: string,
    _loadNumber?: string,
    _callNotes?: string,
  ) => {
    setShowCreateModal(false);
    // Params will be used when EditLoadForm integration is wired by parent (App.tsx)
    if (onCreateLoad) {
      onCreateLoad();
    }
  };
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    "loadNumber",
    "status",
    "pickup",
    "dropoff",
    "driver",
    "rate",
  ]);
  const [iftaMode, setIftaMode] = useState<"Manual" | "Auto">("Auto");
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Filter Logic for Sidebar
  const [columnOptions] = useState([
    { id: "loadNumber", label: "Load #" },
    { id: "status", label: "Status" },
    { id: "pickup", label: "Origin" },
    { id: "dropoff", label: "Destination" },
    { id: "driver", label: "Driver" },
    { id: "rate", label: "Rate" },
    { id: "container", label: "Container/Chassis" },
    { id: "weight", label: "Weight" },
    { id: "ifta_miles", label: "IFTA Miles" },
    { id: "ifta_fuel", label: "IFTA Fuel" },
    { id: "margin", label: "Profit Margin" },
  ]);

  const toggleColumn = (id: string) => {
    setVisibleColumns((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const getCellValue = (load: LoadData, colId: string): string => {
    switch (colId) {
      case "loadNumber":
        return load.loadNumber ?? "";
      case "status":
        return load.status ?? "";
      case "pickup":
        return load.pickup
          ? `${load.pickup.city ?? ""}, ${load.pickup.state ?? ""}`
          : "";
      case "dropoff":
        return load.dropoff
          ? `${load.dropoff.city ?? ""}, ${load.dropoff.state ?? ""}`
          : "";
      case "driver":
        return users.find((u) => u.id === load.driverId)?.name || "UNASSIGNED";
      case "rate":
        return String(load.carrierRate || 0);
      case "ifta_miles":
        return String(load.miles || "");
      case "ifta_fuel":
        return load.fuelPurchases
          ? load.fuelPurchases.reduce((a, b) => a + b.gallons, 0).toFixed(1)
          : "";
      case "margin":
        return load.profitMargin
          ? `${(load.profitMargin * 100).toFixed(1)}%`
          : "";
      default:
        return String(
          (load as unknown as Record<string, unknown>)[colId] ?? "",
        );
    }
  };

  const handleExportLoadBoard = () => {
    if (!loads.length) {
      return;
    }
    const cols = columnOptions.filter((c) => visibleColumns.includes(c.id));
    const headers = cols.map((c) => c.label);
    const rows = loads.map((load: LoadData) =>
      cols.map((c) => getCellValue(load, c.id)),
    );
    const csv = [
      headers.join(","),
      ...rows.map((r: string[]) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LoadBoard_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // IFTA Calculation Logic
  const iftaSummary = useMemo(() => {
    const stats: Record<string, { miles: number; fuel: number }> = {};
    loads.forEach((l) => {
      (l.iftaBreakdown || []).forEach((entry) => {
        if (!stats[entry.state]) stats[entry.state] = { miles: 0, fuel: 0 };
        stats[entry.state].miles += entry.estimatedMiles;
      });
      (l.fuelPurchases || []).forEach((f) => {
        if (!stats[f.state]) stats[f.state] = { miles: 0, fuel: 0 };
        stats[f.state].fuel += f.gallons;
      });
    });
    return stats;
  }, [loads]);

  const handleExportIFTA = () => {
    const entries = Object.entries(iftaSummary) as [
      string,
      { miles: number; fuel: number },
    ][];
    if (!entries.length) {
      return;
    }
    const headers = ["State", "Total Miles", "Total Gallons"];
    const rows = entries.map(([state, data]) => [state, data.miles, data.fuel]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v ?? ""}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IFTA_Filing_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="h-full flex flex-col bg-[#020617] relative overflow-hidden"
      data-testid={testId || "team2-load-board-shell"}
    >
      <div className="flex-1 flex overflow-hidden">
        {/* Main Card View (Original Component) */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loads.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={<Truck className="w-16 h-16" />}
                title="No loads"
                description="Create your first load to get started."
                action={
                  onCreateLoad
                    ? { label: "Create Load", onClick: handleCreateLoad }
                    : undefined
                }
              />
            </div>
          ) : (
            <LoadList
              loads={loads}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              users={users}
              canViewRates={canViewRates}
              onOpenHub={onOpenHub}
            />
          )}
        </div>

        {/* Customize View Sidebar */}
        <div
          className={`transition-all duration-300 ${isSidebarOpen ? "w-80" : "w-0"} bg-slate-900 border-l border-slate-800 flex flex-col overflow-hidden`}
        >
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-blue-500" /> Customize View
            </h3>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
            {/* Column Management */}
            <section className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                Show/Hide Columns
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {columnOptions.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => toggleColumn(col.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      visibleColumns.includes(col.id)
                        ? "bg-blue-600/10 border-blue-500/30 text-blue-400"
                        : "bg-slate-950 border-slate-800 text-slate-600 hover:border-slate-700"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase">
                      {col.label}
                    </span>
                    {visibleColumns.includes(col.id) && (
                      <Layout className="w-3 h-3" />
                    )}
                  </button>
                ))}
              </div>
            </section>

            {/* IFTA Calculations */}
            <section className="space-y-4 pt-4 border-t border-white/5">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1 flex items-center justify-between">
                IFTA Summary
                <span className="text-blue-500 text-[10px] bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {iftaMode}
                </span>
              </h4>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden divide-y divide-slate-800 shadow-xl">
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-slate-600 uppercase">
                      Total Miles
                    </div>
                    <div className="text-sm font-black text-white">
                      {(
                        Object.values(iftaSummary) as {
                          miles: number;
                          fuel: number;
                        }[]
                      )
                        .reduce((a, b) => a + b.miles, 0)
                        .toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="text-[10px] font-black text-slate-600 uppercase">
                      Total Fuel
                    </div>
                    <div className="text-sm font-black text-white">
                      {(
                        Object.values(iftaSummary) as {
                          miles: number;
                          fuel: number;
                        }[]
                      )
                        .reduce((a, b) => a + b.fuel, 0)
                        .toFixed(1)}{" "}
                      G
                    </div>
                  </div>
                </div>
                <div className="p-2 space-y-1">
                  {(
                    Object.entries(iftaSummary) as [
                      string,
                      { miles: number; fuel: number },
                    ][]
                  ).map(([state, data]) => (
                    <div
                      key={state}
                      className="flex justify-between items-center p-2 hover:bg-white/5 rounded-lg transition-colors group"
                    >
                      <span className="text-[10px] font-black text-slate-300 uppercase">
                        {state}
                      </span>
                      <div className="flex gap-4">
                        <span className="text-[11px] font-mono text-slate-500">
                          {data.miles} mi
                        </span>
                        <span className="text-[11px] font-mono text-blue-500/70">
                          {data.fuel} gal
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExportIFTA}
                  className="w-full py-3 text-[10px] font-black text-blue-500 hover:bg-blue-600 hover:text-white uppercase tracking-widest transition-all"
                >
                  Export IFTA Filing (CSV)
                </button>
              </div>
            </section>
          </div>
        </div>

        {/* +Create Load Floating Action Button */}
        {onCreateLoad && (
          <button
            onClick={handleCreateLoad}
            data-testid="team2-load-board-create-load-fab"
            className="absolute bottom-20 right-6 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl shadow-2xl z-40 hover:scale-110 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">
              Create Load
            </span>
          </button>
        )}

        {/* Sidebar Toggle Handle */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 bg-blue-600 text-white p-2 rounded-l-xl shadow-2xl z-20 hover:scale-110 transition-transform"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* SQL-Style Grid Bottom Panel */}
      <div
        className={`bg-slate-900 border-t border-slate-800 transition-all duration-300 relative z-30 ${isGridViewOpen ? "h-96" : "h-12 flex items-center"}`}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue-600/20" />

        <div
          className={`w-full ${isGridViewOpen ? "p-6 flex flex-col h-full" : "px-6 flex justify-between"}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => setIsGridViewOpen(!isGridViewOpen)}
              >
                <Database className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">
                  Detailed Load Table
                </h3>
                {isGridViewOpen ? (
                  <ChevronDown className="w-3 h-3 text-slate-500" />
                ) : (
                  <ChevronUp className="w-3 h-3 text-slate-500" />
                )}
              </div>
              {isGridViewOpen && (
                <div className="flex gap-2 ml-8 border-l border-slate-800 pl-8">
                  <button
                    onClick={handleExportLoadBoard}
                    className="text-[10px] font-black text-slate-500 hover:text-white uppercase flex items-center gap-1.5"
                  >
                    <Download className="w-3 h-3" /> Export CSV
                  </button>
                  <div className="relative ml-4">
                    <button
                      onClick={() => setShowColumnPicker(!showColumnPicker)}
                      className="text-[10px] font-black text-slate-500 hover:text-white uppercase flex items-center gap-1.5"
                    >
                      <Columns className="w-3 h-3" /> Select Columns
                    </button>
                    {showColumnPicker && (
                      <div className="absolute right-0 mt-2 bg-slate-800 border border-white/10 rounded-lg p-3 z-50 shadow-xl min-w-[180px]">
                        {columnOptions.map((col) => (
                          <label
                            key={col.id}
                            className="flex items-center gap-2 py-1.5 text-[11px] text-slate-300 cursor-pointer hover:text-white"
                          >
                            <input
                              type="checkbox"
                              checked={visibleColumns.includes(col.id)}
                              onChange={() => toggleColumn(col.id)}
                              className="rounded border-slate-600"
                            />
                            {col.label}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsGridViewOpen(!isGridViewOpen)}
                className="text-slate-500 hover:text-white"
              >
                {isGridViewOpen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {isGridViewOpen && (
            <div className="mt-6 flex-1 overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
              <div className="h-full overflow-auto no-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 z-10">
                    <tr className="text-[10px] font-black text-slate-600 uppercase tracking-widest bg-slate-950/80 backdrop-blur-md">
                      {visibleColumns.includes("loadNumber") && (
                        <th className="p-4 border-r border-slate-800">
                          Manifest
                        </th>
                      )}
                      {visibleColumns.includes("status") && (
                        <th className="p-4 border-r border-slate-800">
                          Status
                        </th>
                      )}
                      {visibleColumns.includes("pickup") && (
                        <th className="p-4 border-r border-slate-800">
                          Origin
                        </th>
                      )}
                      {visibleColumns.includes("dropoff") && (
                        <th className="p-4 border-r border-slate-800">Dest</th>
                      )}
                      {visibleColumns.includes("driver") && (
                        <th className="p-4 border-r border-slate-800">
                          Driver
                        </th>
                      )}
                      {visibleColumns.includes("rate") && (
                        <th className="p-4 border-r border-slate-800">Rate</th>
                      )}
                      {visibleColumns.includes("ifta_miles") && (
                        <th className="p-4 border-r border-slate-800">Miles</th>
                      )}
                      {visibleColumns.includes("ifta_fuel") && (
                        <th className="p-4 border-r border-slate-800">Fuel</th>
                      )}
                      {visibleColumns.includes("margin") && (
                        <th className="p-4 border-r border-slate-800">
                          Margin
                        </th>
                      )}
                      <th className="p-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/40">
                    {loads.map((load) => (
                      <tr
                        key={load.id}
                        className="hover:bg-blue-600/5 transition-colors group"
                      >
                        {visibleColumns.includes("loadNumber") && (
                          <td className="p-4 text-[10px] font-black text-blue-400 font-mono border-r border-slate-800/50">
                            {load.loadNumber}
                          </td>
                        )}
                        {visibleColumns.includes("status") && (
                          <td className="p-4 border-r border-slate-800/50">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-widest border ${
                                load.status === "delivered" ||
                                load.status === "completed"
                                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                                  : load.status === "in_transit" ||
                                      load.status === "dispatched"
                                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                    : "bg-slate-950 text-slate-500 border-slate-800"
                              }`}
                            >
                              {load.status}
                            </span>
                          </td>
                        )}
                        {visibleColumns.includes("pickup") && (
                          <td className="p-4 text-[11px] font-bold text-slate-300 uppercase border-r border-slate-800/50">
                            {load.pickup?.city ?? ""},{" "}
                            {load.pickup?.state ?? ""}
                          </td>
                        )}
                        {visibleColumns.includes("dropoff") && (
                          <td className="p-4 text-[11px] font-bold text-slate-300 uppercase border-r border-slate-800/50">
                            {load.dropoff?.city ?? ""},{" "}
                            {load.dropoff?.state ?? ""}
                          </td>
                        )}
                        {visibleColumns.includes("driver") && (
                          <td className="p-4 text-[11px] font-black text-slate-500 uppercase border-r border-slate-800/50">
                            {users.find((u) => u.id === load.driverId)?.name ||
                              "UNASSIGNED"}
                          </td>
                        )}
                        {visibleColumns.includes("rate") && (
                          <td className="p-4 text-[10px] font-black text-white font-mono border-r border-slate-800/50">
                            ${(load.carrierRate || 0).toLocaleString()}
                          </td>
                        )}
                        {visibleColumns.includes("ifta_miles") && (
                          <td className="p-4 text-[10px] font-black text-blue-400 font-mono border-r border-slate-800/50">
                            {load.miles || "-"}
                          </td>
                        )}
                        {visibleColumns.includes("ifta_fuel") && (
                          <td className="p-4 text-[10px] font-black text-orange-400 font-mono border-r border-slate-800/50">
                            {load.fuelPurchases
                              ? load.fuelPurchases
                                  .reduce((a, b) => a + b.gallons, 0)
                                  .toFixed(1)
                              : "-"}
                          </td>
                        )}
                        {visibleColumns.includes("margin") && (
                          <td className="p-4 text-[10px] font-black text-green-400 font-mono border-r border-slate-800/50">
                            {load.profitMargin
                              ? `${(load.profitMargin * 100).toFixed(1)}%`
                              : "-"}
                          </td>
                        )}
                        <td className="p-4 text-right">
                          <button
                            onClick={() => onView(load)}
                            className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-blue-500 transition-all"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
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
      </div>

      {/* Internal Load Setup Modal */}
      {showCreateModal && currentUser && (
        <LoadSetupModal
          currentUser={currentUser}
          onContinue={handleSetupContinue}
          onCancel={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};
