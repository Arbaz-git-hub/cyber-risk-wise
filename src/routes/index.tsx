import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldAlert,
  Activity,
  Coins,
  Sparkles,
  Radar,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CyberRisk AI — AI Cyber Risk Quantification Platform" },
      {
        name: "description",
        content:
          "Continuously quantify cyber risk in dollars, assess threats and vulnerabilities, and optimize your security budget with AI-driven recommendations.",
      },
      { property: "og:title", content: "CyberRisk AI — AI Cyber Risk Quantification Platform" },
      {
        property: "og:description",
        content:
          "Continuously quantify cyber risk in dollars and optimize security investments with AI.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Activity,
    title: "Continuous risk scoring",
    body: "A live 0-100 risk score derived from asset criticality, threat pressure and open vulnerability depth.",
  },
  {
    icon: Coins,
    title: "Financial loss estimation",
    body: "FAIR-style single loss expectancy and annualized loss exposure, expressed in dollars leadership understands.",
  },
  {
    icon: Radar,
    title: "Threat & vulnerability tracking",
    body: "Register threat campaigns and CVEs, weight them by likelihood and severity, and watch residual risk move.",
  },
  {
    icon: Sparkles,
    title: "AI investment optimization",
    body: "Rank controls by avoided loss per dollar and let AI recommend the highest-ROI portfolio for your budget.",
  },
  {
    icon: FileText,
    title: "Board-ready reports",
    body: "Generate quantified executive reports with a 90-day roadmap in a single click, saved to your workspace.",
  },
  {
    icon: ShieldAlert,
    title: "Private by default",
    body: "Every asset, finding and report is scoped to your account with row-level security in the cloud database.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-6 text-primary" />
          <span className="font-semibold tracking-tight">CyberRisk AI</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      <section className="border-b border-border px-6 py-28 sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> AI-powered cyber risk quantification
          </span>
          <h1 className="mt-8 text-4xl font-semibold leading-[1.15] tracking-tight sm:text-5xl">
            Know your cyber risk <span className="text-primary">in dollars</span>, not colors
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            CyberRisk AI continuously quantifies your exposure, models loss scenarios, and optimizes
            where every security dollar should go — with an audit trail your board can read.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link to="/auth">
                Launch the dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Create an account</Link>
            </Button>
          </div>
          <div className="mono-nums mx-auto mt-16 grid max-w-lg grid-cols-3 divide-x divide-border border-y border-border py-6 text-center">
            {[
              ["ALE", "Annualized loss"],
              ["FAIR", "Quantification model"],
              ["ROI", "Budget optimization"],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="text-lg font-semibold text-primary">{k}</p>
                <p className="mt-1 text-xs text-muted-foreground">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold tracking-tight">Everything a modern risk program needs</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            One workspace for asset exposure, threat intelligence, vulnerability posture, control
            effectiveness and executive reporting.
          </p>
          <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-card p-6 transition-colors hover:bg-secondary/50">
                <Icon className="size-5 text-primary" />
                <h3 className="mt-4 text-sm font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 text-center text-xs text-muted-foreground">
        CyberRisk AI — continuous cyber risk quantification and investment optimization.
      </footer>
    </div>
  );
}
