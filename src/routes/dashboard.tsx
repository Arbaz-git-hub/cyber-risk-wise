import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Coins, Bug, Radar, Sparkles, Loader2, Database } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState, RiskGauge, SeverityBadge, StatCard } from "@/components/risk/RiskWidgets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import {
  assetsQuery,
  investmentsQuery,
  profileQuery,
  seedSamplePortfolio,
  threatsQuery,
  vulnsQuery,
} from "@/lib/queries";
import {
  computeRisk,
  formatCurrency,
  formatPercent,
  projectExposure,
  riskBand,
  severityToken,
} from "@/lib/risk";
import { generateRecommendations, type AiRecommendations } from "@/lib/ai.functions";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Risk Overview — CyberRisk AI" },
      {
        name: "description",
        content:
          "Live cyber risk score, annualized loss exposure, threat pressure and control coverage for your organization.",
      },
      { property: "og:title", content: "Risk Overview — CyberRisk AI" },
      { property: "og:description", content: "Live quantified cyber risk overview." },
    ],
  }),
  component: Dashboard;
});

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [ai, setAi] = useState<AiRecommendations | null>(null);
  const recommend = useServerFn(generateRecommendations);

  const [assets, threats, vulns, investments, profile] = useQueries({
    queries: [assetsQuery, threatsQuery, vulnsQuery, investmentsQuery, profileQuery],
  });

  const data = {
    assets: assets.data ?? [],
    threats: threats.data ?? [],
    vulns: vulns.data ?? [],
    investments: investments.data ?? [],
  };

  const risk = useMemo(
    () => computeRisk(data.assets, data.threats, data.vulns, data.investments),
    [data.assets, data.threats, data.vulns, data.investments],
  );

  const trend = useMemo(() => projectExposure(risk.ale, risk.coverage), [risk.ale, risk.coverage]);

  const lossByAsset = useMemo(
    () =>
      data.assets.slice(0, 6).map((a) => ({
        name: a.name.length > 16 ? `${a.name.slice(0, 15)}…` : a.name,
        exposure: Math.round(a.value_usd),
      })),
    [data.assets],
  );

  const threatMix = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of data.threats) map.set(t.category, (map.get(t.category) ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [data.threats]);

  const seeding = useMutation({
    mutationFn: () => seedSamplePortfolio(user!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Sample risk portfolio loaded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const aiRun = useMutation({
    mutationFn: () =>
      recommend({
        data: {
          orgName: profile.data?.org_name ?? "the organization",
          industry: profile.data?.industry ?? "Technology",
          riskScore: risk.riskScore,
          ale: Math.round(risk.ale),
          residualAle: Math.round(risk.residualAle),
          coverage: risk.coverage,
          openVulns: risk.openVulns,
          activeThreats: risk.activeThreats,
          exposedValue: Math.round(risk.exposedValue),
          budget: 500000,
          topThreats: data.threats.slice(0, 8).map((t) => ({
            name: t.name,
            likelihood: t.likelihood,
            severity: t.severity,
          })),
          topVulns: data.vulns.slice(0, 8).map((v) => ({
            title: v.title,
            cvss: v.cvss,
            status: v.status,
          })),
          candidateControls: data.investments.slice(0, 12).map((i) => ({
            name: i.name,
            cost_usd: i.cost_usd,
            risk_reduction_pct: i.risk_reduction_pct,
            status: i.status,
          })),
        },
      }),
    onSuccess: (result) => setAi(result),
    onError: (e: Error) => toast.error(e.message || "AI analysis failed"),
  });

  const isLoading = assets.isLoading || threats.isLoading || vulns.isLoading;
  const isEmpty = !isLoading && data.assets.length === 0 && data.threats.length === 0;
  const band = riskBand(risk.riskScore);

  return (
    <AppShell
      title="Risk Overview"
      subtitle={`${profile.data?.org_name ?? "Your organization"} · continuous quantification`}
      actions={
        <>
          {isEmpty ? null : (
            <Button
              size="sm"
              className="gap-2"
              disabled={aiRun.isPending}
              onClick={() => aiRun.mutate()}
            >
              {aiRun.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              AI recommendations
            </Button>
          )}
        </>
      }
    >
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : isEmpty ? (
        <EmptyState
          title="No risk data yet"
          description="Load a realistic sample portfolio of assets, threats, vulnerabilities and security controls to see quantification in action — then edit or replace it with your own."
          action={
            <Button
              className="gap-2"
              disabled={seeding.isPending}
              onClick={() => seeding.mutate()}
            >
              {seeding.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Database className="size-4" />
              )}
              Load sample portfolio
            </Button>
          }
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Annualized loss exposure"
              value={formatCurrency(risk.ale)}
              hint={`SLE ${formatCurrency(risk.sle)} × ARO ${risk.aro.toFixed(2)}`}
              icon={<Coins className="size-4" />}
            />
            <StatCard
              label="Residual exposure"
              value={formatCurrency(risk.residualAle)}
              hint={`${formatPercent(risk.coverage)} mitigated by active controls`}
              icon={<Activity className="size-4" />}
              token="low"
            />
            <StatCard
              label="Active threats"
              value={String(risk.activeThreats)}
              hint={`${data.threats.length} tracked total`}
              icon={<Radar className="size-4" />}
              token="high"
            />
            <StatCard
              label="Open vulnerabilities"
              value={String(risk.openVulns)}
              hint={`${data.vulns.length} findings tracked`}
              icon={<Bug className="size-4" />}
              token="critical"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="panel p-5">
              <h2 className="text-sm font-semibold">Composite risk score</h2>
              <div className="mt-4">
                <RiskGauge score={risk.riskScore} />
              </div>
              <div className="mt-4 space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Control coverage</span>
                    <span className="mono-nums">{formatPercent(risk.coverage)}</span>
                  </div>
                  <Progress value={risk.coverage} className="mt-1.5" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Posture is <SeverityBadge token={band.token}>{band.label}</SeverityBadge> — driven by
                  threat pressure, vulnerability depth and exposed asset value.
                </p>
              </div>
            </Card>

            <Card className="panel p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold">Projected 12-month loss exposure</h2>
              <p className="text-xs text-muted-foreground">Inherent vs residual after control ramp-up</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="inherentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.03} />
                      </linearGradient>
                      <linearGradient id="residualFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.03} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v: number) => formatCurrency(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--popover-foreground)",
                      }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      name="Inherent"
                      dataKey="inherent"
                      stroke="var(--chart-3)"
                      fill="url(#inherentFill)"
                    />
                    <Area
                      type="monotone"
                      name="Residual"
                      dataKey="residual"
                      stroke="var(--chart-1)"
                      fill="url(#residualFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="panel p-5 lg:col-span-2">
              <h2 className="text-sm font-semibold">Exposed value by asset</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={lossByAsset}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickFormatter={(v: number) => formatCurrency(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                      formatter={(v: number) => formatCurrency(v)}
                    />
                    <Bar dataKey="exposure" name="Exposure" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="panel p-5">
              <h2 className="text-sm font-semibold">Threat mix</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={threatMix} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                      {threatMix.map((entry, i) => (
                        <Cell key={entry.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <Card className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">AI recommendations</h2>
                <p className="text-xs text-muted-foreground">
                  Generated from your live exposure, threat pressure and control portfolio.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={aiRun.isPending}
                onClick={() => aiRun.mutate()}
              >
                {aiRun.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {ai ? "Regenerate" : "Analyze"}
              </Button>
            </div>

            {ai ? (
              <div className="mt-4 space-y-4">
                <p className="rounded-md border border-primary/25 bg-primary/5 p-3 text-sm">
                  {ai.executiveSummary}
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  {ai.recommendations.map((r) => (
                    <div key={r.title} className="rounded-md border border-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-medium">{r.title}</h3>
                        <SeverityBadge token={r.priority}>{r.priority}</SeverityBadge>
                      </div>
                      <p className="mt-1.5 text-sm text-muted-foreground">{r.rationale}</p>
                      <div className="mono-nums mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>−{Math.round(r.expectedRiskReductionPct)}% risk</span>
                        <span>{formatCurrency(r.estimatedCostUsd)}</span>
                        <span>{r.timeframe}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Run an analysis to get prioritized, budget-aware next actions.
              </p>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
