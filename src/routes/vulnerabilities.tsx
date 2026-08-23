import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Bug } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { EmptyState, SeverityBadge, StatCard } from "@/components/risk/RiskWidgets";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { assetsQuery, vulnsQuery } from "@/lib/queries";
import { formatCurrency, severityToken } from "@/lib/risk";

export const Route = createFileRoute("/vulnerabilities")({
  head: () => ({
    meta: [
      { title: "Vulnerability Tracking — CyberRisk AI" },
      {
        name: "description",
        content:
          "Track CVEs and findings by CVSS severity, affected asset, remediation cost and status.",
      },
      { property: "og:title", content: "Vulnerability Tracking — CyberRisk AI" },
      { property: "og:description", content: "CVSS-scored vulnerability register with remediation cost." },
    ],
  }),
  component: VulnPage,
});

const STATUSES = ["open", "in_progress", "resolved"];

function VulnPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: vulns = [], isLoading } = useQuery(vulnsQuery);
  const { data: assets = [] } = useQuery(assetsQuery);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    cve_id: "",
    cvss: 7,
    asset_id: "",
    status: "open",
    remediation_cost_usd: 10000,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("vulnerabilities").insert({
        title: form.title,
        cve_id: form.cve_id || null,
        cvss: form.cvss,
        asset_id: form.asset_id || null,
        status: form.status,
        remediation_cost_usd: form.remediation_cost_usd,
        user_id: user!.id,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: vulnsQuery.queryKey });
      setOpen(false);
      toast.success("Finding added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("vulnerabilities").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: vulnsQuery.queryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const openVulns = vulns.filter((v) => v.status !== "resolved");
  const criticalCount = openVulns.filter((v) => v.cvss >= 9).length;
  const remediationBacklog = openVulns.reduce((s, v) => s + v.remediation_cost_usd, 0);
  const assetName = (id: string | null) => assets.find((a) => a.id === id)?.name ?? "—";

  return (
    <AppShell
      title="Vulnerability Tracking"
      subtitle="CVSS-weighted findings feeding the loss model"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" /> Add finding
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a vulnerability finding</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vtitle">Title</Label>
                <Input
                  id="vtitle"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Unauthenticated RCE in ingress controller"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="cve">CVE ID (optional)</Label>
                  <Input
                    id="cve"
                    value={form.cve_id}
                    onChange={(e) => setForm({ ...form, cve_id: e.target.value })}
                    placeholder="CVE-2026-1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Remediation cost (USD)</Label>
                  <Input
                    id="cost"
                    type="number"
                    value={form.remediation_cost_usd}
                    onChange={(e) =>
                      setForm({ ...form, remediation_cost_usd: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>CVSS — {form.cvss.toFixed(1)}</Label>
                <Slider
                  value={[form.cvss]}
                  max={10}
                  step={0.1}
                  onValueChange={([v]) => setForm({ ...form, cvss: v ?? 0 })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Affected asset</Label>
                  <Select
                    value={form.asset_id}
                    onValueChange={(v) => setForm({ ...form, asset_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select asset" />
                    </SelectTrigger>
                    <SelectContent>
                      {assets.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger className="capitalize">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={!form.title || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save finding"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : vulns.length === 0 ? (
        <EmptyState
          title="No findings tracked"
          description="Add CVEs or internal findings with CVSS scores so exposure depth can be quantified against your assets."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Open findings" value={String(openVulns.length)} icon={<Bug className="size-4" />} />
            <StatCard label="Critical (CVSS ≥ 9)" value={String(criticalCount)} token="critical" />
            <StatCard label="Remediation backlog" value={formatCurrency(remediationBacklog)} token="medium" />
          </div>

          <Card className="panel p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Finding</TableHead>
                  <TableHead>CVE</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">CVSS</TableHead>
                  <TableHead className="text-right">Remediation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vulns.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.title}</TableCell>
                    <TableCell className="mono-nums text-muted-foreground">{v.cve_id ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{assetName(v.asset_id)}</TableCell>
                    <TableCell className="text-right">
                      <SeverityBadge token={severityToken(v.cvss)}>{v.cvss.toFixed(1)}</SeverityBadge>
                    </TableCell>
                    <TableCell className="mono-nums text-right">
                      {formatCurrency(v.remediation_cost_usd)}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={v.status}
                        onValueChange={(s) => setStatus.mutate({ id: v.id, status: s })}
                      >
                        <SelectTrigger className="h-8 w-[140px] capitalize">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s} className="capitalize">
                              {s.replace("_", " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
