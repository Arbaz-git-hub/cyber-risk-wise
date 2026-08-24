import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Coins, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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
import { assetsQuery, investmentsQuery, threatsQuery, vulnsQuery } from "@/lib/queries";
import { computeRisk, formatCurrency, optimizeInvestments } from "@/lib/risk";

export const Route = createFileRoute("/investments")({
  head: () => ({
    meta: [
      { title: "Investment Optimizer — CyberRisk AI" },
      {
        name: "description",
        content:
          "Rank security controls by avoided loss per dollar and pick the highest-ROI portfolio within your budget.",
      },
      { property: "og:title", content: "Investment Optimizer — CyberRisk AI" },
      {
        property: "og:description",
        content: "Budget-constrained security investment optimization with ROI ranking.",
      },
    ],
  }),
  component: InvestmentsPage,
});

const CATEGORIES = ["Detection", "Identity", "Resilience", "AppSec", "Network", "People", "Transfer"];
const STATUSES = ["proposed", "active", "rejected"];

function InvestmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [assets, threats, vulns, investments] = useQueries({
    queries: [assetsQuery, threatsQuery, vulnsQuery, investmentsQuery],
  });
  const [budget, setBudget] = useState(600000);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: CATEGORIES[0]!,
    cost_usd: 100000,
    risk_reduction_pct: 10,
    status: "proposed",
  });

  const list = investments.data ?? [];
  const risk = useMemo(
    () => computeRisk(assets.data ?? [], threats.data ?? [], vulns.data ?? [], list),
    [assets.data, threats.data, vulns.data, list],
  );

  const optimized = useMemo(() => optimizeInvestments(list, risk.ale, budget), [list, risk.ale, budget]);

  const chartData = optimized.picks.map((p) => ({
    name: p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name,
    roi: Math.round(p.roi * 100),
    selected: p.selected,
  }));

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("investments").insert({ ...form, user_id: user!.id });
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: investmentsQuery.queryKey });
      setOpen(false);
      toast.success("Control added to the portfolio");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("investments").update({ status }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: investmentsQuery.queryKey }),
    onError: (e: Error) => toast.error(e.message),
  });

  const activateOptimal = useMutation({
    mutationFn: async () => {
      const ids = optimized.picks.filter((p) => p.selected).map((p) => p.id);
      if (ids.length === 0) throw new Error("No controls fit the current budget");
      const { error } = await supabase.from("investments").update({ status: "active" }).in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: async () => {
      await qc.invalidateQueries();
      toast.success("Optimal portfolio activated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isLoading = investments.isLoading;

  return (
    <AppShell
      title="Investment Optimizer"
      subtitle="Maximize avoided loss per dollar within a fixed security budget"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="size-4" /> Add control
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a candidate control</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="iname">Control name</Label>
                <Input
                  id="iname"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Managed EDR + 24/7 SOC"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
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
                  <Label htmlFor="icost">Annual cost (USD)</Label>
                  <Input
                    id="icost"
                    type="number"
                    value={form.cost_usd}
                    onChange={(e) => setForm({ ...form, cost_usd: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Expected risk reduction — {form.risk_reduction_pct}%</Label>
                <Slider
                  value={[form.risk_reduction_pct]}
                  max={40}
                  step={1}
                  onValueChange={([v]) => setForm({ ...form, risk_reduction_pct: v ?? 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="capitalize">
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
              <Button
                className="w-full"
                disabled={!form.name || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save control"}
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
      ) : list.length === 0 ? (
        <EmptyState
          title="No candidate controls"
          description="Add the security controls you are considering, with cost and expected risk reduction, to run the optimizer."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              label="Annualized loss exposure"
              value={formatCurrency(risk.ale)}
              icon={<Coins className="size-4" />}
            />
            <StatCard label="Optimized spend" value={formatCurrency(optimized.totalCost)} token="medium" />
            <StatCard
              label="Avoided loss"
              value={formatCurrency(optimized.totalAvoided)}
              token="low"
              icon={<TrendingUp className="size-4" />}
            />
            <StatCard
              label="Portfolio ROI"
              value={
                optimized.totalCost > 0
                  ? `${Math.round(((optimized.totalAvoided - optimized.totalCost) / optimized.totalCost) * 100)}%`
                  : "—"
              }
              token="low"
            />
          </div>

          <Card className="panel p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-[260px] flex-1">
                <Label>Security budget — {formatCurrency(budget)}</Label>
                <Slider
                  className="mt-3"
                  value={[budget]}
                  min={50000}
                  max={2000000}
                  step={25000}
                  onValueChange={([v]) => setBudget(v ?? 0)}
                />
              </div>
              <Button
                variant="outline"
                className="gap-2"
                disabled={activateOptimal.isPending}
                onClick={() => activateOptimal.mutate()}
              >
                {activateOptimal.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <TrendingUp className="size-4" />
                )}
                Activate optimal set
              </Button>
            </div>
            <div className="mt-6 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} unit="%" />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => [`${v}%`, "ROI"]}
                  />
                  <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.name} fill={d.selected ? "var(--chart-1)" : "var(--muted)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="panel p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Control</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Risk −</TableHead>
                  <TableHead className="text-right">Avoided loss</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead>In optimal set</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {optimized.picks.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.category}</TableCell>
                    <TableCell className="mono-nums text-right">{formatCurrency(p.cost_usd)}</TableCell>
                    <TableCell className="mono-nums text-right">{p.risk_reduction_pct}%</TableCell>
                    <TableCell className="mono-nums text-right">{formatCurrency(p.avoidedLoss)}</TableCell>
                    <TableCell className="mono-nums text-right">{Math.round(p.roi * 100)}%</TableCell>
                    <TableCell>
                      {p.selected ? (
                        <SeverityBadge token="low">selected</SeverityBadge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={p.status}
                        onValueChange={(s) => setStatus.mutate({ id: p.id, status: s })}
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
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
