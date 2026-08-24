import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, Sparkles, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/risk/RiskWidgets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  assetsQuery,
  investmentsQuery,
  profileQuery,
  reportsQuery,
  threatsQuery,
  vulnsQuery,
  type ReportRow,
} from "@/lib/queries";
import { computeRisk } from "@/lib/risk";
import { generateRiskReport } from "@/lib/ai.functions";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Risk Reports — CyberRisk AI" },
      {
        name: "description",
        content:
          "Generate board-ready quantified cyber risk reports with financial exposure, control effectiveness and a 90-day roadmap.",
      },
      { property: "og:title", content: "Risk Reports — CyberRisk AI" },
      { property: "og:description", content: "AI-generated executive cyber risk reports." },
    ],
  }),
  component: ReportsPage,
});

function renderMarkdown(md: string) {
  return md.split("\n").map((line, i) => {
    if (line.startsWith("### ")) {
      return (
        <h3 key={i} className="mt-4 text-sm font-semibold">
          {line.slice(4)}
        </h3>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={i} className="mt-6 text-base font-semibold text-primary">
          {line.slice(3)}
        </h2>
      );
    }
    if (line.startsWith("# ")) {
      return (
        <h1 key={i} className="mt-6 text-lg font-semibold">
          {line.slice(2)}
        </h1>
      );
    }
    if (/^[-*] /.test(line)) {
      return (
        <li key={i} className="ml-5 list-disc text-sm text-muted-foreground">
          {line.slice(2)}
        </li>
      );
    }
    if (line.trim() === "") return <div key={i} className="h-2" />;
    return (
      <p key={i} className="text-sm text-muted-foreground">
        {line}
      </p>
    );
  });
}

function ReportsPage() {
  const qc = useQueryClient();
  const generate = useServerFn(generateRiskReport);
  const { data: reports = [], isLoading } = useQuery(reportsQuery);
  const [assets, threats, vulns, investments] = useQueries({
    queries: [assetsQuery, threatsQuery, vulnsQuery, investmentsQuery],
  });
  const { data: profile } = useQuery(profileQuery);
  const [active, setActive] = useState<ReportRow | null>(null);

  const risk = useMemo(
    () =>
      computeRisk(
        assets.data ?? [],
        threats.data ?? [],
        vulns.data ?? [],
        investments.data ?? [],
      ),
    [assets.data, threats.data, vulns.data, investments.data],
  );

  const create = useMutation({
    mutationFn: () =>
      generate({
        data: {
          orgName: profile?.org_name ?? "the organization",
          industry: profile?.industry ?? "Technology",
          riskScore: risk.riskScore,
          ale: Math.round(risk.ale),
          residualAle: Math.round(risk.residualAle),
          coverage: risk.coverage,
          openVulns: risk.openVulns,
          activeThreats: risk.activeThreats,
          exposedValue: Math.round(risk.exposedValue),
          topThreats: (threats.data ?? [])
            .slice(0, 8)
            .map((t) => `${t.name} (likelihood ${t.likelihood}%, severity ${t.severity})`),
          topVulns: (vulns.data ?? [])
            .slice(0, 8)
            .map((v) => `${v.title} — CVSS ${v.cvss} (${v.status})`),
          activeControls: (investments.data ?? [])
            .filter((i) => i.status === "active")
            .slice(0, 12)
            .map((i) => `${i.name} (−${i.risk_reduction_pct}% risk, $${Math.round(i.cost_usd)})`),
        },
      }),
    onSuccess: async (report) => {
      await qc.invalidateQueries({ queryKey: reportsQuery.queryKey });
      setActive({
        id: "new",
        title: report.title,
        summary: report.summary,
        content: report.content,
        created_at: new Date().toISOString(),
      });
      toast.success("Report generated");
    },
    onError: (e: Error) => toast.error(e.message || "Report generation failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: reportsQuery.queryKey });
      setActive(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const download = (report: ReportRow) => {
    const blob = new Blob([`# ${report.title}\n\n${report.content}`], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="Risk Reports"
      subtitle="Board-ready quantification reports generated from live data"
      actions={
        <Button size="sm" className="gap-2" disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate report
        </Button>
      }
    >
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : reports.length === 0 && !active ? (
        <EmptyState
          title="No reports yet"
          description="Generate an executive report to capture today's quantified exposure, control effectiveness and a prioritized 90-day roadmap."
          action={
            <Button className="gap-2" disabled={create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate first report
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <div className="space-y-3">
            {reports.map((r) => (
              <Card
                key={r.id}
                className={`panel cursor-pointer gap-1 p-4 transition-colors ${
                  active?.id === r.id ? "glow" : ""
                }`}
                onClick={() => setActive(r)}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{r.title}</p>
                  <FileText className="size-4 shrink-0 text-primary" />
                </div>
                <p className="mono-nums text-xs text-muted-foreground">{r.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>

          <Card className="panel p-6">
            {active ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
                  <div>
                    <h2 className="text-base font-semibold">{active.title}</h2>
                    <p className="mono-nums text-xs text-muted-foreground">{active.summary}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-2" onClick={() => download(active)}>
                      <Download className="size-4" /> Markdown
                    </Button>
                    {active.id !== "new" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-2 text-destructive"
                        onClick={() => remove.mutate(active.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4">{renderMarkdown(active.content)}</div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Select a report on the left to read it, or generate a new one.
              </p>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
}
