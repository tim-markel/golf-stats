"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, Course, CourseDetail } from "@/lib/api";
import Combobox from "@/components/Combobox";

// Leaflet is client-only — load the map without SSR.
const ExploreMap = dynamic(() => import("@/components/ExploreMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-gray-400">
      Loading map…
    </div>
  ),
});

// Great-circle distance in miles.
function distanceMiles(a: [number, number], b: [number, number]) {
  const R = 3958.8;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function ExplorePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add a missing course via the web scraper.
  const [scraping, setScraping] = useState(false);
  const [scrapeErr, setScrapeErr] = useState<string | null>(null);

  async function addCourse(name: string) {
    if (name.trim().length < 2 || scraping) return;
    setScraping(true);
    setScrapeErr(null);
    try {
      const created = await api.scrapeCourse(name.trim());
      setCourses(await api.listCourses());
      setSelectedId(created.id); // focus the map on the new course
    } catch (err) {
      setScrapeErr(err instanceof Error ? err.message : "Could not add that course.");
    } finally {
      setScraping(false);
    }
  }

  useEffect(() => {
    api
      .listCourses()
      .then(setCourses)
      .catch(() => setError("Could not load courses."));
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => setUserPos([p.coords.latitude, p.coords.longitude]),
        () => {}, // ignore denial; we just won't sort by distance
        { enableHighAccuracy: false, timeout: 8000 }
      );
    }
  }, []);

  // fetch full detail (tees) for the selected course
  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    api.getCourse(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const mapped = useMemo(
    () => courses.filter((c) => c.latitude != null && c.longitude != null),
    [courses]
  );

  // list sorted by distance from the user (falls back to A–Z)
  const listed = useMemo(() => {
    const withDist = courses.map((c) => ({
      course: c,
      dist:
        userPos && c.latitude != null && c.longitude != null
          ? distanceMiles(userPos, [c.latitude, c.longitude])
          : null,
    }));
    if (userPos) {
      withDist.sort((a, b) => {
        if (a.dist == null) return 1;
        if (b.dist == null) return -1;
        return a.dist - b.dist;
      });
    }
    return withDist;
  }, [courses, userPos]);

  // where the map looks: selected course > user location > all-course average
  const view = useMemo<{ center: [number, number]; zoom: number }>(() => {
    const sel = mapped.find((c) => c.id === selectedId);
    if (sel) return { center: [sel.latitude!, sel.longitude!], zoom: 15 };
    if (userPos) return { center: userPos, zoom: 10 };
    if (mapped.length) {
      const lat = mapped.reduce((s, c) => s + (c.latitude as number), 0) / mapped.length;
      const lon = mapped.reduce((s, c) => s + (c.longitude as number), 0) / mapped.length;
      return { center: [lat, lon], zoom: 6 };
    }
    return { center: [39.5, -98.35], zoom: 4 }; // continental US fallback
  }, [mapped, userPos, selectedId]);

  if (error) return <p className="text-red-700">{error}</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Explore</h1>
        <p className="text-sm text-gray-500">
          Golf courses we have info for
          {userPos ? ", nearest to you first" : ""}.
        </p>
      </div>

      <div className="h-80 overflow-hidden rounded-xl border border-black/10 sm:h-96">
        <ExploreMap
          courses={mapped}
          userPos={userPos}
          selectedId={selectedId}
          center={view.center}
          zoom={view.zoom}
          onSelect={setSelectedId}
          onLocate={setUserPos}
        />
      </div>

      <div className="card p-4">
        <label className="mb-1 block text-sm font-medium">Find or add a course</label>
        <Combobox
          value={selectedId != null ? String(selectedId) : null}
          onChange={(v) => setSelectedId(Number(v))}
          placeholder="Search courses…"
          options={courses.map((c) => ({
            value: String(c.id),
            label: c.name,
            sublabel: [
              [c.city, c.state].filter(Boolean).join(", "),
              `${c.holes_count} holes`,
            ]
              .filter(Boolean)
              .join(" · "),
          }))}
          onAddNew={addCourse}
          addNewHint="Not in the list? Include the city and state (e.g. “Lansing, MI”), and the specific course if the facility has more than one."
        />
        <p className="mt-1 text-xs text-gray-400">
          Don’t see your course? Type its name — with city and state — to add it
          via web search.
        </p>
        {scraping && (
          <p className="mt-2 text-sm text-gray-500">
            🔎 Searching the web and adding the course… this can take up to a minute.
          </p>
        )}
        {scrapeErr && <p className="mt-2 text-sm text-red-600">{scrapeErr}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* course list */}
        <section className="card">
          <h2 className="border-b px-4 py-3 font-semibold">Courses</h2>
          <ul className="max-h-[26rem] divide-y overflow-y-auto">
            {listed.map(({ course: c, dist }) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm hover:bg-fairway-light ${
                    c.id === selectedId ? "bg-fairway-light" : ""
                  }`}
                >
                  <span>
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-xs text-gray-500">
                      {[
                        [c.city, c.state].filter(Boolean).join(", "),
                        `${c.holes_count} holes`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {dist != null && (
                    <span className="shrink-0 text-xs text-gray-400">
                      {dist < 10 ? dist.toFixed(1) : Math.round(dist)} mi
                    </span>
                  )}
                </button>
              </li>
            ))}
            {courses.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-500">No courses yet.</li>
            )}
          </ul>
        </section>

        {/* selected course detail */}
        <section className="card p-4">
          {detail ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold tracking-tight">{detail.name}</h2>
                <p className="text-sm text-gray-500">
                  {[detail.city, detail.state, detail.country].filter(Boolean).join(", ")}
                  {detail.par ? ` · par ${detail.par}` : ""} · {detail.holes_count} holes
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/rounds/new?course=${detail.id}`}
                  className="btn-primary px-3 py-2 text-sm"
                >
                  ⛳ New Round
                </Link>
                {detail.booking_url && (
                  <a
                    href={detail.booking_url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost px-3 py-2 text-sm"
                  >
                    Book tee time ↗
                  </a>
                )}
                {detail.website && (
                  <a
                    href={detail.website}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-ghost px-3 py-2 text-sm"
                  >
                    Website ↗
                  </a>
                )}
                {detail.phone && (
                  <a
                    href={`tel:${detail.phone}`}
                    className="btn-ghost px-3 py-2 text-sm"
                  >
                    {detail.phone}
                  </a>
                )}
              </div>

              {detail.tees.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-400">
                        <th className="py-1.5 pr-3">Tee</th>
                        <th className="py-1.5 pr-3 text-right">Yards</th>
                        <th className="py-1.5 pr-3 text-right">Rating</th>
                        <th className="py-1.5 text-right">Slope</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {detail.tees.map((t) => (
                        <tr key={t.id}>
                          <td className="py-1.5 pr-3 font-medium">{t.name}</td>
                          <td className="py-1.5 pr-3 text-right">{t.total_yards ?? "—"}</td>
                          <td className="py-1.5 pr-3 text-right">{t.course_rating ?? "—"}</td>
                          <td className="py-1.5 text-right">{t.slope_rating ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {!detail.booking_url && !detail.website && (
                <p className="text-xs text-gray-400">
                  No website or booking link on file for this course yet.
                </p>
              )}
            </div>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-gray-400">
              Select a course to see details.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
