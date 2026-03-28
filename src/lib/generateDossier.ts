import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { DossierDocument } from "@/components/DossierTemplate";

interface BillingEntry {
  year: number;
  amount: number;
}

interface DossierProvider {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  programs: string[];
  totalPaid: number;
  riskScore: number;
  anomalies: string[];
  npi: string | null;
  billingHistory: BillingEntry[];
}

export async function generateDossierPdf(provider: DossierProvider): Promise<Buffer> {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(DossierDocument, { provider, date }) as any
  );

  return Buffer.from(buffer);
}
