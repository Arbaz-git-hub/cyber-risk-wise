import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SnapshotSchema = z.object({
  orgName: z.string().default("the organization"),
  industry: z.string().default("Technology"),
  riskScore: z.number(),
  ale: z.number(),
  residualAle: z.number(),
  coverage: z.number(),
  openVulns: z.number(),
  activeThreats: z.number(),
  exposedValue: z.number(),
  budget: z.number(),
  topThreats: z.array(z.object({ name: z.string(), likelihood: z.number(), severity: z.number() })).max(10),
  topVulns: z.array(z.object({ title: z.string(), cvss: z.number(), status: z.string() })).max(10),
  candidateControls: z
    .array(z.object({ name: z.string(), cost_usd: z.number(), risk_reduction_pct: z.number(), status: z.string() }))
    .max(15),
});

const RecommendationsSchema = z.object({
  executiveSummary: z.string(),
  recommendations: z.array(
    z.object({
      title: z.string(),
      priority: z.enum(["critical", "high", "medium", "low"]),
      rationale: z.string(),
      expectedRiskReductionPct: z.number(),
      estimatedCostUsd: z.number(),
      timeframe: z.string(),
    }),
  ),
});

export type AiRecommendations = z.infer<typeof RecommendationsSchema>;

export const generateRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SnapshotSchema.parse(input))
  .handler(async ({ data }): Promise<AiRecommendations> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const { generateText, Output } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const result = await generateText({
      model: gateway("google/gemini-3.7-flash"),
      system:
        "You are a FAIR-based cyber risk quantification analyst. Given a risk snapshot, produce a crisp, " +
        "board-ready executive summary and 4-6 prioritized, budget-aware security recommendations. " +
        "Be concrete, reference the supplied threats/vulnerabilities, and keep costs within the stated budget where possible.",
      prompt: JSON.stringify(data),
      output: Output.object({ schema: RecommendationsSchema }),
    });

    return await result.output;
  });

const ReportSchema = z.object({
  orgName: z.string(),
  industry: z.string(),
  riskScore: z.number(),
  ale: z.number(),
  residualAle: z.number(),
  coverage: z.number(),
  openVulns: z.number(),
  activeThreats: z.number(),
  exposedValue: z.number(),
  topThreats: z.array(z.string()).max(10),
  topVulns: z.array(z.string()).max(10),
  activeControls: z.array(z.string()).max(15),
});

export const generateRiskReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured for this project.");

    const { streamText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);

    const result = streamText({
      model: gateway("google/gemini-3.7-flash"),
      system:
        "You write executive cyber risk quantification reports in clean markdown. Structure: " +
        "## Executive Summary, ## Quantified Financial Exposure, ## Threat Landscape, ## Vulnerability Posture, " +
        "## Control Effectiveness, ## Investment Recommendations, ## 90-Day Roadmap. Use the supplied numbers exactly. " +
        "No preamble, no code fences.",
      prompt: JSON.stringify(data),
    });

    const content = await result.text;
    const title = `Cyber Risk Report — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    const summary = `Risk score ${Math.round(data.riskScore)}/100 · residual annualized loss ${Math.round(data.residualAle).toLocaleString("en-US")} USD`;

    const { error } = await context.supabase
      .from("reports")
      .insert({ user_id: context.userId, title, summary, content });
    if (error) throw new Error(error.message);

    return { title, summary, content };
  });
