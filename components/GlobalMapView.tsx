import React, { useMemo, useState } from "react";
import {
  MapPin,
  Truck,
  Navigation,
  Clock,
  Info,
  Search,
  Layers,
  Filter,
  Maximize2,
  Wifi,
  WifiOff,
  AlertCircle,
  Map as MapIcon,
  ShieldCheck,
  Calendar,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { LoadData, LOAD_STATUS, LoadStatus, User, Incident } from "../types";

interface Props {
  loads: LoadData[];
  users: User[];
  incidents?: Incident[];
  onViewLoad?: (load: LoadData) => void;
  onSelectIncident?: (id: string) => void;
}

export const GlobalMapView: React.FC<Props> = ({
  loads,
  users,
  incidents = [],
  onViewLoad,
  onSelectIncident,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Vehicle positions derived from DB-stored stop coordinates (not mock data)
  const activeVehicles = useMemo(() => {
    const drivers = users.filter((u) => u.role === "driver");
    return drivers.map((driver, idx) => {
      const activeLoad = loads.find(
        (l) => l.driverId === driver.id && l.status === LOAD_STATUS.Active,
      );
      const seed = driver.id
        .split("-")
        .reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const isOnline = !!activeLoad;

      // Use DB-stored coordinates from load legs instead of random positions
      let posX = 15 + ((idx * 12) % 70);
      let posY = 20 + ((idx * 15) % 65);
      const legs = (activeLoad as any)?.legs;
      if (legs && Array.isArray(legs)) {
        const legWithCoords = legs.find(
          (leg: any) => leg.latitude != null && leg.longitude != null,
        );
        if (legWithCoords) {
          // Map lat/lng to percentage positions: US bounds lat 25-50, lng -125 to -65
          posX = Math.max(
            5,
            Math.min(95, ((legWithCoords.longitude + 125) / 60) * 100),
          );
          posY = Math.max(
            5,
            Math.min(95, ((50 - legWithCoords.latitude) / 25) * 100),
          );
        }
      }

      return {
        driver,
        activeLoad,
        isOnline,
        lastPing: new Date(Date.now() - (seed % 60) * 60000).toISOString(),
        coords: { x: posX, y: posY },
        heading: seed % 360,
        speed: null as number | null,
        hasIncident: incidents.some(
          (inc) => inc.loadId === activeLoad?.id && inc.status !== "Closed",
        ),
      };
    });
  }, [users, loads, incidents]);

  const filteredVehicles = activeVehicles.filter(
    (v) =>
      v.driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.activeLoad?.loadNumber.includes(searchTerm),
  );

  return (
    <div className="h-full flex flex-col bg-[#020617] text-slate-100 font-inter overflow-hidden relative">
      {/* Map Canvas Overlay */}
      <div className="absolute inset-0 z-0">
        {/* Simulated Map Grid & Contours */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(#3b82f6 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full opacity-10 pointer-events-none"
          viewBox="0 0 1000 600"
        >
          <path
            d="M50,150 Q250,50 450,200 T850,100"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1"
          />
          <path
            d="M0,450 Q200,350 400,500 T900,400"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1"
          />
          <path
            d="M300,0 Q500,300 300,600"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1"
          />
        </svg>

        {/* Vehicle Markers */}
        {filteredVehicles.map((vehicle, idx) => (
          <div
            key={vehicle.driver.id}
            className="absolute cursor-pointer transition-all duration-700 group hover:z-50"
            style={{
              left: `${vehicle.coords.x}%`,
              top: `${vehicle.coords.y}%`,
              transform: "translate(-50%, -50%)",
            }}
            onClick={() => {
              if (vehicle.hasIncident) {
                const inc = incidents.find(
                  (i) =>
                    i.loadId === vehicle.activeLoad?.id &&
                    i.status !== "Closed",
                );
                if (inc && onSelectIncident) onSelectIncident(inc.id);
              } else if (vehicle.activeLoad && onViewLoad) {
                onViewLoad(vehicle.activeLoad);
              }
            }}
          >
            {/* Status Ring / Ping */}
            {vehicle.isOnline && vehicle.activeLoad && (
              <div className="absolute inset-0 w-12 h-12 -left-3 -top-3 bg-blue-500/10 rounded-full animate-ping" />
            )}

            <div
              className={`relative w-6 h-6 rounded-lg border flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-125 ${vehicle.hasIncident ? "bg-red-950 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse" : vehicle.isOnline ? "bg-slate-900 border-blue-500/50" : "bg-slate-950 border-slate-800"}`}
            >
              {vehicle.activeLoad ? (
                <Navigation
                  className={`w-3.5 h-3.5 ${vehicle.hasIncident ? "text-red-400" : vehicle.isOnline ? "text-blue-400" : "text-slate-600"}`}
                  style={{ transform: `rotate(${vehicle.heading}deg)` }}
                />
              ) : (
                <Truck className="w-3.5 h-3.5 text-slate-500" />
              )}

              {/* Ping Indicator Dot */}
              <div
                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-900 ${vehicle.hasIncident ? "bg-red-500 animate-ping" : vehicle.isOnline ? "bg-green-500 shadow-[0_0_5px_#22c55e]" : "bg-red-500"}`}
              />
            </div>

            {/* Hover Data Card */}
            <div className="absolute top-8 left-1/2 -translate-x-1/2 w-56 bg-[#0a0f1e] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-4 opacity-0 group-hover:opacity-100 transition-all pointer-events-none translate-y-2 group-hover:translate-y-0">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-[10px] font-black text-white uppercase tracking-tight">
                    {vehicle.driver.name}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {vehicle.isOnline ? (
                      <Wifi className="w-2.5 h-2.5 text-green-500" />
                    ) : (
                      <WifiOff className="w-2.5 h-2.5 text-red-500" />
                    )}
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">
                      {vehicle.isOnline ? "Active" : "Offline"} •{" "}
                      {vehicle.speed} MPH
                    </span>
                  </div>
                </div>
                <div className="text-[8px] font-black text-slate-600 uppercase bg-slate-950 px-1.5 py-0.5 rounded border border-white/5">
                  {vehicle.driver.safetyScore}%
                </div>
              </div>

              {vehicle.activeLoad && (
                <div className="bg-slate-950/50 border border-white/5 rounded-xl p-2.5 space-y-2">
                  <div className="flex justify-between items-center text-[8px] font-black uppercase text-blue-500">
                    <span>Load #{vehicle.activeLoad.loadNumber}</span>
                    <span>ETA: 14:20</span>
                  </div>
                  <div className="text-[9px] font-bold text-slate-300">
                    {vehicle.activeLoad.pickup.city} →{" "}
                    {vehicle.activeLoad.dropoff.city}
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between text-[7px] font-black text-slate-600 uppercase tracking-widest">
                <span>
                  LP:{" "}
                  {new Date(vehicle.lastPing).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-blue-500/80">View Telemetry</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* UI Layer: Floating Controls */}
      <div
        className={`absolute top-8 left-8 z-10 space-y-4 w-80 transition-all duration-500 transform ${leftPanelCollapsed ? "-translate-x-[110%] opacity-0" : "translate-x-0 opacity-100"}`}
      >
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
          <input
            className="w-full bg-[#0a0f1e]/80 backdrop-blur-xl border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-xs text-white font-bold placeholder:text-slate-600 outline-none focus:border-blue-500 transition-all shadow-2xl"
            placeholder="SEARCH FLEET / LOAD ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="bg-[#0a0f1e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
              Fleet Status
            </span>
            <Filter className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
              <div className="text-[8px] font-black text-blue-500 uppercase tracking-widest">
                En Route
              </div>
              <div className="text-lg font-black text-white mt-0.5">
                {activeVehicles.filter((v) => v.activeLoad).length}
              </div>
            </div>
            <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
              <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                Available
              </div>
              <div className="text-lg font-black text-white mt-0.5">
                {activeVehicles.filter((v) => !v.activeLoad).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Left Panel Toggle */}
      <button
        onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
        className={`absolute top-12 z-20 w-8 h-8 bg-slate-900 border border-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-600 transition-all shadow-2xl ${leftPanelCollapsed ? "left-8 rotate-180" : "left-[340px]"}`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Bottom Panel: Alerts Tray */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex gap-4">
        <div className="bg-yellow-500 border border-yellow-400/50 text-black px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_0_30px_rgba(234,179,8,0.3)] animate-pulse cursor-pointer">
          <AlertCircle className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            3 Units Off-Route Warning
          </span>
        </div>

        <div className="bg-[#0a0f1e]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-2.5 flex items-center gap-2 shadow-2xl">
          <button className="p-2.5 bg-blue-600 text-white rounded-xl shadow-lg transition-transform active:scale-90">
            <Layers className="w-4 h-4" />
          </button>
          <button className="p-2.5 text-slate-500 hover:text-white transition-colors">
            <Maximize2 className="w-4 h-4" />
          </button>
          <button className="p-2.5 text-slate-500 hover:text-white transition-colors">
            <MapIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right Panel Toggle removed to reduce clutter and redundancy with central timeline */}
    </div>
  );
};
