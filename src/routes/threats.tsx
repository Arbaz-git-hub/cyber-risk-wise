import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Radar } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
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
import { threatsQuery } from "@/lib/queries";

export const Route = createFileRoute("/threats")({
  head: () => ({
    meta: [
      { title: "Threat Assessment — CyberRisk AI" },
      {
        name: "description",
        content:
          "Track active threat campaigns with likelihood and impact severity scoring across a quantified heat map.",
      },
      { property: "og:title", content: "Threat Assessment — CyberRisk AI" },
      { property: "og:description", content: "Likelihood vs impact threat assessment heat map." },
    ],
  }),
  component: ThreatsPage,
});

const CATEGORIES = ["Ransomware", "Phishing", "Supply Chain", "Insider", "DDoS", "APT", "Cloud Misconfig"];
const STATUSES = ["active", "monitoring", "mitigated"];

function tokenFor(score: number) {
  if (score >= 60) return "critical";
  if (score >= 40) return "high";
  if (score >= 20) return "medium";
  return "low";
}

function ThreatsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: threats = [], isLoading } = useQuery(threatsQuery);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: CATEGORIES[0]!,
    likelihood: 50,
    severity: 50,
    status: "active",
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("threats").insert({ ...form, user_id: user!.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: threatsQuery.queryKey });
      setOpen(false);
      setForm({ name: "", category: CATEGORIES[0]!, likelihood: 50, severity: 50, status: "active" });
      toast.success("Threat registered");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("threats").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: threatsQuery.queryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const scatter = threats.map((t) => ({
    x: t.likelihood,
    y: t.severity,
    z: (t.likelihood * t.severity) / 100,
    name: t.name,
  }));

  const active = threats.filter((t) => t.status === "active").length;
  const avgRisk = threats.length
    ? Math.round(threats.reduce((s, t) => s + (t.likelihood * t.severity) / 100, 0) / threats.length)
    : 0;

  return (
    <AppShell
      title="Threat Assessment"
      subtitle="Likelihood × impact scoring for every tracked threat scenario"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" /> Add threat
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register a threat scenario</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tname">Threat name</Label>
                <Input
                  id="tname"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ransomware campaign targeting finance"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm({ ...form, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Likelihood — {form.likelihood}%</Label>
                <Slider
                  value={[form.likelihood]}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setForm({ ...form, likelihood: v ?? 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Impact severity — {form.severity}/100</Label>
                <Slider
                  value={[form.severity]}
                  max={100}
                  step={1}
                  onValueChange={([v]) => setForm({ ...form, severity: v ?? 0 })}
                />
              </div>
              <Button
                className="w-full"
                disabled={!form.name || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save threat"}
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
      ) : threats.length === 0 ? (
        <EmptyState
          title="No threats tracked"
          description="Register the threat scenarios relevant to your organization to start driving the quantified risk model."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Tracked threats" value={String(threats.length)} icon={<Radar className="size-4" />} />
            <StatCard label="Active campaigns" value={String(active)} token="critical" />
            <StatCard label="Mean threat risk" value={`${avgRisk}/100`} token={tokenFor(avgRisk)} />
          </div>

          <Card className="panel p-5">
            <h2 className="text-sm font-semibold">Likelihood vs impact heat map</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="x"
                    name="Likelihood"
                    unit="%"
                    domain={[0, 100]}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <YAxis
                    dataKey="y"
                    name="Severity"
                    domain={[0, 100]}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                  />
                  <ZAxis dataKey="z" range={[60, 400]} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                    formatter={(value: number, key: string) => [value, key]}
                  />
                  <Scatter data={scatter} fill="var(--chart-2)" fillOpacity={0.75} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="panel p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Threat</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Likelihood</TableHead>
                  <TableHead className="text-right">Severity</TableHead>
                  <TableHead className="text-right">Risk</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {threats.map((t) => {
                  const score = Math.round((t.likelihood * t.severity) / 100);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-muted-foreground">{t.category}</TableCell>
                      <TableCell className="mono-nums text-right">{t.likelihood}%</TableCell>
                      <TableCell className="mono-nums text-right">{t.severity}</TableCell>
                      <TableCell className="text-right">
                        <SeverityBadge token={tokenFor(score)}>{score}</SeverityBadge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={t.status}
                          onValueChange={(v) => setStatus.mutate({ id: t.id, status: v })}
                        >
                          <SelectTrigger className="h-8 w-[130px] capitalize">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s} className="capitalize">
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
