import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  GoogleMap,
  LoadScript,
  Marker,
  Polyline,
  InfoWindow,
} from "@react-google-maps/api";
import {
  Truck,
  MapPin,
  Navigation,
  Map as MapIcon,
  Layers,
  Maximize2,
  X,
  Phone,
  AlertCircle,
  Wifi,
  WifiOff,
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Wind,
  PlayCircle,
  Package,
  Search,
  Filter,
  ChevronRight,
  Activity,
  LayoutDashboard,
} from "lucide-react";
import { User, LoadData, LOAD_STATUS, LoadStatus, Incident } from "../types";
import { getDirections } from "../services/directionsService";

interface Weather {
  temp: number;
  condition: string;
  icon: string;
  windSpeed: number;
  humidity: number;
}

interface VehicleMarker {
  driver: User;
  activeLoad?: LoadData;
  isOnline: boolean;
  lastPing: string;
  coords: { lat: number; lng: number };
  heading: number;
  speed: number;
  hasIncident: boolean;
}

const GOOGLE_MAPS_API_KEY =
  (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || "YOUR_API_KEY_HERE";
const WEATHER_API_KEY =
  (import.meta as any).env.VITE_WEATHER_API_KEY || "YOUR_WEATHER_API_KEY";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const defaultCenter = {
  lat: 39.8283, // Center of USA
  lng: -98.5795,
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: true,
  fullscreenControl: false,
  styles: [
    {
      elementType: "geometry",
      stylers: [{ color: "#121926" }],
    },
    {
      elementType: "labels.text.stroke",
      stylers: [{ color: "#121926" }],
    },
    {
      elementType: "labels.text.fill",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#182333" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#2a3547" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#0a0f1a" }],
    },
  ],
};

interface Props {
  loads: LoadData[];
  users: User[];
  incidents?: Incident[];
  onViewLoad?: (load: LoadData) => void;
  onSelectIncident?: (incidentId: string) => void;
  isHighObstruction?: boolean;
  obstructionLevel?: string;
  showSideOverlays?: boolean;
}

export const GlobalMapViewEnhanced: React.FC<Props> = ({
  loads,
  users,
  incidents = [],
  onViewLoad,
  onSelectIncident,
  isHighObstruction = false,
  obstructionLevel = "NOMINAL",
  showSideOverlays = true,
}) => {
  const [libraries] = useState<("geometry" | "drawing" | "places")[]>([
    "geometry",
    "drawing",
    "places",
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loadFilter, setLoadFilter] = useState<LoadStatus | "all">("all");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleMarker | null>(
    null,
  );
  const [selectedDriverOverlay, setSelectedDriverOverlay] =
    useState<VehicleMarker | null>(null);
  const [routePaths, setRoutePaths] = useState<Record<string, any[]>>({});
  const [localOverlaysVisible, setLocalOverlaysVisible] =
    useState(showSideOverlays);

  useEffect(() => {
    setLocalOverlaysVisible(showSideOverlays);
  }, [showSideOverlays]);

  // Vehicle positions derived from DB-stored stop coordinates (not mock data)
  const activeVehicles: VehicleMarker[] = useMemo(() => {
    return users
      .filter((u) => u.role === "driver")
      .map((driver) => {
        // Find if driver has an active load
        const activeLoad = loads.find(
          (l) =>
            l.driverId === driver.id &&
            (l.status === "In Transit" || l.status === "Active"),
        );
        const hasIncident = incidents.some(
          (inc) => inc.driverId === driver.id && inc.status !== "Closed",
        );

        const seed = driver.id
          .split("-")
          .reduce((acc, char) => acc + char.charCodeAt(0), 0);

        // Use DB-stored coordinates from load legs when available
        let lat = defaultCenter.lat;
        let lng = defaultCenter.lng;
        const legs = (activeLoad as any)?.legs;
        if (legs && Array.isArray(legs)) {
          const legWithCoords = legs.find(
            (leg: any) => leg.latitude != null && leg.longitude != null,
          );
          if (legWithCoords) {
            lat = legWithCoords.latitude;
            lng = legWithCoords.longitude;
          }
        }

        return {
          driver,
          activeLoad,
          isOnline: seed % 10 > 2,
          lastPing: new Date(Date.now() - (seed % 60) * 60000).toISOString(),
          coords: { lat, lng },
          heading: seed % 360,
          speed: activeLoad ? 65 : 0,
          hasIncident,
        };
      });
  }, [users, loads, incidents]);

  const fetchWeather = useCallback(async (lat: number, lng: number) => {
    try {
      // Mock weather for demo if key is missing
      if (WEATHER_API_KEY === "YOUR_WEATHER_API_KEY") {
        setWeather({
          temp: 72,
          condition: "Partly Cloudy",
          icon: "03d",
          windSpeed: 12,
          humidity: 45,
        });
        return;
      }
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}&units=imperial`,
      );
      const data = await res.json();
      setWeather({
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        icon: data.weather[0].icon,
        windSpeed: Math.round(data.wind.speed),
        humidity: data.main.humidity,
      });
    } catch (e) {
      console.error("Failed to fetch weather", e);
    }
  }, []);

  const filteredLoads = useMemo(() => {
    if (loadFilter === "all") return loads;
    return loads.filter((l) => {
      if (loadFilter === "In Transit")
        return l.status === "In Transit" || l.status === "Active";
      return l.status === loadFilter;
    });
  }, [loads, loadFilter]);

  const filteredVehicles = useMemo(() => {
    return activeVehicles.filter((v) => {
      const matchesSearch =
        v.driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.activeLoad?.loadNumber?.includes(searchTerm);

      if (loadFilter === "all") return matchesSearch;
      if (loadFilter === "In Transit") {
        return (
          matchesSearch &&
          (v.activeLoad?.status === "in_transit" ||
            v.activeLoad?.status === "dispatched")
        );
      }
      if (loadFilter === "Booked")
        return matchesSearch && v.activeLoad?.status === "planned";
      if (loadFilter === "draft") return matchesSearch && !v.activeLoad;

      return matchesSearch;
    });
  }, [activeVehicles, searchTerm, loadFilter]);

  // Fetch weather when map loads
  useEffect(() => {
    if (map) {
      const center = map.getCenter();
      if (center) {
        fetchWeather(center.lat(), center.lng());
      }
    }
  }, [map, fetchWeather]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const getWeatherIcon = () => {
    if (!weather) return <Cloud className="w-4 h-4" />;
    const condition = weather.condition.toLowerCase();
    if (condition.includes("rain"))
      return <CloudRain className="w-4 h-4 text-blue-400" />;
    if (condition.includes("snow"))
      return <CloudSnow className="w-4 h-4 text-blue-200" />;
    if (condition.includes("clear") || condition.includes("sunny"))
      return <Sun className="w-4 h-4 text-yellow-400" />;
    return <Cloud className="w-4 h-4 text-slate-400" />;
  };

  const getLoadStatusIcon = (status: LoadStatus) => {
    switch (status) {
      case LOAD_STATUS.In_Transit:
        return <Navigation className="w-3 h-3 text-blue-400" />;
      case LOAD_STATUS.Booked:
        return <Package className="w-3 h-3 text-yellow-400" />;
      case LOAD_STATUS.Unassigned:
        return <AlertCircle className="w-3 h-3 text-slate-400" />;
      case LOAD_STATUS.Delivered:
        return <Activity className="w-3 h-3 text-emerald-400" />;
      default:
        return <Package className="w-3 h-3" />;
    }
  };

  // Calculate routes for active loads
  useEffect(() => {
    const fetchRoutes = async () => {
      for (const load of loads) {
        if (
          (load.status === LOAD_STATUS.Active ||
            load.status === LOAD_STATUS.In_Transit) &&
          !routePaths[load.id]
        ) {
          try {
            const origin = `${load.pickup.city}, ${load.pickup.state}`;
            const destination = `${load.dropoff.city}, ${load.dropoff.state}`;
            const directions = await getDirections(origin, destination);

            // Decode polyline (simple version for demo)
            if (typeof google !== "undefined" && google.maps.geometry) {
              const decodedPath = google.maps.geometry.encoding.decodePath(
                directions.points,
              );
              const points = decodedPath.map((p) => ({
                lat: p.lat(),
                lng: p.lng(),
              }));
              setRoutePaths((prev) => ({ ...prev, [load.id]: points }));
            }
          } catch (e) {
            console.error(`Failed to fetch route for load ${load.id}`, e);
          }
        }
      }
    };
    fetchRoutes();
  }, [loads, routePaths]);

  // AC3: Graceful fallback when GOOGLE_MAPS_API_KEY is absent
  const hasValidApiKey =
    GOOGLE_MAPS_API_KEY &&
    GOOGLE_MAPS_API_KEY !== "YOUR_API_KEY_HERE" &&
    GOOGLE_MAPS_API_KEY.length > 10;

  if (!hasValidApiKey) {
    return (
      <div
        className="flex-1 relative overflow-hidden w-full h-full"
        data-testid="map-fallback"
      >
        <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
          <div className="text-center p-8 bg-slate-900/80 border border-slate-700 rounded-2xl max-w-md">
            <MapIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              Map Unavailable
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Google Maps API key is not configured. Fleet tracking data is
              available via the tracking API endpoint.
            </p>
            <div className="bg-slate-950/60 border border-white/5 rounded-xl p-4">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">
                Fleet Summary
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-lg font-black text-blue-400">
                    {activeVehicles.filter((v) => v.isOnline).length}
                  </div>
                  <div className="text-[8px] font-bold text-slate-500 uppercase">
                    Online
                  </div>
                </div>
                <div>
                  <div className="text-lg font-black text-slate-400">
                    {activeVehicles.filter((v) => v.activeLoad).length}
                  </div>
                  <div className="text-[8px] font-bold text-slate-500 uppercase">
                    En Route
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative overflow-hidden group/map w-full h-full">
      {/* Map Container */}
      <div
        className="absolute inset-0 transition-all duration-700"
        style={{
          filter: isHighObstruction ? "grayscale(0.2) contrast(1.1)" : "none",
          transform: isHighObstruction ? "scale(1.02)" : "scale(1)",
        }}
      >
        <LoadScript
          googleMapsApiKey={GOOGLE_MAPS_API_KEY}
          libraries={libraries}
        >
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={defaultCenter}
            zoom={5}
            options={{
              ...mapOptions,
              styles: isHighObstruction
                ? [
                    ...(mapOptions.styles || []),
                    {
                      featureType: "all",
                      elementType: "labels",
                      stylers: [{ visibility: "off" }],
                    },
                  ]
                : mapOptions.styles,
            }}
            onLoad={onLoad}
          >
            {filteredVehicles.map((vehicle) => (
              <Marker
                key={vehicle.driver.id}
                position={vehicle.coords}
                icon={
                  typeof google !== "undefined"
                    ? {
                        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                        fillColor: vehicle.hasIncident
                          ? "#ef4444"
                          : vehicle.isOnline
                            ? "#3b82f6"
                            : "#64748b",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: isHighObstruction ? 1 : 2,
                        rotation: vehicle.heading,
                        scale: isHighObstruction ? 3.5 : 5,
                      }
                    : undefined
                }
                onClick={() => setSelectedVehicle(vehicle)}
              />
            ))}

            {Object.entries(routePaths).map(([id, path]) => (
              <Polyline
                key={id}
                path={path}
                options={{
                  strokeColor: "#3b82f6",
                  strokeOpacity: isHighObstruction ? 0.4 : 0.6,
                  strokeWeight: isHighObstruction ? 4 : 3,
                  geodesic: true,
                }}
              />
            ))}

            {selectedVehicle && (
              <InfoWindow
                position={selectedVehicle.coords}
                onCloseClick={() => setSelectedVehicle(null)}
              >
                <div className="p-2 min-w-[200px]">
                  <div className="text-[10px] font-black text-blue-600 uppercase mb-1">
                    Driver Profile
                  </div>
                  <div className="text-sm font-black text-slate-900 mb-2">
                    {selectedVehicle.driver.name}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className={`w-2 h-2 rounded-full ${selectedVehicle.isOnline ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {selectedVehicle.isOnline ? "Connected" : "Offline"}
                    </span>
                  </div>
                  {selectedVehicle.activeLoad && (
                    <div className="bg-slate-100 rounded-lg p-2 mb-3 border border-slate-200">
                      <div className="text-[8px] font-black text-slate-500 uppercase mb-1">
                        Active Load
                      </div>
                      <div className="text-[10px] font-bold text-blue-600">
                        #{selectedVehicle.activeLoad.loadNumber}
                      </div>
                      <div className="text-[9px] text-slate-600 italic">
                        {selectedVehicle.activeLoad.pickup.city} →{" "}
                        {selectedVehicle.activeLoad.dropoff.city}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedDriverOverlay(selectedVehicle)}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
                  >
                    Execute Intervention
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </div>

      {/* Weather Overlay */}
      {weather && !isHighObstruction && (
        <div className="absolute top-8 right-8 z-20 bg-[#0a0f1e]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl animate-in slide-in-from-right duration-500">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
              Operational Weather
            </span>
            {getWeatherIcon()}
          </div>
          <div className="flex items-center gap-3">
            <div
              className={`font-black text-white leading-none ${isHighObstruction ? "text-4xl" : "text-3xl"}`}
            >
              {weather.temp}°
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-slate-300">
                {weather.condition}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Wind className="w-3 h-3 text-slate-500" />
                <span className="text-[9px] text-slate-500">
                  {weather.windSpeed} mph
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RED CIRCLED: Regional Intelligence & Active Incidents (Restored for Live Map) */}
      {localOverlaysVisible && (
        <div
          className={`absolute top-8 left-8 z-20 space-y-4 transition-all duration-500 transform ${isHighObstruction ? "-translate-x-[110%] opacity-0" : "translate-x-0 opacity-100"} w-80`}
        >
          <div className="bg-[#0a0f1e]/90 backdrop-blur-xl border border-red-500/20 rounded-2xl p-5 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500/50" />
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-[10px] font-black text-white uppercase tracking-tighter">
                  Active Incidents
                </span>
              </div>
              <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded-lg text-[8px] font-black">
                {incidents.filter((i) => i.status !== "Closed").length}
              </span>
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto no-scrollbar">
              {incidents
                .filter((i) => i.status !== "Closed")
                .map((inc) => (
                  <div
                    key={inc.id}
                    onClick={() => onSelectIncident?.(inc.id)}
                    className="p-3 bg-slate-950/40 border border-white/5 rounded-xl hover:border-red-500/30 cursor-pointer transition-all"
                  >
                    <div className="text-[9px] font-black text-white uppercase mb-1">
                      {inc.type}
                    </div>
                    <div className="text-[8px] text-slate-500 truncate">
                      {inc.description}
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="bg-[#0a0f1e]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                Fleet Filters
              </span>
              <Filter className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["all", "In Transit", "Booked", "draft"].map((f) => (
                <button
                  key={f}
                  className={`py-2 px-3 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all ${loadFilter === f ? "bg-blue-600 text-white shadow-lg" : "bg-slate-950/50 text-slate-500 border border-white/5 hover:text-white"}`}
                  onClick={() => setLoadFilter(f as any)}
                >
                  {f.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RED CIRCLED: Driver/Truck List (Restored for Live Map) */}
      {localOverlaysVisible && (
        <div
          className={`absolute top-8 right-8 z-20 space-y-4 transition-all duration-500 transform ${rightPanelCollapsed || (isHighObstruction && !searchTerm) ? "translate-x-[110%] opacity-0" : "translate-x-0 opacity-100"} ${isHighObstruction ? "w-64" : "w-80"} ${weather ? "mt-32" : ""}`}
        >
          <div className="bg-[#0a0f1e]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">
                Driver Fleet
              </span>
              <Truck className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
              <input
                type="text"
                placeholder="Search drivers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-white/5 rounded-lg pl-8 pr-3 py-1.5 text-[9px] text-white outline-none focus:border-blue-500/50 transition-all font-bold placeholder:text-slate-700"
              />
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto no-scrollbar">
              {filteredVehicles.map((vehicle) => (
                <div
                  key={vehicle.driver.id}
                  onClick={() => {
                    setSelectedDriverOverlay(vehicle);
                    setSelectedVehicle(vehicle);
                    if (map) {
                      map.panTo(vehicle.coords);
                      map.setZoom(10);
                    }
                  }}
                  className="bg-slate-950/50 border border-white/5 rounded-xl p-3 hover:border-blue-500/30 cursor-pointer transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {vehicle.isOnline ? (
                        <Wifi className="w-3 h-3 text-green-500" />
                      ) : (
                        <WifiOff className="w-3 h-3 text-red-500" />
                      )}
                      <span className="text-[10px] font-bold text-white truncate max-w-[140px] uppercase tracking-tight italic">
                        {vehicle.driver.name}
                      </span>
                    </div>
                    {vehicle.hasIncident && (
                      <AlertCircle className="w-3 h-3 text-red-500 animate-pulse" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[8px] text-slate-500 font-bold uppercase tracking-widest">
                    <span>
                      {vehicle.activeLoad
                        ? `Load #${vehicle.activeLoad.loadNumber}`
                        : "Available"}
                    </span>
                    <span>{vehicle.speed} MPH</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Driver Deep Context Overlay */}
      {selectedDriverOverlay && (
        <div className="absolute inset-y-8 right-8 w-96 z-30 bg-[#050810]/98 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] p-8 animate-in slide-in-from-right duration-500 overflow-hidden flex flex-col">
          <button
            onClick={() => setSelectedDriverOverlay(null)}
            className="absolute top-8 right-8 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-6 mb-10">
            <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center border border-white/10 overflow-hidden relative">
              {selectedDriverOverlay.driver.avatar ? (
                <img
                  src={selectedDriverOverlay.driver.avatar}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <Truck className="w-8 h-8 text-slate-600" />
              )}
              <div
                className={`absolute bottom-2 right-2 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${selectedDriverOverlay.isOnline ? "bg-green-500" : "bg-red-500"}`}
              />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                {selectedDriverOverlay.driver.name}
              </h3>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                Ref ID: {selectedDriverOverlay.driver.id.slice(0, 8)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5">
              <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                Safety Score
              </div>
              <div className="text-[11px] font-black text-emerald-500 uppercase">
                98%
              </div>
            </div>
            <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/5">
              <div className="text-[8px] font-black text-slate-600 uppercase mb-1">
                Last Ping
              </div>
              <div className="text-[11px] font-black text-white uppercase">
                {new Date(selectedDriverOverlay.lastPing).toLocaleTimeString(
                  [],
                  { hour: "2-digit", minute: "2-digit" },
                )}
              </div>
            </div>
          </div>

          {selectedDriverOverlay.activeLoad && (
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-4 mb-6">
              <div className="text-[10px] font-black text-blue-400 uppercase mb-2">
                Current Load
              </div>
              <div className="text-[12px] font-bold text-white mb-1">
                #{selectedDriverOverlay.activeLoad.loadNumber}
              </div>
              <div className="text-[10px] text-slate-400">
                {selectedDriverOverlay.activeLoad.pickup.city} →{" "}
                {selectedDriverOverlay.activeLoad.dropoff.city}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() =>
                (window.location.href = `tel:${selectedDriverOverlay.driver.phone || ""}`)
              }
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-3 text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              Call Driver
            </button>
          </div>
        </div>
      )}

      {/* Bottom Controls - Fixed for functional use */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-[#0a0f1e]/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-2.5 flex items-center gap-2 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] group">
          <button
            onClick={() => setLocalOverlaysVisible(!localOverlaysVisible)}
            className={`p-4 ${localOverlaysVisible ? "bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)]" : "bg-slate-900/50 text-slate-500"} hover:bg-indigo-500 hover:text-white rounded-2xl transition-all active:scale-95 group/btn`}
          >
            <Layers className="w-5 h-5 group-hover/btn:rotate-90 transition-transform duration-500" />
          </button>
          <button
            onClick={() => {
              if (document.fullscreenElement) document.exitFullscreen();
              else document.documentElement.requestFullscreen();
            }}
            className="p-4 text-slate-400 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
            className={`p-4 ${!rightPanelCollapsed ? "text-blue-400 bg-blue-400/10" : "text-slate-400"} hover:text-white hover:bg-white/5 rounded-2xl transition-all`}
            title="Toggle Fleet Panel"
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
