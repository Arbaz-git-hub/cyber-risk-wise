import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { riskBand } from "@/lib/risk";

const TOKEN_TEXT: Record<string, string> = {
  critical: "text-critical",
  high: "text-high",
  medium: "text-medium",
  low: "text-low",
};

const TOKEN_BG: Record<string, string> = {
  critical: "bg-critical/15 text-critical border-critical/30",
  high: "bg-high/15 text-high border-high/30",
  medium: "bg-medium/15 text-medium border-medium/30",
  low: "bg-low/15 text-low border-low/30",
};

export function SeverityBadge({ token, children }: { token: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        TOKEN_BG[token] ?? TOKEN_BG["medium"],
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  token,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  token?: string;
}) {
  return (
    <Card className="panel gap-0 p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground/70">{icon}</span> : null}
      </div>
      <p className={cn("mono-nums mt-2 text-2xl font-semibold", token ? TOKEN_TEXT[token] : undefined)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export function RiskGauge({ score }: { score: number }) {
  const band = riskBand(score);
  const radius = 70;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, score)) / 100);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" className="w-full max-w-[240px]">
        <defs>
          <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--low)" />
            <stop offset="55%" stopColor="var(--medium)" />
            <stop offset="100%" stopColor="var(--critical)" />
          </linearGradient>
        </defs>
        <path
          d="M20 90 A70 70 0 0 1 160 90"
          fill="none"
          stroke="var(--muted)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M20 90 A70 70 0 0 1 160 90"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="-mt-6 text-center">
        <p className={cn("mono-nums text-4xl font-bold", TOKEN_TEXT[band.token])}>{score}</p>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{band.label} risk</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="panel items-center gap-2 p-10 text-center">
      <p className="text-base font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </Card>
  );
}
