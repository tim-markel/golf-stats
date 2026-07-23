"use client";

// Leaflet map for the Explore page. Client-only (Leaflet touches window), so
// the Explore page imports this with next/dynamic { ssr: false }.

import { useEffect, useRef } from "react";
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

// Smoothly fly the map to the target view (zoom into the selected course).
function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [map, center, zoom]);
  return null;
}

// A control button (below the +/- zoom control) that flies to your location.
function LocateControl({
  userPos,
  onLocate,
}: {
  userPos: [number, number] | null;
  onLocate?: (pos: [number, number]) => void;
}) {
  const map = useMap();
  const posRef = useRef(userPos);
  const onLocateRef = useRef(onLocate);
  posRef.current = userPos;
  onLocateRef.current = onLocate;

  useEffect(() => {
    const control = new L.Control({ position: "topleft" });
    control.onAdd = () => {
      const div = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const link = L.DomUtil.create("a", "", div) as HTMLAnchorElement;
      link.href = "#";
      link.title = "Center on my location";
      link.setAttribute("role", "button");
      link.style.cssText =
        "display:flex;align-items:center;justify-content:center;color:#333;";
      link.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
        '<path d="M12 2 4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>';

      const goTo = (pos: [number, number]) => map.flyTo(pos, 13, { duration: 0.8 });
      L.DomEvent.on(link, "click", (e) => {
        L.DomEvent.stop(e);
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(
            (p) => {
              const pos: [number, number] = [p.coords.latitude, p.coords.longitude];
              onLocateRef.current?.(pos);
              goTo(pos);
            },
            () => {
              if (posRef.current) goTo(posRef.current); // fall back to last known
            },
            { enableHighAccuracy: false, timeout: 8000 }
          );
        } else if (posRef.current) {
          goTo(posRef.current);
        }
      });
      return div;
    };
    control.addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);

  return null;
}

export default function ExploreMap({
  courses,
  userPos,
  selectedId,
  center,
  zoom,
  onSelect,
  onLocate,
}: {
  courses: Course[];
  userPos: [number, number] | null;
  selectedId: number | null;
  center: [number, number];
  zoom: number;
  onSelect: (id: number) => void;
  onLocate?: (pos: [number, number]) => void;
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
    >
      <Recenter center={center} zoom={zoom} />
      <LocateControl userPos={userPos} onLocate={onLocate} />
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
