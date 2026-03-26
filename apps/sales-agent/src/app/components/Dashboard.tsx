import { useEffect, useState } from "react";
import {
  Award,
  Bot,
  Database,
  FileText,
  LayoutGrid,
  Lightbulb,
  List,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { motion } from "motion/react";
import { useNavigate } from "react-router";
import { AIChartPlaceholderCard } from "./AIChartPlaceholderCard";
import { AlertsCard } from "./AlertsCard";
import { ChatPanel } from "./ChatPanel";
import { ChartCard } from "./ChartCard";
import { DynamicChartCard } from "./DynamicChartCard";
import { ForecastCard } from "./ForecastCard";
import { InsightListCard } from "./InsightListCard";
import { SummaryMetricCard } from "./SummaryMetricCard";
import { WhatIfSimulatorCard } from "./WhatIfSimulatorCard";
import { BackgroundGradient } from "./ui/BackgroundGradient";
import { AppCard } from "./ui/AppCard";
import { PageHeader } from "./PageHeader";
import { useData } from "../DataContext";

type ChartPoint = {
  name: string;
  value: number;
};

type SummaryCardConfig = {
  icon: typeof Wallet;
  label: string;
  value: string;
  helper: string;
  accentClassName: string;
};

function readStat(
  stats: Record<string, string | number> | undefined,
  key: string,
  fallback = ""
) {
  const value = stats?.[key];
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

function humanize(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value < 100 ? 1 : 0,
  }).format(value);
}

function formatMetricValue(metricName: string, rawValue: string | number | undefined) {
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);
  if (!Number.isFinite(numericValue)) {
    return "N/A";
  }

  if (/(revenue|sales|spend|profit|cost|budget)/i.test(metricName)) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(numericValue);
  }

  return formatCompactNumber(numericValue);
}

function getDateRangeLabel(stats: Record<string, string | number> | undefined) {
  const start = readStat(stats, "date_range_start", "");
  const end = readStat(stats, "date_range_end", "");

  if (!start || !end) {
    return "";
  }

  return `${start} to ${end}`;
}

function getAnalysisSections(report: string) {
  return report
    .split("\n\n")
    .map((section) => section.trim())
    .filter(Boolean);
}

function normalizeChartData(data: unknown): ChartPoint[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const rawItem = item as Record<string, unknown>;
      const numericValue =
        typeof rawItem.value === "number"
          ? rawItem.value
          : Number.parseFloat(String(rawItem.value ?? 0));

      if (!Number.isFinite(numericValue)) {
        return null;
      }

      return {
        name: String(rawItem.name ?? "Unknown"),
        value: numericValue,
      };
    })
    .filter((item): item is ChartPoint => Boolean(item));
}

function getMaxPoint(data: ChartPoint[]) {
  if (data.length === 0) {
    return null;
  }

  return data.reduce((best, item) => (item.value > best.value ? item : best), data[0]);
}

function getMinPoint(data: ChartPoint[]) {
  if (data.length === 0) {
    return null;
  }

  return data.reduce((best, item) => (item.value < best.value ? item : best), data[0]);
}

function buildSummaryCards(
  metricName: string,
  stats: Record<string, string | number> | undefined,
  lineData: ChartPoint[],
  barData: ChartPoint[],
  pieData: ChartPoint[]
): SummaryCardConfig[] {
  const rowCount = Number(stats?.row_count ?? 0);
  const columnCount = Number(stats?.column_count ?? 0);
  const dateRangeLabel = getDateRangeLabel(stats);
  const primaryLabel = humanize(readStat(stats, "cat1_name", "Category"));
  const secondaryLabel = humanize(readStat(stats, "cat2_label", primaryLabel || "Segment"));
  const primaryStrongest = getMaxPoint(barData);
  const primaryWeakest = getMinPoint(barData);
  const segmentStrongest = getMaxPoint(pieData) ?? primaryStrongest;
  const segmentWeakest = getMinPoint(pieData) ?? primaryWeakest;
  const peakPeriod =
    lineData.length > 0
      ? getMaxPoint(lineData)
      : readStat(stats, "peak_period_name", "")
        ? {
            name: readStat(stats, "peak_period_name", ""),
            value: Number(stats?.peak_period_value ?? 0),
          }
        : primaryStrongest;

  return [
    {
      icon: Wallet,
      label: `Total ${metricName}`,
      value: formatMetricValue(metricName, stats?.total_metric),
      helper: `${rowCount.toLocaleString()} rows across ${columnCount.toLocaleString()} columns`,
      accentClassName: "from-cyan-400/30 to-sky-500/10 text-cyan-100",
    },
    peakPeriod
      ? {
          icon: Award,
          label: lineData.length > 0 || dateRangeLabel ? "Top Date" : `Top ${primaryLabel}`,
          value: humanize(peakPeriod.name),
          helper: `${metricName}: ${formatMetricValue(metricName, peakPeriod.value)}`,
          accentClassName: "from-violet-400/30 to-fuchsia-500/10 text-violet-100",
        }
      : {
          icon: Award,
          label: "Dataset Span",
          value: dateRangeLabel || `${rowCount.toLocaleString()} Rows`,
          helper: dateRangeLabel ? "Tracked period available in the loaded dataset" : "Dataset loaded and ready for analysis",
          accentClassName: "from-violet-400/30 to-fuchsia-500/10 text-violet-100",
        },
    segmentStrongest
      ? {
          icon: TrendingUp,
          label: `Strongest ${pieData.length > 0 ? secondaryLabel : primaryLabel}`,
          value: humanize(segmentStrongest.name),
          helper: `${metricName}: ${formatMetricValue(metricName, segmentStrongest.value)}`,
          accentClassName: "from-emerald-400/30 to-lime-500/10 text-emerald-100",
        }
      : {
          icon: TrendingUp,
          label: `Average ${metricName}`,
          value: formatMetricValue(metricName, stats?.average_metric),
          helper: "Average performance across the available records",
          accentClassName: "from-emerald-400/30 to-lime-500/10 text-emerald-100",
        },
    segmentWeakest
      ? {
          icon: TrendingDown,
          label: `Weakest ${pieData.length > 0 ? secondaryLabel : primaryLabel}`,
          value: humanize(segmentWeakest.name),
          helper: `${metricName}: ${formatMetricValue(metricName, segmentWeakest.value)}`,
          accentClassName: "from-amber-300/30 to-rose-500/10 text-amber-100",
        }
      : {
          icon: TrendingDown,
          label: "Dataset Coverage",
          value: columnCount > 0 ? `${columnCount.toLocaleString()} Fields` : "Ready",
          helper: dateRangeLabel || "Using all detected dimensions from the dataset",
          accentClassName: "from-amber-300/30 to-rose-500/10 text-amber-100",
        },
  ];
}

export function Dashboard() {
  const navigate = useNavigate();
  const { analysisData, aiChartHistory, pendingAiChartPrompt } = useData();
  const [chartView, setChartView] = useState<"grid" | "list">("grid");
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    if (!analysisData) {
      navigate("/");
    }
  }, [analysisData, navigate]);

  if (!analysisData) {
    return null;
  }

  const metricName = humanize(readStat(analysisData.stats_snapshot, "metric_name", "Metric"));
  const primaryLabel = humanize(readStat(analysisData.stats_snapshot, "cat1_name", "Category"));
  const secondaryLabel = humanize(
    readStat(analysisData.stats_snapshot, "cat2_label", primaryLabel || "Segment")
  );
  const dateRangeLabel = getDateRangeLabel(analysisData.stats_snapshot);
  const lineData = normalizeChartData(analysisData.charts?.lineData);
  const barData = normalizeChartData(analysisData.charts?.barData);
  const pieData = normalizeChartData(analysisData.charts?.pieData);
  const areaData = normalizeChartData(analysisData.charts?.areaData);
  const summaryCards = buildSummaryCards(
    metricName,
    analysisData.stats_snapshot,
    lineData,
    barData,
    pieData
  );
  const analysisSections = getAnalysisSections(analysisData.structured_report);
  const aiChartEntries = [...aiChartHistory].reverse();
  const chartLayoutClass = chartView === "grid" ? "grid gap-6 xl:grid-cols-2" : "grid gap-6";
  const initialMessages = [
    {
      id: 1,
      type: "ai" as const,
      content: `Your dataset is ready. Ask for charts, comparisons, forecasts, simulations, or recommendations.${
        analysisData.follow_up_questions.length > 0
          ? `\n\nTry: ${analysisData.follow_up_questions.slice(0, 2).join(" | ")}`
          : ""
      }`,
    },
  ];

  const coreCharts = [
    {
      key: "trend",
      title: `${metricName} Trend`,
      type: "line" as const,
      data: analysisData.charts?.lineData,
    },
    {
      key: "primary-bar",
      title: `Top ${primaryLabel}`,
      type: "bar" as const,
      data: analysisData.charts?.barData,
    },
    {
      key: "segment-pie",
      title: `${secondaryLabel} Distribution`,
      type: "pie" as const,
      data: analysisData.charts?.pieData || analysisData.charts?.barData,
    },
    {
      key: "monthly-area",
      title: "Monthly Performance",
      type: "area" as const,
      data: analysisData.charts?.areaData || analysisData.charts?.lineData,
    },
    {
      key: "segment-compare",
      title: `${secondaryLabel} Comparison`,
      type: "bar" as const,
      data: analysisData.charts?.pieData || analysisData.charts?.barData,
    },
    {
      key: "timeline",
      title: dateRangeLabel ? "Growth Over Time" : "Performance Snapshot",
      type: "line" as const,
      data: analysisData.charts?.areaData || analysisData.charts?.lineData || analysisData.charts?.barData,
    },
  ];

  return (
    <div className="app-shell relative min-h-screen overflow-hidden">
      <BackgroundGradient variant="subtle" />

      <PageHeader
        title="Sales Agent"
        icon={Database}
        action={
          <button
            onClick={() => navigate("/")}
            className="app-surface-muted rounded-full border px-5 py-2 font-medium text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/40 hover:bg-cyan-400/10"
          >
            Change Data
          </button>
        }
      />

      <div className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 pb-32 pt-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <AppCard className="app-hero-surface overflow-hidden border">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Dataset Command Center</p>
                <h2 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">
                  Dynamic metrics, planning tools, six core charts, and AI chart history
                </h2>
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground sm:text-base">
                  {analysisData.dataset_summary}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="app-surface-muted rounded-3xl border px-5 py-4 text-sm text-foreground">
                  {dateRangeLabel || "Live analysis ready for exploration"}
                </div>
                <div className="app-surface-inset flex items-center gap-2 rounded-full border p-1">
                  <button
                    type="button"
                    onClick={() => setChartView("grid")}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                      chartView === "grid"
                        ? "bg-cyan-400/15 text-cyan-700 dark:text-cyan-100"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartView("list")}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
                      chartView === "list"
                        ? "bg-cyan-400/15 text-cyan-700 dark:text-cyan-100"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <List className="h-4 w-4" />
                    List
                  </button>
                </div>
              </div>
            </div>
          </AppCard>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card, index) => (
            <SummaryMetricCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              helper={card.helper}
              accentClassName={card.accentClassName}
              delay={0.05 * index}
            />
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <ForecastCard forecast={analysisData.forecast} />
          <AlertsCard alerts={analysisData.alerts} />
        </div>

        <div className="grid gap-6">
          <WhatIfSimulatorCard whatIf={analysisData.what_if} />
        </div>

        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Visual Intelligence</p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">Core dataset charts</h3>
            </div>
            <p className="text-sm text-muted-foreground">Six charts are shown by default, and the same grid/list choice also applies to AI Charts.</p>
          </div>

          <div className={chartLayoutClass}>
            {coreCharts.map((chart) => (
              <ChartCard key={chart.key} title={chart.title} type={chart.type} data={chart.data} />
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.95fr,1.35fr]">
          <InsightListCard
            title="Key Insights"
            eyebrow="What stands out"
            icon={Lightbulb}
            items={analysisData.key_insights.length > 0 ? analysisData.key_insights : ["No key insights available yet."]}
            accentClassName="from-fuchsia-400/25 to-orange-400/10 text-fuchsia-100"
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <AppCard className="app-accent-indigo h-full overflow-hidden border">
              <div className="mb-5 flex items-start gap-4">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-400/25 to-cyan-400/10 px-4 py-4 text-indigo-100">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Narrative Layer</p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">Full Strategic AI Analysis</h3>
                </div>
              </div>

              <div className="max-h-[560px] space-y-4 overflow-y-auto pr-2">
                {analysisSections.map((section, index) => (
                  <div
                    key={`analysis-section-${index}`}
                    className="app-surface-muted whitespace-pre-wrap rounded-2xl border px-4 py-4 text-sm leading-7 text-muted-foreground"
                  >
                    {section}
                  </div>
                ))}
              </div>
            </AppCard>
          </motion.div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <InsightListCard
            title="Visual Analysis"
            eyebrow="Chart reading"
            icon={TrendingUp}
            items={
              analysisData.visual_analysis.length > 0
                ? analysisData.visual_analysis
                : ["Visual analysis will appear here once available."]
            }
            accentClassName="from-cyan-400/25 to-blue-400/10 text-cyan-100"
            delay={0.05}
          />
          <InsightListCard
            title="Business Recommendations"
            eyebrow="What to do next"
            icon={Target}
            items={
              analysisData.business_recommendations.length > 0
                ? analysisData.business_recommendations
                : ["No recommendations available yet."]
            }
            accentClassName="from-emerald-400/25 to-lime-400/10 text-emerald-100"
            delay={0.1}
          />
          <InsightListCard
            title="Action Plan"
            eyebrow="Execution sequence"
            icon={FileText}
            items={analysisData.action_plan.length > 0 ? analysisData.action_plan : ["No action plan available yet."]}
            accentClassName="from-amber-300/25 to-rose-400/10 text-amber-100"
            delay={0.15}
          />
        </div>

        <section className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Generated During Chat</p>
              <h3 className="mt-2 text-2xl font-semibold text-foreground">AI Charts</h3>
            </div>
            <p className="text-sm text-muted-foreground">New AI charts are appended here and older ones stay visible.</p>
          </div>

          {pendingAiChartPrompt || aiChartEntries.length > 0 ? (
            <div className={chartLayoutClass}>
              {pendingAiChartPrompt ? <AIChartPlaceholderCard prompt={pendingAiChartPrompt} /> : null}
              {aiChartEntries.map((entry) => (
                <DynamicChartCard
                  key={entry.id}
                  chart={entry.chart}
                  prompt={entry.prompt}
                  createdAt={entry.createdAt}
                />
              ))}
            </div>
          ) : (
            <AppCard className="app-surface-muted border-dashed">
              <div className="flex flex-col gap-3 py-6 text-center">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">AI Charts</p>
                <h4 className="text-xl font-semibold text-foreground">Generated charts will appear here</h4>
                <p className="mx-auto max-w-2xl text-sm leading-7 text-muted-foreground">
                  Ask the assistant for a pie chart, bar chart, trend, forecast, or comparison and each result will be
                  added here without replacing the older ones.
                </p>
              </div>
            </AppCard>
          )}
        </section>
      </div>

      <div className="pointer-events-none fixed inset-x-4 bottom-24 z-40 sm:inset-x-auto sm:right-6 sm:w-[420px]">
        <motion.div
          initial={false}
          animate={
            isChatOpen
              ? { opacity: 1, y: 0, scale: 1 }
              : { opacity: 0, y: 20, scale: 0.96 }
          }
          transition={{ duration: 0.22 }}
          className={`${isChatOpen ? "pointer-events-auto" : "pointer-events-none"} h-[min(74vh,720px)]`}
        >
          <ChatPanel
            initialMessages={initialMessages}
            onClose={() => setIsChatOpen(false)}
          />
        </motion.div>
      </div>

      <motion.button
        type="button"
        onClick={() => setIsChatOpen((open) => !open)}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="app-command-surface fixed bottom-6 right-4 z-50 flex items-center gap-3 rounded-full border px-5 py-4 text-sm font-medium text-foreground shadow-2xl backdrop-blur-xl sm:right-6"
        aria-expanded={isChatOpen}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500 shadow-lg shadow-cyan-500/25">
          <Bot className="h-5 w-5 text-white" />
        </span>
        <span className="text-left">
          <span className="block text-xs uppercase tracking-[0.26em] text-cyan-600/80 dark:text-cyan-200/75">AI Assistant</span>
          <span className="block text-sm">{isChatOpen ? "Hide chat" : "Open chat"}</span>
        </span>
      </motion.button>
    </div>
  );
}
