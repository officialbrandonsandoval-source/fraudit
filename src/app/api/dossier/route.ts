import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateDossierPdf } from "@/lib/generateDossier";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { providerId, email } = body;

  if (!providerId || !email) {
    return NextResponse.json({ error: "Missing providerId or email" }, { status: 400 });
  }

  // Check if user is Pro
  const { data: proUser } = await supabase
    .from("ProUser")
    .select("id, tier, active")
    .eq("email", email)
    .eq("active", true)
    .single();

  if (!proUser) {
    return NextResponse.json(
      { error: "Pro feature", upgradeUrl: "/pricing" },
      { status: 403 }
    );
  }

  // Fetch provider
  const { data: provider, error } = await supabase
    .from("Provider")
    .select("id, name, address, city, state, zip, programs, totalPaid, riskScore, anomalies, npi, billingHistory")
    .eq("id", providerId)
    .single();

  if (error || !provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const pdfBuffer = await generateDossierPdf({
    ...provider,
    billingHistory: Array.isArray(provider.billingHistory) ? provider.billingHistory : [],
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="fraudit-dossier-${provider.id}.pdf"`,
    },
  });
}
