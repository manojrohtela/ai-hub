import { motion } from "motion/react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppCard } from "./ui/AppCard";

interface DynamicChartCardProps {
  chart: unknown;
  prompt?: string;
  createdAt?: string;
}

interface PlotlyTrace {
  type?: string;
  name?: string;
  mode?: string;
  orientation?: string;
  x?: unknown;
  y?: unknown;
  labels?: unknown;
  values?: unknown;
  line?: {
    dash?: string;
  };
}

interface PlotlyFigure {
  data?: PlotlyTrace[];
  layout?: {
    title?: { text?: string } | string;
    xaxis?: {
      title?: { text?: string } | string;
    };
    yaxis?: {
      title?: { text?: string } | string;
    };
  };
}

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6"];
const gridStroke = "var(--border)";
const axisStroke = "var(--muted-foreground)";
const tooltipContentStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  color: "var(--popover-foreground)",
};

function normalizePlotlyFigure(chart: unknown): PlotlyFigure | null {
  if (!chart || typeof chart !== "object") {
    return null;
  }

  const rawChart = chart as Record<string, unknown>;

  if (rawChart.type === "dynamic" && typeof rawChart.data === "string") {
    try {
      return JSON.parse(rawChart.data) as PlotlyFigure;
    } catch (error) {
      console.error("Failed to parse dynamic chart payload", error);
      return null;
    }
  }

  if (Array.isArray(rawChart.data)) {
    return rawChart as PlotlyFigure;
  }

  return null;
}

function decodePlotlyArray(value: unknown): Array<string | number> {
  if (Array.isArray(value)) {
    return value as Array<string | number>;
  }

  if (
    value &&
    typeof value === "object" &&
    "bdata" in value &&
    typeof (value as { bdata?: unknown }).bdata === "string"
  ) {
    const { dtype = "", bdata } = value as { dtype?: string; bdata: string };
    const binary = atob(bdata);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    switch (dtype) {
      case "f8":
        return Array.from(new Float64Array(bytes.buffer));
      case "f4":
        return Array.from(new Float32Array(bytes.buffer));
      case "i1":
        return Array.from(new Int8Array(bytes.buffer));
      case "u1":
        return Array.from(new Uint8Array(bytes.buffer));
      case "i2":
        return Array.from(new Int16Array(bytes.buffer));
      case "u2":
        return Array.from(new Uint16Array(bytes.buffer));
      case "i4":
        return Array.from(new Int32Array(bytes.buffer));
      case "u4":
        return Array.from(new Uint32Array(bytes.buffer));
      default:
        return [];
    }
  }

  return [];
}

function formatCategory(value: unknown) {
  if (typeof value === "string" && value.includes("T")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  }

  return String(value ?? "");
}

function readTitle(value: { text?: string } | string | undefined, fallback: string) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (value && typeof value === "object" && typeof value.text === "string" && value.text.trim()) {
    return value.text;
  }

  return fallback;
}

function buildSeriesData(traces: PlotlyTrace[], axis: "line" | "bar") {
  const rows = new Map<string, Record<string, string | number>>();
  const series = traces.map((trace, index) => {
    const key = trace.name?.trim() || `Series ${index + 1}`;
    const categories = decodePlotlyArray(trace.orientation === "h" ? trace.y : trace.x);
    const values = decodePlotlyArray(trace.orientation === "h" ? trace.x : trace.y);

    categories.forEach((category, pointIndex) => {
      const label = formatCategory(category ?? pointIndex + 1);
      const row = rows.get(label) ?? { name: label };
      const rawValue = values[pointIndex];
      const numericValue =
        typeof rawValue === "number" ? rawValue : Number.parseFloat(String(rawValue ?? 0));

      row[key] = Number.isFinite(numericValue) ? numericValue : 0;
      rows.set(label, row);
    });

    return {
      key,
      color: COLORS[index % COLORS.length],
      dashed: axis === "line" && trace.line?.dash === "dash",
      markersOnly: axis === "line" && trace.mode === "markers",
    };
  });

  return {
    data: Array.from(rows.values()),
    series,
  };
}

function buildPieData(trace: PlotlyTrace) {
  const labels = decodePlotlyArray(trace.labels);
  const values = decodePlotlyArray(trace.values);

  return labels.map((label, index) => {
    const rawValue = values[index];
    const numericValue =
      typeof rawValue === "number" ? rawValue : Number.parseFloat(String(rawValue ?? 0));

    return {
      name: formatCategory(label),
      value: Number.isFinite(numericValue) ? numericValue : 0,
    };
  });
}

function buildHistogramData(trace: PlotlyTrace) {
  const points = decodePlotlyArray(trace.x)
    .map((value) => (typeof value === "number" ? value : Number.parseFloat(String(value))))
    .filter((value) => Number.isFinite(value));

  if (points.length === 0) {
    return [];
  }

  const minValue = Math.min(...points);
  const maxValue = Math.max(...points);

  if (minValue === maxValue) {
    return [{ name: `${minValue.toFixed(0)}`, value: points.length }];
  }

  const binCount = Math.min(10, Math.max(4, Math.round(Math.sqrt(points.length))));
  const binSize = (maxValue - minValue) / binCount;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    name: `${(minValue + index * binSize).toFixed(0)}-${(minValue + (index + 1) * binSize).toFixed(0)}`,
    value: 0,
  }));

  points.forEach((point) => {
    const binIndex = Math.min(Math.floor((point - minValue) / binSize), binCount - 1);
    bins[binIndex].value += 1;
  });

  return bins;
}

export function DynamicChartCard({ chart, prompt, createdAt }: DynamicChartCardProps) {
  const figure = normalizePlotlyFigure(chart);

  if (!figure || !Array.isArray(figure.data) || figure.data.length === 0) {
    return null;
  }

  const title = readTitle(figure.layout?.title, "Generated Chart");
  const xAxisLabel = readTitle(figure.layout?.xaxis?.title, "Category");
  const yAxisLabel = readTitle(figure.layout?.yaxis?.title, "Value");
  const traceTypes = new Set(figure.data.map((trace) => trace.type));
  const hasPieTrace = traceTypes.has("pie");
  const hasHistogramTrace = traceTypes.has("histogram");
  const hasBarTrace = traceTypes.has("bar");
  const { data: cartesianData, series } = buildSeriesData(
    figure.data.filter((trace) => trace.type === "scatter" || trace.type === "bar"),
    hasBarTrace ? "bar" : "line"
  );

  const pieData = hasPieTrace ? buildPieData(figure.data[0]) : [];
  const histogramData = hasHistogramTrace ? buildHistogramData(figure.data[0]) : [];
  const renderPieLabel = (props: any) => {
    const { name, percent, x, y, textAnchor, dominantBaseline } = props;

    return (
      <text
        x={x}
        y={y}
        fill="var(--foreground)"
        fontSize={12}
        textAnchor={textAnchor}
        dominantBaseline={dominantBaseline}
      >
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <AppCard>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/80 mb-2">AI Chart</p>
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          </div>
          {createdAt ? (
            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-700 dark:text-cyan-100">
              {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
        </div>
        {prompt ? (
          <p className="app-surface-muted mb-4 rounded-2xl border px-4 py-3 text-sm text-muted-foreground">
            {prompt}
          </p>
        ) : null}
        <div className="h-64">
          {hasPieTrace ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={86}
                label={renderPieLabel}
                labelLine={false}
              >
                  {pieData.map((entry, index) => (
                    <Cell key={`${entry.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipContentStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : hasHistogramTrace ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histogramData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis dataKey="name" stroke={axisStroke} fontSize={12} tick={{ fill: axisStroke }} />
                <YAxis stroke={axisStroke} fontSize={12} tick={{ fill: axisStroke }} />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Bar dataKey="value" fill={COLORS[0]} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : hasBarTrace ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cartesianData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  stroke={axisStroke}
                  fontSize={12}
                  tick={{ fill: axisStroke }}
                  label={{ value: xAxisLabel, position: "insideBottom", offset: -4, fill: axisStroke }}
                />
                <YAxis
                  stroke={axisStroke}
                  fontSize={12}
                  tick={{ fill: axisStroke }}
                  label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fill: axisStroke }}
                />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Legend formatter={(value) => <span style={{ color: "var(--foreground)" }}>{String(value)}</span>} />
                {series.map((item) => (
                  <Bar key={item.key} dataKey={item.key} fill={item.color} radius={[8, 8, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cartesianData}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                <XAxis
                  dataKey="name"
                  stroke={axisStroke}
                  fontSize={12}
                  tick={{ fill: axisStroke }}
                  label={{ value: xAxisLabel, position: "insideBottom", offset: -4, fill: axisStroke }}
                />
                <YAxis
                  stroke={axisStroke}
                  fontSize={12}
                  tick={{ fill: axisStroke }}
                  label={{ value: yAxisLabel, angle: -90, position: "insideLeft", fill: axisStroke }}
                />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Legend formatter={(value) => <span style={{ color: "var(--foreground)" }}>{String(value)}</span>} />
                {series.map((item) => (
                  <Line
                    key={item.key}
                    type="monotone"
                    dataKey={item.key}
                    stroke={item.color}
                    strokeWidth={2.5}
                    strokeDasharray={item.dashed ? "6 4" : undefined}
                    dot={{ r: 3, fill: item.color }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    {...(item.markersOnly ? { strokeOpacity: 0 } : {})}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </AppCard>
    </motion.div>
  );
}
