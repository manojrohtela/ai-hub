import { motion } from "motion/react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { ForecastModel } from "../api";
import { AppCard } from "./ui/AppCard";

interface ForecastCardProps {
  forecast?: ForecastModel;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "N/A";
  }

  if (Math.abs(value) >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toFixed(0);
}

export function ForecastCard({ forecast }: ForecastCardProps) {
  const chartData = forecast?.data ?? [];
  const tooltipContentStyle = {
    backgroundColor: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    color: "var(--popover-foreground)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <AppCard className="app-accent-cyan h-full overflow-hidden border">
        <div className="mb-5 flex items-start gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-cyan-400/25 to-blue-500/10 px-4 py-4 text-cyan-100">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">Forecast Engine</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">Forecast With Confidence Band</h3>
          </div>
        </div>

        <p className="mb-5 text-sm leading-7 text-muted-foreground">
          {forecast?.summary ?? "Forecasting becomes available when the dataset includes enough dated history."}
        </p>

        {forecast?.enabled && chartData.length > 0 ? (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tick={{ fill: "var(--muted-foreground)" }} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tick={{ fill: "var(--muted-foreground)" }} tickFormatter={formatNumber} />
                <Tooltip contentStyle={tooltipContentStyle} />
                <Legend formatter={(value) => <span style={{ color: "var(--foreground)" }}>{String(value)}</span>} />
                <Area
                  type="monotone"
                  dataKey="bandBase"
                  stackId="confidence"
                  stroke="transparent"
                  fill="transparent"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="bandSize"
                  stackId="confidence"
                  stroke="transparent"
                  fill="#22d3ee"
                  fillOpacity={0.15}
                  name={`${forecast.confidence_level ?? "80%"} confidence band`}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#38bdf8" }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke="#818cf8"
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#f59e0b"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#f59e0b" }}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="lower"
                  stroke="#22d3ee"
                  strokeOpacity={0.45}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="upper"
                  stroke="#22d3ee"
                  strokeOpacity={0.45}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="app-surface-muted rounded-2xl border border-dashed px-4 py-6 text-sm leading-7 text-muted-foreground">
            Add a numeric metric with a usable date column and the forecast section will populate automatically.
          </div>
        )}
      </AppCard>
    </motion.div>
  );
}
