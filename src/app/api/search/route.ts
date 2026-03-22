import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

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

/**
 * Parse a query into typed parts.
 * Handles:
 *  - "California" → { state: "CA" }
 *  - "CA" → { state: "CA" }
 *  - "Los Angeles CA" → { city: "Los Angeles", state: "CA" }
 *  - "Los Angeles, California" → { city: "Los Angeles", state: "CA" }
 *  - "Los Angeles, CA 90210" → { city: "Los Angeles", state: "CA" }
 *  - "90210" → { general: "90210" }
 *  - "provider name" → { general: "provider name" }
 */
function parseQuery(raw: string): SearchParts {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  // Exact match: full state name
  if (STATE_ABBR[lower]) {
    return { state: STATE_ABBR[lower] };
  }

  // Exact match: 2-letter abbreviation
  if (/^[a-z]{2}$/i.test(trimmed) && ABBR_STATE[lower]) {
    return { state: trimmed.toUpperCase() };
  }

  // "City, Full State Name" or "City Full State Name"
  for (const [fullName, abbr] of Object.entries(STATE_ABBR)) {
    const escaped = fullName.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
    const pattern = new RegExp(`^(.+?)[,\\s]+${escaped}(?:\\s+\\d{5})?$`, "i");
    const m = trimmed.match(pattern);
    if (m) return { city: m[1].trim(), state: abbr };
  }

  // "City, ST" or "City ST" or "City, ST ZIPCODE"
  const cityStateZip = trimmed.match(/^(.+?)[,\s]+([A-Za-z]{2})(?:\s+\d{5})?$/);
  if (cityStateZip) {
    const potentialAbbr = cityStateZip[2].toUpperCase();
    if (ABBR_STATE[potentialAbbr.toLowerCase()]) {
      return { city: cityStateZip[1].trim(), state: potentialAbbr };
    }
  }

  // Zip code only
  if (/^\d{5}(-\d{4})?$/.test(trimmed)) {
    return { general: trimmed };
  }

  // Fallback: general search
  return { general: trimmed };
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (!raw) return NextResponse.json([]);

  const parts = parseQuery(raw);
  let query = supabase
    .from("Provider")
    .select("*")
    .order("riskScore", { ascending: false })
    .limit(100);

  if (parts.city && parts.state) {
    // City + state — exact state match, city ilike
    query = query
      .ilike("city", `%${parts.city}%`)
      .eq("state", parts.state);
  } else if (parts.state && !parts.city) {
    // State only
    query = query.eq("state", parts.state);
  } else {
    // General: search name, address, city, zip, state all at once
    const g = parts.general || raw;

    // Special handling for "hospice" keyword — filter by program
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

  return NextResponse.json(data || []);
}
