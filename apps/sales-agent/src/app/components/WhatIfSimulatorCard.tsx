import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { SlidersHorizontal } from "lucide-react";
import { WhatIfDriver, WhatIfModel } from "../api";
import { AppCard } from "./ui/AppCard";

interface WhatIfSimulatorCardProps {
  whatIf?: WhatIfModel;
}

function formatNumber(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
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

export function WhatIfSimulatorCard({ whatIf }: WhatIfSimulatorCardProps) {
  const drivers = whatIf?.drivers ?? [];
  const [selectedDriverName, setSelectedDriverName] = useState(drivers[0]?.name ?? "");
  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.name === selectedDriverName) ?? drivers[0],
    [drivers, selectedDriverName]
  );
  const [changePct, setChangePct] = useState(selectedDriver?.default_change_pct ?? 10);

  useEffect(() => {
    setSelectedDriverName(drivers[0]?.name ?? "");
  }, [drivers]);

  useEffect(() => {
    setChangePct(selectedDriver?.default_change_pct ?? 10);
  }, [selectedDriver?.default_change_pct, selectedDriver?.name]);

  const baseTotal = whatIf?.base_total ?? 0;
  const projectedTotal = selectedDriver
    ? Math.max(baseTotal * (1 + ((selectedDriver.elasticity * changePct) / 100)), 0)
    : baseTotal;
  const delta = projectedTotal - baseTotal;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
    >
      <AppCard className="app-accent-emerald h-full overflow-hidden border">
        <div className="mb-5 flex items-start gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-emerald-400/25 to-lime-400/10 px-4 py-4 text-emerald-100">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">What-If Simulator</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">Directional Planning Sandbox</h3>
          </div>
        </div>

        {whatIf?.enabled && selectedDriver ? (
          <div className="space-y-5">
            <p className="text-sm leading-7 text-muted-foreground">
              Simulate one driver at a time to estimate how {whatIf.target_metric ?? "the primary metric"} could move
              if conditions change.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Driver</span>
                <select
                  value={selectedDriver.name}
                  onChange={(event) => setSelectedDriverName(event.target.value)}
                  className="app-chat-input w-full rounded-2xl border px-4 py-3 text-sm text-foreground outline-none"
                >
                  {drivers.map((driver) => (
                    <option key={driver.name} value={driver.name}>
                      {driver.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="app-surface-muted rounded-2xl border px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Model signal</p>
                <p className="mt-3 text-sm text-foreground">
                  Correlation {selectedDriver.correlation.toFixed(2)} | Elasticity {selectedDriver.elasticity.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="app-surface-muted rounded-3xl border px-4 py-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Adjustment</span>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-100">
                  {changePct > 0 ? "+" : ""}
                  {changePct}%
                </span>
              </div>
              <input
                type="range"
                min={-30}
                max={30}
                step={1}
                value={changePct}
                onChange={(event) => setChangePct(Number(event.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="app-surface-muted rounded-2xl border px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current total</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{formatNumber(baseTotal)}</p>
              </div>
              <div className="app-surface-muted rounded-2xl border px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Projected total</p>
                <p className="mt-3 text-2xl font-semibold text-foreground">{formatNumber(projectedTotal)}</p>
              </div>
              <div className="app-surface-muted rounded-2xl border px-4 py-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Estimated impact</p>
                <p className={`mt-3 text-2xl font-semibold ${delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {delta >= 0 ? "+" : ""}
                  {formatNumber(delta)}
                </p>
              </div>
            </div>

            <div className="app-surface-inset rounded-2xl border px-4 py-4 text-sm leading-7 text-muted-foreground">
              {selectedDriver.impact_summary.replace(
                `${selectedDriver.default_change_pct > 0 ? "+" : ""}${selectedDriver.default_change_pct}%`,
                `${changePct > 0 ? "+" : ""}${changePct}%`
              )}
            </div>

            {whatIf.assumptions && whatIf.assumptions.length > 0 ? (
              <div className="space-y-2">
                {whatIf.assumptions.map((assumption, index) => (
                  <div
                    key={`assumption-${index}`}
                    className="app-surface-muted rounded-2xl border px-4 py-3 text-sm leading-relaxed text-muted-foreground"
                  >
                    {assumption}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="app-surface-muted rounded-2xl border border-dashed px-4 py-6 text-sm leading-7 text-muted-foreground">
            Add a metric plus at least one usable driver column and the simulator will auto-configure itself.
          </div>
        )}
      </AppCard>
    </motion.div>
  );
}
