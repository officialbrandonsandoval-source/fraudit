import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  type CategoryKey,
  type RiskLevel,
  matchesCategory,
  matchesRisk,
} from "@/lib/categories";

// Full state name → abbreviation
const STATE_ABBR: Record<string, string> = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
  "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
  "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA", "west virginia": "WV",
  "wisconsin": "WI", "wyoming": "WY", "district of columbia": "DC",
};

// Abbreviation → full name (reverse map)
const ABBR_STATE: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_ABBR).map(([name, abbr]) => [abbr.toLowerCase(), name])
);

interface SearchParts {
  city?: string;
  state?: string; // always 2-char abbr if extracted
  general?: string;
}

function parseQuery(raw: string): SearchParts {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (STATE_ABBR[lower]) {
    return { state: STATE_ABBR[lower] };
  }

  if (/^[a-z]{2}$/i.test(trimmed) && ABBR_STATE[lower]) {
    return { state: trimmed.toUpperCase() };
  }

  for (const [fullName, abbr] of Object.entries(STATE_ABBR)) {
    const escaped = fullName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const pattern = new RegExp(`^(.+?)[,\\s]+${escaped}(?:\\s+\\d{5})?$`, "i");
    const m = trimmed.match(pattern);
    if (m) return { city: m[1].trim(), state: abbr };
  }

  const cityStateZip = trimmed.match(/^(.+?)[,\s]+([A-Za-z]{2})(?:\s+\d{5})?$/);
  if (cityStateZip) {
    const potentialAbbr = cityStateZip[2].toUpperCase();
    if (ABBR_STATE[potentialAbbr.toLowerCase()]) {
      return { city: cityStateZip[1].trim(), state: potentialAbbr };
    }
  }

  if (/^\d{5}(-\d{4})?$/.test(trimmed)) {
    return { general: trimmed };
  }

  return { general: trimmed };
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim() || "";
  const category = (request.nextUrl.searchParams.get("category") || "all") as CategoryKey;
  const risk = (request.nextUrl.searchParams.get("risk") || "all") as RiskLevel;

  if (!raw) return NextResponse.json([]);

  const parts = parseQuery(raw);
  let query = supabase
    .from("Provider")
    .select("*")
    .order("riskScore", { ascending: false })
    .limit(200);

  if (parts.city && parts.state) {
    query = query
      .ilike("city", `%${parts.city}%`)
      .eq("state", parts.state);
  } else if (parts.state && !parts.city) {
    query = query.eq("state", parts.state);
  } else {
    const g = parts.general || raw;

    if (g.toLowerCase().includes("hospice")) {
      query = query.contains("programs", ["Medicare Hospice"]);
    } else {
      query = query.or(
        `name.ilike.%${g}%,address.ilike.%${g}%,city.ilike.%${g}%,zip.ilike.%${g}%,state.ilike.%${g}%`
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let results = data || [];

  // Apply category filter
  if (category !== "all") {
    results = results.filter((p) => matchesCategory(p, category));
  }

  // Apply risk level filter
  if (risk !== "all") {
    results = results.filter((p) => matchesRisk(p.riskScore, risk));
  }

  return NextResponse.json(results.slice(0, 100));
}
