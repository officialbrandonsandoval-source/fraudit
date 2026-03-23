export type CategoryKey = "all" | "healthcare" | "va" | "childcare" | "ghost";
export type RiskLevel = "all" | "high" | "elevated" | "lower";

export const CATEGORIES: {
  key: CategoryKey;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}[] = [
  { key: "all", label: "All", color: "text-zinc-300", bgColor: "bg-white/10", borderColor: "border-white/20", icon: "" },
  { key: "healthcare", label: "Healthcare", color: "text-blue-400", bgColor: "bg-blue-500/15", borderColor: "border-blue-500/30", icon: "⚕" },
  { key: "va", label: "VA Contractors", color: "text-purple-400", bgColor: "bg-purple-500/15", borderColor: "border-purple-500/30", icon: "★" },
  { key: "childcare", label: "Child Care", color: "text-amber-400", bgColor: "bg-amber-500/15", borderColor: "border-amber-500/30", icon: "◆" },
  { key: "ghost", label: "Ghost Operations", color: "text-red-400", bgColor: "bg-red-500/15", borderColor: "border-red-500/30", icon: "◎" },
];

export const RISK_LEVELS: {
  key: RiskLevel;
  label: string;
  min?: number;
  max?: number;
}[] = [
  { key: "all", label: "All Risk Levels" },
  { key: "high", label: "High Risk 70+", min: 70 },
  { key: "elevated", label: "Elevated 40–69", min: 40, max: 69 },
  { key: "lower", label: "Lower Risk <40", max: 39 },
];

export function detectCategories(provider: {
  programs: string[];
  anomalies: string[];
}): CategoryKey[] {
  const cats: CategoryKey[] = [];
  const progs = (provider.programs || []).join(" ").toLowerCase();
  const anoms = (provider.anomalies || []).join(" ").toLowerCase();
  const combined = progs + " " + anoms;

  if (
    /medicare|medicaid|hospice|clinic|hospital|health|medical|nurse|physician|therapy|rehab|surgical|dental|pharma|dialysis|home\s?health|dme/i.test(
      combined,
    )
  ) {
    cats.push("healthcare");
  }
  if (/va contractor|\bva\b|veteran|military|defense|\bdod\b/i.test(combined)) {
    cats.push("va");
  }
  if (
    /child\s?care|ccdf|daycare|day\s?care|pediatric|preschool|nursery|head\s?start/i.test(
      combined,
    )
  ) {
    cats.push("childcare");
  }
  if (/ghost|zero billing|\$0 medicare/i.test(anoms)) {
    cats.push("ghost");
  }

  return cats;
}

export function primaryCategory(provider: {
  programs: string[];
  anomalies: string[];
}): CategoryKey {
  const cats = detectCategories(provider);
  if (cats.includes("ghost")) return "ghost";
  if (cats.includes("childcare")) return "childcare";
  if (cats.includes("va")) return "va";
  if (cats.includes("healthcare")) return "healthcare";
  return "healthcare";
}

export function matchesCategory(
  provider: { programs: string[]; anomalies: string[] },
  category: CategoryKey,
): boolean {
  if (category === "all") return true;
  return detectCategories(provider).includes(category);
}

export function matchesRisk(riskScore: number, level: RiskLevel): boolean {
  if (level === "all") return true;
  const def = RISK_LEVELS.find((r) => r.key === level);
  if (!def) return true;
  if (def.min !== undefined && riskScore < def.min) return false;
  if (def.max !== undefined && riskScore > def.max) return false;
  return true;
}

export function getCategoryConfig(key: CategoryKey) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
}
