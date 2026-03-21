import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://fraudit.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date() },
    { url: `${baseUrl}/map`, lastModified: new Date() },
    { url: `${baseUrl}/states`, lastModified: new Date() },
    { url: `${baseUrl}/contact`, lastModified: new Date() },
  ];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data } = await supabase.from("Provider").select("id");

  const providerRoutes: MetadataRoute.Sitemap = (data || []).map((p) => ({
    url: `${baseUrl}/provider/${p.id}`,
    lastModified: new Date(),
  }));

  return [...staticRoutes, ...providerRoutes];
}
