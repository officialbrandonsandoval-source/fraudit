"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY",
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming",
};

interface StateStats {
  state: string;
  totalProviders: number;
  totalFlagged: number;
  highRisk: number;
}

function getColor(highRisk: number): string {
  if (highRisk >= 100) return "#ef4444";
  if (highRisk >= 51) return "rgba(220, 38, 38, 0.7)";
  if (highRisk >= 11) return "rgba(194, 65, 12, 0.5)";
  if (highRisk >= 1) return "rgba(120, 53, 15, 0.3)";
  return "#27272a";
}

export default function MapPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StateStats[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  useEffect(() => {
    fetch("/api/map-stats")
      .then((r) => r.json())
      .then((data) => setStats(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const statsByAbbr: Record<string, StateStats> = {};
  for (const s of stats) {
    statsByAbbr[s.state] = s;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="mb-2 text-3xl font-bold">
          <span className="text-accent">Fraud Risk by State</span>
        </h1>
        <p className="mb-8 text-sm text-zinc-500">
          High-risk provider density by state. Click a state to search its providers.
        </p>

        <div className="relative rounded-xl border border-white/10 bg-white/5 p-4">
          <ComposableMap projection="geoAlbersUsa" className="w-full">
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const fips = geo.id;
                  const abbr = FIPS_TO_STATE[fips] || "";
                  const st = statsByAbbr[abbr];
                  const highRisk = st?.highRisk || 0;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getColor(highRisk)}
                      stroke="#18181b"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: "#ef4444", cursor: "pointer" },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={(e) => {
                        const name = STATE_NAMES[abbr] || abbr;
                        const providers = st?.totalProviders?.toLocaleString() || "0";
                        const flagged = st?.totalFlagged || 0;
                        const flaggedStr = flagged >= 1e9 ? `$${(flagged/1e9).toFixed(1)}B` : flagged >= 1e6 ? `$${(flagged/1e6).toFixed(1)}M` : flagged >= 1e3 ? `$${(flagged/1e3).toFixed(0)}K` : `$${flagged}`;
                        setTooltip({
                          x: e.clientX,
                          y: e.clientY,
                          content: `${name} — ${providers} providers · ${flaggedStr} flagged · ${highRisk} high-risk`,
                        });
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => {
                        if (abbr) router.push(`/search?q=${abbr}`);
                      }}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {tooltip && (
            <div
              className="pointer-events-none fixed z-50 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 shadow-xl"
              style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
            >
              {tooltip.content}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "#27272a" }} /> 0
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(120, 53, 15, 0.3)" }} /> 1-10
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(194, 65, 12, 0.5)" }} /> 11-50
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "rgba(220, 38, 38, 0.7)" }} /> 51-99
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded" style={{ background: "#ef4444" }} /> 100+
          </span>
          <span className="ml-auto">high-risk providers (score &ge; 60)</span>
        </div>
      </div>
    </div>
  );
}
