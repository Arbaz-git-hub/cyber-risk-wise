import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Asset, Investment, Threat, Vulnerability } from "./risk";

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const assetsQuery = queryOptions({
  queryKey: ["assets"],
  queryFn: () =>
    unwrap<Asset[]>(supabase.from("assets").select("*").order("value_usd", { ascending: false })),
});

export const threatsQuery = queryOptions({
  queryKey: ["threats"],
  queryFn: () =>
    unwrap<Threat[]>(supabase.from("threats").select("*").order("detected_at", { ascending: false })),
});

export const vulnsQuery = queryOptions({
  queryKey: ["vulnerabilities"],
  queryFn: () =>
    unwrap<Vulnerability[]>(supabase.from("vulnerabilities").select("*").order("cvss", { ascending: false })),
});

export const investmentsQuery = queryOptions({
  queryKey: ["investments"],
  queryFn: () =>
    unwrap<Investment[]>(supabase.from("investments").select("*").order("cost_usd", { ascending: false })),
});

export interface ReportRow {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  created_at: string;
}

export const reportsQuery = queryOptions({
  queryKey: ["reports"],
  queryFn: () =>
    unwrap<ReportRow[]>(supabase.from("reports").select("*").order("created_at", { ascending: false })),
});

export interface ProfileRow {
  id: string;
  email: string | null;
  org_name: string;
  industry: string;
  annual_revenue: number;
}

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
    if (error) throw new Error(error.message);
    return (data as ProfileRow | null) ?? null;
  },
});

/** Seeds a realistic sample portfolio for the signed-in user. */
export async function seedSamplePortfolio(userId: string) {
  const assets = [
    { name: "Customer Data Warehouse", category: "Data", criticality: "critical", value_usd: 4200000 },
    { name: "Payment Gateway", category: "Application", criticality: "critical", value_usd: 3100000 },
    { name: "Corporate Email (M365)", category: "SaaS", criticality: "high", value_usd: 1250000 },
    { name: "Kubernetes Production Cluster", category: "Infrastructure", criticality: "high", value_usd: 2400000 },
    { name: "HR Records System", category: "Application", criticality: "medium", value_usd: 680000 },
    { name: "Marketing Website", category: "Application", criticality: "low", value_usd: 220000 },
  ].map((a) => ({ ...a, user_id: userId }));

  const { data: insertedAssets, error: assetError } = await supabase
    .from("assets")
    .insert(assets)
    .select("id, name");
  if (assetError) throw new Error(assetError.message);

  const idOf = (name: string) =>
    (insertedAssets ?? []).find((a: { name: string; id: string }) => a.name === name)?.id ?? null;

  const threats = [
    { name: "Ransomware-as-a-Service campaign", category: "Ransomware", likelihood: 72, severity: 92, status: "active" },
    { name: "Credential phishing against finance", category: "Phishing", likelihood: 84, severity: 66, status: "active" },
    { name: "Third-party library supply chain compromise", category: "Supply Chain", likelihood: 41, severity: 88, status: "monitoring" },
    { name: "Insider data exfiltration", category: "Insider", likelihood: 26, severity: 78, status: "monitoring" },
    { name: "Volumetric DDoS on edge", category: "DDoS", likelihood: 55, severity: 40, status: "mitigated" },
  ].map((t) => ({ ...t, user_id: userId }));

  const vulns = [
    { title: "Unauthenticated RCE in ingress controller", cve_id: "CVE-2026-21882", cvss: 9.8, status: "open", remediation_cost_usd: 45000, asset_id: idOf("Kubernetes Production Cluster") },
    { title: "SQL injection in reporting endpoint", cve_id: "CVE-2026-11204", cvss: 8.6, status: "open", remediation_cost_usd: 28000, asset_id: idOf("Customer Data Warehouse") },
    { title: "Weak TLS ciphers on payment API", cve_id: null, cvss: 6.4, status: "in_progress", remediation_cost_usd: 12000, asset_id: idOf("Payment Gateway") },
    { title: "Legacy IMAP auth enabled", cve_id: null, cvss: 7.1, status: "open", remediation_cost_usd: 9000, asset_id: idOf("Corporate Email (M365)") },
    { title: "Missing MFA on HR admin console", cve_id: null, cvss: 5.9, status: "in_progress", remediation_cost_usd: 6000, asset_id: idOf("HR Records System") },
    { title: "Outdated CMS plugin", cve_id: "CVE-2025-40711", cvss: 4.2, status: "resolved", remediation_cost_usd: 1500, asset_id: idOf("Marketing Website") },
  ].map((v) => ({ ...v, user_id: userId }));

  const investments = [
    { name: "Managed EDR + 24/7 SOC", category: "Detection", cost_usd: 320000, risk_reduction_pct: 22, status: "active" },
    { name: "Phishing-resistant MFA rollout", category: "Identity", cost_usd: 140000, risk_reduction_pct: 18, status: "active" },
    { name: "Immutable backup & recovery tier", category: "Resilience", cost_usd: 210000, risk_reduction_pct: 16, status: "proposed" },
    { name: "SAST/DAST in CI pipeline", category: "AppSec", cost_usd: 95000, risk_reduction_pct: 9, status: "proposed" },
    { name: "Zero-trust network segmentation", category: "Network", cost_usd: 480000, risk_reduction_pct: 24, status: "proposed" },
    { name: "Security awareness program", category: "People", cost_usd: 45000, risk_reduction_pct: 6, status: "proposed" },
    { name: "Cyber insurance top-up", category: "Transfer", cost_usd: 260000, risk_reduction_pct: 11, status: "proposed" },
  ].map((i) => ({ ...i, user_id: userId }));

  const results = await Promise.all([
    supabase.from("threats").insert(threats),
    supabase.from("vulnerabilities").insert(vulns),
    supabase.from("investments").insert(investments),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}
