import { supabase } from "@/lib/supabase";
import HomeClient from "./HomeClient";

export const revalidate = 60;

export default async function Home() {
  const [totalRes, flaggedRes, tipRes, top50Res] = await Promise.all([
    supabase.from("Provider").select("id", { count: "exact" }).limit(1),
    supabase.from("Provider").select("id", { count: "exact" }).gte("riskScore", 70).limit(1),
    supabase.from("Tip").select("id", { count: "exact" }).limit(1),
    supabase
      .from("Provider")
      .select("id, name, address, city, state, zip, programs, totalPaid, riskScore, anomalies")
      .order("riskScore", { ascending: false })
      .limit(50),
  ]);

  const TOTAL_ALL_PAID = 64_725_299_374;

  const stats = {
    totalProviders: totalRes.count ?? 0,
    totalAllPaid: TOTAL_ALL_PAID,
    totalFlagged: flaggedRes.count ?? 0,
    totalTips: tipRes.count ?? 0,
  };

  const top50 = top50Res.data ?? [];

  return <HomeClient initialStats={stats} initialTop50={top50} />;
}
