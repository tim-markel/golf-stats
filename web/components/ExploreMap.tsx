"use client";

// Leaflet map for the Explore page. Client-only (Leaflet touches window), so
// the Explore page imports this with next/dynamic { ssr: false }.

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Course } from "@/lib/api";

// On-brand pin as a div icon (avoids Leaflet's broken default-marker asset URLs).
const pin = (selected: boolean) =>
  L.divIcon({
    className: "",
    html: `<div style="
      width:16px;height:16px;border-radius:9999px;
      background:${selected ? "#0b3d24" : "#15663f"};
      border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);
      ${selected ? "transform:scale(1.3);" : ""}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const userPin = L.divIcon({
  className: "",
  html: `<div style="
    width:14px;height:14px;border-radius:9999px;background:#2563eb;
    border:2px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,.25);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

// Recenter/zoom the map when the target view changes.
function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  return null;
}

export default function ExploreMap({
  courses,
  userPos,
  selectedId,
  center,
  zoom,
  onSelect,
}: {
  courses: Course[];
  userPos: [number, number] | null;
  selectedId: number | null;
  center: [number, number];
  zoom: number;
  onSelect: (id: number) => void;
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
    >
      <Recenter center={center} zoom={zoom} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {userPos && (
        <Marker position={userPos} icon={userPin}>
          <Popup>You are here</Popup>
        </Marker>
      )}
      {courses.map((c) => (
        <Marker
          key={c.id}
          position={[c.latitude as number, c.longitude as number]}
          icon={pin(c.id === selectedId)}
          eventHandlers={{ click: () => onSelect(c.id) }}
        >
          <Popup>
            <div className="text-sm font-semibold">{c.name}</div>
            {(c.city || c.state) && (
              <div className="text-xs text-gray-500">
                {[c.city, c.state].filter(Boolean).join(", ")}
              </div>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
