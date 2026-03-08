import React, { useMemo } from "react";
import { MapPin, Truck, Navigation, Clock, Info } from "lucide-react";
import { LoadData, LOAD_STATUS, LoadStatus } from "../types";

interface StopPosition {
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  loads: LoadData[];
}

/**
 * Derive a display position for a load from its DB-stored stop coordinates.
 * Uses the first stop with valid coordinates, or falls back to null.
 */
function getLoadPosition(load: LoadData): { x: number; y: number } | null {
  const legs = (load as any).legs as StopPosition[] | undefined;
  if (!legs || legs.length === 0) return null;

  // Find first leg with valid coordinates
  const legWithCoords = legs.find(
    (leg) => leg.latitude != null && leg.longitude != null,
  );

  if (
    !legWithCoords ||
    legWithCoords.latitude == null ||
    legWithCoords.longitude == null
  ) {
    return null;
  }

  // Map lat/lng to percentage positions on the visual canvas
  // US continental bounds: lat 25-50, lng -125 to -65
  const lat = legWithCoords.latitude;
  const lng = legWithCoords.longitude;
  const x = Math.max(5, Math.min(95, ((lng + 125) / 60) * 100));
  const y = Math.max(5, Math.min(95, ((50 - lat) / 25) * 100));

  return { x, y };
}

export const MapView: React.FC<Props> = ({ loads }) => {
  // Use DB-stored stop coordinates for load positions
  const loadPositions = useMemo(() => {
    return loads
      .filter(
        (l) =>
          l.status !== LOAD_STATUS.Delivered &&
          l.status !== LOAD_STATUS.Cancelled,
      )
      .map((l) => {
        const position = getLoadPosition(l);
        return position ? { load: l, x: position.x, y: position.y } : null;
      })
      .filter(
        (pos): pos is { load: LoadData; x: number; y: number } => pos !== null,
      );
  }, [loads]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case LOAD_STATUS.Active:
        return "text-blue-500";
      case LOAD_STATUS.Booked:
        return "text-green-500";
      case LOAD_STATUS.Planned:
        return "text-slate-500";
      default:
        return "text-blue-400";
    }
  };

  return (
    <div className="relative w-full h-[500px] bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl group">
      {/* Grid Pattern Background */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#3b82f6 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Map Contours (SVG) */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
        viewBox="0 0 1000 500"
      >
        <path
          d="M100,200 Q300,50 500,250 T900,100"
          fill="none"
          stroke="#1e293b"
          strokeWidth="2"
        />
        <path
          d="M50,400 Q250,300 450,450 T850,350"
          fill="none"
          stroke="#1e293b"
          strokeWidth="2"
        />
        <path
          d="M400,0 Q600,200 400,400"
          fill="none"
          stroke="#1e293b"
          strokeWidth="2"
        />
      </svg>

      {/* Load Markers — positioned from DB-stored coordinates */}
      <div className="absolute inset-0">
        {loadPositions.map((pos) => (
          <div
            key={pos.load.id}
            className="absolute cursor-pointer transition-all duration-500 hover:scale-125 group/marker"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Pulse Effect for Active Loads */}
            {pos.load.status === LOAD_STATUS.Active && (
              <div className="absolute inset-0 w-8 h-8 -left-1.5 -top-1.5 bg-blue-500/20 rounded-full animate-ping" />
            )}

            <div
              className={`relative p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex items-center justify-center ${getStatusColor(pos.load.status)}`}
            >
              {pos.load.status === LOAD_STATUS.Active ? (
                <Navigation className="w-4 h-4" />
              ) : (
                <MapPin className="w-4 h-4" />
              )}

              {/* Tooltip Overlay */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl opacity-0 group-hover/marker:opacity-100 transition-opacity z-50 pointer-events-none">
                <div className="text-[10px] font-black uppercase text-slate-500 mb-1">
                  Load #{pos.load.loadNumber}
                </div>
                <div className="text-xs font-bold text-white mb-2">
                  {pos.load.commodity || "General Freight"}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-[8px] text-slate-400 font-bold uppercase">
                    <Clock className="w-2.5 h-2.5" /> Status: {pos.load.status}
                  </div>
                  <div className="flex items-center gap-2 text-[8px] text-blue-400 font-bold uppercase">
                    <Truck className="w-2.5 h-2.5" /> Mode: {pos.load.status}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* No Loads With Coordinates Message */}
      {loadPositions.length === 0 && loads.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-xl p-4 text-center">
            <MapPin className="w-6 h-6 text-slate-500 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-bold">
              No geocoded stop coordinates available
            </p>
          </div>
        </div>
      )}

      {/* Map UI Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-lg p-1 shadow-lg flex flex-col items-center">
          <button className="p-2 hover:bg-slate-800 text-slate-400 rounded-md">
            +
          </button>
          <div className="w-full h-px bg-slate-800" />
          <button className="p-2 hover:bg-slate-800 text-slate-400 rounded-md">
            -
          </button>
        </div>
        <button className="p-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-lg shadow-lg text-slate-400 hover:text-white">
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      {/* Status Legend */}
      <div className="absolute bottom-4 left-4 flex gap-4 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl px-4 py-2 shadow-lg">
        {[
          { label: "Moving", color: "bg-blue-500" },
          { label: "Stopped", color: "bg-green-500" },
          { label: "Planned", color: "bg-slate-500" },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${item.color}`} />
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Live Data Feed Overlay (Small) */}
      <div className="absolute bottom-4 right-4 w-64 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[8px] font-black text-blue-400 uppercase tracking-tighter flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />{" "}
            Live Telemetry
          </span>
          <Info className="w-3 h-3 text-slate-600" />
        </div>
        <div className="space-y-4">
          {loads
            .filter((l) => l.status === LOAD_STATUS.Active)
            .slice(0, 3)
            .map((l) => (
              <div
                key={l.id}
                className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-between"
              >
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-slate-500 uppercase">
                    Load #{l.loadNumber}
                  </span>
                  <span className="text-xs font-bold text-white">
                    {l.commodity || "General Freight"}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-bold text-slate-400">
                    Status: {l.status}
                  </span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
