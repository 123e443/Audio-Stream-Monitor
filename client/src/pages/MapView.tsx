import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Icon, divIcon } from "leaflet";
import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Radio, MapPin, Clock, AlertTriangle, Flame, Activity } from "lucide-react";
import type { Transcription, Stream } from "@shared/schema";

const CALL_TYPE_COLORS: Record<string, string> = {
  Fire: "#ef4444",
  Medical: "#3b82f6",
  Crime: "#f59e0b",
  Traffic: "#22c55e",
  Emergency: "#dc2626",
  Dispatch: "#6366f1",
  default: "#8b5cf6",
};

function createCallMarker(callType: string) {
  const color = CALL_TYPE_COLORS[callType] || CALL_TYPE_COLORS.default;
  return divIcon({
    className: "custom-marker",
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 12px ${color}66;
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function MapView() {
  const { data: transcriptions, isLoading: loadingCalls } = useQuery<Transcription[]>({
    queryKey: ["/api/transcriptions", { withLocation: true }],
    refetchInterval: 3000,
  });

  const { data: streams } = useQuery<Stream[]>({
    queryKey: ["/api/streams"],
  });

  const [selectedCall, setSelectedCall] = useState<Transcription | null>(null);
  const [filterType, setFilterType] = useState<string>("All");

  const callsWithLocation = useMemo(() => {
    if (!transcriptions) return [];
    return transcriptions.filter(t => t.latitude && t.longitude);
  }, [transcriptions]);

  const filteredCalls = useMemo(() => {
    if (filterType === "All") return callsWithLocation;
    return callsWithLocation.filter(c => c.callType === filterType);
  }, [callsWithLocation, filterType]);

  const callTypes = useMemo(() => {
    const types = new Set(callsWithLocation.map(c => c.callType).filter(Boolean));
    return ["All", ...Array.from(types)];
  }, [callsWithLocation]);

  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const center = callsWithLocation.length > 0 
    ? [callsWithLocation[0].latitude!, callsWithLocation[0].longitude!] as [number, number]
    : defaultCenter;

  const getStreamName = (streamId: number) => {
    const stream = streams?.find(s => s.id === streamId);
    return stream?.name || `Stream ${streamId}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 flex flex-col">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-primary" />
                Geographic View
              </h2>
              <p className="text-muted-foreground">
                Live call locations across all monitored channels
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {callTypes.map(type => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  data-testid={`filter-${type.toLowerCase()}`}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                    ${filterType === type 
                      ? "bg-primary text-primary-foreground border-primary" 
                      : "bg-background/50 text-muted-foreground border-border hover:border-primary/50"}
                  `}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 relative">
          {loadingCalls ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
                <p className="text-muted-foreground animate-pulse">Loading geographic data...</p>
              </div>
            </div>
          ) : (
            <MapContainer
              center={center}
              zoom={4}
              style={{ height: "100%", width: "100%", minHeight: "500px" }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              <MapUpdater center={center} />
              
              {filteredCalls.map((call) => (
                <Marker
                  key={call.id}
                  position={[call.latitude!, call.longitude!]}
                  icon={createCallMarker(call.callType || "default")}
                  eventHandlers={{
                    click: () => setSelectedCall(call),
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="bg-card p-3 rounded-lg min-w-[200px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {call.callType || "Unknown"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getStreamName(call.streamId)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground font-medium mb-2">
                        {call.content}
                      </p>
                      {call.address && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {call.address}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {call.timestamp && format(new Date(call.timestamp), "HH:mm:ss")}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}

          <Card className="absolute bottom-4 left-4 p-4 bg-card/90 backdrop-blur border-border/50 z-[1000]">
            <h3 className="text-sm font-semibold text-white mb-3">Legend</h3>
            <div className="space-y-2">
              {Object.entries(CALL_TYPE_COLORS).filter(([k]) => k !== "default").map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full border border-white/50"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-muted-foreground">{type}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="absolute top-4 right-4 p-4 bg-card/90 backdrop-blur border-border/50 z-[1000]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{filteredCalls.length}</p>
                <p className="text-xs text-muted-foreground">Active Calls</p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
