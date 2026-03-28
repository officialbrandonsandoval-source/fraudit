import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 11, color: "#666" },
  npi: { fontSize: 9, color: "#888", marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginBottom: 6, color: "#dc2626", borderBottom: "1 solid #e5e5e5", paddingBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottom: "0.5 solid #f0f0f0" },
  rowLabel: { color: "#666", fontSize: 9 },
  rowValue: { fontWeight: "bold", fontSize: 10 },
  riskBox: { padding: 12, backgroundColor: "#fef2f2", borderRadius: 4, marginBottom: 16 },
  riskScore: { fontSize: 28, fontWeight: "bold", color: "#dc2626" },
  riskLabel: { fontSize: 10, color: "#666", marginTop: 2 },
  anomalyItem: { flexDirection: "row", marginBottom: 4 },
  anomalyBullet: { color: "#dc2626", marginRight: 6, fontSize: 10 },
  anomalyText: { fontSize: 9, color: "#333", flex: 1 },
  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f5", padding: 6, marginBottom: 2 },
  tableHeaderText: { fontSize: 8, fontWeight: "bold", color: "#666" },
  tableRow: { flexDirection: "row", padding: 6, borderBottom: "0.5 solid #f0f0f0" },
  tableCell: { fontSize: 9 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTop: "1 solid #e5e5e5", paddingTop: 8, fontSize: 7, color: "#999", textAlign: "center" },
  programBadge: { backgroundColor: "#f0f0f0", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, fontSize: 8, marginBottom: 4 },
  programsRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
});

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

function formatDollar(amount: number): string {
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function DossierDocument({ provider, date }: { provider: DossierProvider; date: string }) {
  const sorted = [...(provider.billingHistory || [])].sort((a, b) => a.year - b.year);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{provider.name}</Text>
          <Text style={styles.subtitle}>
            {provider.address}, {provider.city}, {provider.state} {provider.zip}
          </Text>
          {provider.npi && <Text style={styles.npi}>NPI: {provider.npi}</Text>}
          <View style={styles.programsRow}>
            {provider.programs.map((p, i) => (
              <Text key={i} style={styles.programBadge}>{p}</Text>
            ))}
          </View>
        </View>

        {/* Risk Score */}
        <View style={styles.riskBox}>
          <Text style={styles.riskScore}>{provider.riskScore}/100</Text>
          <Text style={styles.riskLabel}>
            Fraud Risk Score — {provider.riskScore >= 60 ? "HIGH RISK" : provider.riskScore >= 30 ? "ELEVATED" : "LOWER RISK"}
          </Text>
        </View>

        {/* Anomaly Flags */}
        {provider.anomalies.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fraud Signal Summary</Text>
            {provider.anomalies.map((a, i) => (
              <View key={i} style={styles.anomalyItem}>
                <Text style={styles.anomalyBullet}>⚠</Text>
                <Text style={styles.anomalyText}>{a}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Metrics</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total Medicare Payments</Text>
            <Text style={styles.rowValue}>{formatDollar(provider.totalPaid)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Programs</Text>
            <Text style={styles.rowValue}>{provider.programs.join(", ")}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Provider ID</Text>
            <Text style={styles.rowValue}>{provider.id}</Text>
          </View>
        </View>

        {/* Billing History */}
        {sorted.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Annual Billing History</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: "30%" }]}>Year</Text>
              <Text style={[styles.tableHeaderText, { width: "40%" }]}>Amount</Text>
              <Text style={[styles.tableHeaderText, { width: "30%" }]}>YoY Change</Text>
            </View>
            {sorted.map((entry, i) => {
              const prev = i > 0 ? sorted[i - 1].amount : null;
              const change = prev ? ((entry.amount - prev) / prev) * 100 : null;
              return (
                <View key={entry.year} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: "30%" }]}>{entry.year}</Text>
                  <Text style={[styles.tableCell, { width: "40%" }]}>{formatDollar(entry.amount)}</Text>
                  <Text style={[styles.tableCell, { width: "30%", color: change && change > 50 ? "#dc2626" : "#333" }]}>
                    {change !== null ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated by Fraudit.com | {date} | Data sourced from CMS, OIG, SAM.gov, SBA</Text>
        </View>
      </Page>
    </Document>
  );
}
