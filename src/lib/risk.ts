export type Criticality = "low" | "medium" | "high" | "critical";

export interface Asset {
  id: string;
  name: string;
  category: string;
  criticality: string;
  value_usd: number;
}

export interface Threat {
  id: string;
  name: string;
  category: string;
  likelihood: number;
  severity: number;
  status: string;
  detected_at: string;
}

export interface Vulnerability {
  id: string;
  title: string;
  cve_id: string | null;
  cvss: number;
  asset_id: string | null;
  status: string;
  remediation_cost_usd: number;
  discovered_at: string;
}

export interface Investment {
  id: string;
  name: string;
  category: string;
  cost_usd: number;
  risk_reduction_pct: number;
  status: string;
}

const CRITICALITY_WEIGHT: Record<string, number> = {
  low: 0.5,
  medium: 1,
  high: 1.6,
  critical: 2.4,
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: value >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value || 0);

export const formatPercent = (value: number) => `${Math.round(value)}%`;

/** Annualized rate of occurrence, derived from active threat pressure. */
export function annualRate(threats: Threat[]) {
  const active = threats.filter((t) => t.status !== "mitigated");
  if (active.length === 0) return 0;
  const pressure =
    active.reduce((sum, t) => sum + (t.likelihood / 100) * (t.severity / 100), 0) / active.length;
  return Math.min(4, pressure * active.length * 0.55);
}

/** Single loss expectancy: exposed asset value weighted by criticality and vuln depth. */
export function singleLossExpectancy(assets: Asset[], vulns: Vulnerability[]) {
  const exposure = assets.reduce(
    (sum, a) => sum + a.value_usd * (CRITICALITY_WEIGHT[a.criticality] ?? 1),
    0,
  );
  const open = vulns.filter((v) => v.status !== "resolved");
  const depth = open.length
    ? Math.min(0.6, open.reduce((s, v) => s + v.cvss, 0) / (open.length * 10) * 0.6)
    : 0.05;
  return exposure * depth;
}

export interface RiskSummary {
  riskScore: number;
  ale: number;
  sle: number;
  aro: number;
  openVulns: number;
  activeThreats: number;
  exposedValue: number;
  mitigatedRisk: number;
  residualAle: number;
  coverage: number;
}

export function computeRisk(
  assets: Asset[],
  threats: Threat[],
  vulns: Vulnerability[],
  investments: Investment[],
): RiskSummary {
  const aro = annualRate(threats);
  const sle = singleLossExpectancy(assets, vulns);
  const ale = sle * aro;

  const activeReduction = investments
    .filter((i) => i.status === "active")
    .reduce((s, i) => s + i.risk_reduction_pct, 0);
  const coverage = Math.min(85, activeReduction);
  const residualAle = ale * (1 - coverage / 100);

  const exposedValue = assets.reduce((s, a) => s + a.value_usd, 0);
  const openVulns = vulns.filter((v) => v.status !== "resolved").length;
  const activeThreats = threats.filter((t) => t.status !== "mitigated").length;

  const rawScore =
    Math.min(40, aro * 12) +
    Math.min(35, (openVulns ? vulns.reduce((s, v) => s + v.cvss, 0) / vulns.length : 0) * 3.5) +
    Math.min(25, exposedValue > 0 ? (residualAle / Math.max(exposedValue, 1)) * 100 : 0);

  return {
    riskScore: Math.round(Math.max(assets.length ? 6 : 0, Math.min(100, rawScore))),
    ale,
    sle,
    aro,
    openVulns,
    activeThreats,
    exposedValue,
    mitigatedRisk: ale - residualAle,
    residualAle,
    coverage,
  };
}

export function riskBand(score: number): { label: string; token: Criticality } {
  if (score >= 75) return { label: "Critical", token: "critical" };
  if (score >= 50) return { label: "High", token: "high" };
  if (score >= 25) return { label: "Moderate", token: "medium" };
  return { label: "Low", token: "low" };
}

export function severityToken(cvss: number): Criticality {
  if (cvss >= 9) return "critical";
  if (cvss >= 7) return "high";
  if (cvss >= 4) return "medium";
  return "low";
}

export interface OptimizedPick extends Investment {
  avoidedLoss: number;
  roi: number;
  selected: boolean;
}

/**
 * Greedy budget optimizer: ranks candidate controls by avoided loss per dollar
 * and selects the set that fits the budget.
 */
export function optimizeInvestments(
  investments: Investment[],
  ale: number,
  budget: number,
): { picks: OptimizedPick[]; totalCost: number; totalAvoided: number } {
  const ranked = investments
    .map((i) => {
      const avoidedLoss = ale * (i.risk_reduction_pct / 100);
      return {
        ...i,
        avoidedLoss,
        roi: i.cost_usd > 0 ? (avoidedLoss - i.cost_usd) / i.cost_usd : 0,
        selected: false,
      };
    })
    .sort((a, b) => b.roi - a.roi);

  let spent = 0;
  let avoided = 0;
  for (const item of ranked) {
    if (spent + item.cost_usd <= budget) {
      item.selected = true;
      spent += item.cost_usd;
      avoided += item.avoidedLoss;
    }
  }
  return { picks: ranked, totalCost: spent, totalAvoided: avoided };
}

/** 12-month projected residual loss exposure trend. */
export function projectExposure(ale: number, coverage: number) {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return months.map((month, i) => {
    const seasonal = 1 + Math.sin((i / 11) * Math.PI * 2) * 0.14;
    const inherent = (ale / 12) * seasonal;
    const rampedCoverage = (coverage / 100) * Math.min(1, (i + 1) / 8);
    return {
      month,
      inherent: Math.round(inherent),
      residual: Math.round(inherent * (1 - rampedCoverage)),
    };
  });
}
