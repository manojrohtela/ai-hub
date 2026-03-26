import { useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeftRight,
  BarChart3,
  LineChart as LineChartIcon,
  Upload,
  X,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compareDatasets, ComparisonResponse } from "../api";
import { useData } from "../DataContext";
import { AppCard } from "./ui/AppCard";

function formatDelta(delta: number) {
  if (!Number.isFinite(delta)) {
    return "N/A";
  }
  return `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`;
}

export function ComparisonWorkbench() {
  const { selectedFile, useDemo, demoDatasetName } = useData();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comparisonData, setComparisonData] = useState<ComparisonResponse | null>(null);
  const [comparisonFileName, setComparisonFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleCompareFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setComparisonFileName(file.name);

    try {
      const result = await compareDatasets({
        primaryUseDemo: useDemo,
        primaryFile: selectedFile ?? undefined,
        primaryDemoDatasetName: demoDatasetName ?? undefined,
        comparisonFile: file,
      });
      setComparisonData(result);
    } catch (caughtError) {
      console.error(caughtError);
      setError("Unable to compare the datasets right now.");
    } finally {
      setIsLoading(false);
    }
  };

  const metricComparisonData = Array.isArray(comparisonData?.charts?.metricComparison)
    ? comparisonData?.charts?.metricComparison
    : [];
  const dimensionComparisonData = Array.isArray(comparisonData?.charts?.dimensionComparison)
    ? comparisonData?.charts?.dimensionComparison
    : [];
  const trendComparisonData = Array.isArray(comparisonData?.charts?.trendComparison)
    ? comparisonData?.charts?.trendComparison
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.12 }}
    >
      <AppCard className="h-full overflow-hidden border-violet-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(129,140,248,0.16),_rgba(15,23,42,0.97)_58%)]">
        <div className="mb-5 flex items-start gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-violet-400/25 to-fuchsia-400/10 px-4 py-4 text-violet-100">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Compare Uploads</p>
            <h3 className="mt-2 text-xl font-semibold text-white">Dataset Comparison Workspace</h3>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] px-5 py-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleCompareFile(file);
                }
              }}
            />
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-slate-300">
                  Upload another CSV to compare it against the dataset currently loaded on the dashboard.
                </p>
                {comparisonFileName ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">
                    Latest comparison file: {comparisonFileName}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handlePickFile}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-indigo-600 px-5 py-3 text-sm font-medium text-white transition-transform duration-300 hover:scale-[1.02]"
                >
                  <Upload className="h-4 w-4" />
                  {isLoading ? "Comparing..." : "Upload Comparison CSV"}
                </button>
                {comparisonData ? (
                  <button
                    type="button"
                    onClick={() => {
                      setComparisonData(null);
                      setComparisonFileName("");
                      setError(null);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200"
                  >
                    <X className="h-4 w-4" />
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          {comparisonData ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4 text-sm leading-7 text-slate-300">
                {comparisonData.comparison_summary}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {comparisonData.cards.map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-white/8 bg-white/5 px-4 py-4"
                  >
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{card.label}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-slate-500">{comparisonData.baseline_label}</p>
                        <p className="text-lg font-semibold text-white">{card.baseline_value}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">{comparisonData.comparison_label}</p>
                        <p className="text-lg font-semibold text-white">{card.comparison_value}</p>
                      </div>
                    </div>
                    <p className={`mt-4 text-sm ${card.delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      Delta: {formatDelta(card.delta)}
                    </p>
                  </div>
                ))}
              </div>

              {comparisonData.highlights.length > 0 ? (
                <div className="space-y-3">
                  {comparisonData.highlights.map((item, index) => (
                    <div
                      key={`comparison-highlight-${index}`}
                      className="rounded-2xl border border-white/8 bg-[#08111f]/80 px-4 py-3 text-sm leading-relaxed text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              ) : null}

              {comparisonData.shared_columns.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {comparisonData.shared_columns.slice(0, 12).map((column) => (
                    <span
                      key={column}
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300"
                    >
                      {column}
                    </span>
                  ))}
                </div>
              ) : null}

              {metricComparisonData.length > 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
                    <BarChart3 className="h-4 w-4" />
                    Total metric comparison
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metricComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #334155",
                            borderRadius: "12px",
                            color: "#fff",
                          }}
                        />
                        <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              {dimensionComparisonData.length > 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
                    <BarChart3 className="h-4 w-4" />
                    Shared dimension movement
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dimensionComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #334155",
                            borderRadius: "12px",
                            color: "#fff",
                          }}
                        />
                        <Legend />
                        <Bar dataKey={comparisonData.baseline_label} fill="#818cf8" radius={[8, 8, 0, 0]} />
                        <Bar dataKey={comparisonData.comparison_label} fill="#22d3ee" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              {trendComparisonData.length > 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm text-slate-300">
                    <LineChartIcon className="h-4 w-4" />
                    Trend comparison
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #334155",
                            borderRadius: "12px",
                            color: "#fff",
                          }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey={comparisonData.baseline_label}
                          stroke="#818cf8"
                          strokeWidth={2.5}
                          dot={{ r: 2 }}
                        />
                        <Line
                          type="monotone"
                          dataKey={comparisonData.comparison_label}
                          stroke="#22d3ee"
                          strokeWidth={2.5}
                          dot={{ r: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-[#08111f]/70 px-4 py-6 text-sm leading-7 text-slate-400">
              No comparison loaded yet. Upload a second CSV and the dashboard will compute shared metrics, dimension shifts,
              and trend differences automatically.
            </div>
          )}
        </div>
      </AppCard>
    </motion.div>
  );
}
