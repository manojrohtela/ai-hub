import { motion } from "motion/react";
import { BellRing } from "lucide-react";
import { AlertItem } from "../api";
import { AppCard } from "./ui/AppCard";

interface AlertsCardProps {
  alerts?: AlertItem[];
}

const severityStyles: Record<string, string> = {
  high: "border-rose-400/30 bg-rose-400/10 text-rose-100",
  medium: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  positive: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
};

export function AlertsCard({ alerts = [] }: AlertsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
    >
      <AppCard className="app-accent-amber h-full overflow-hidden border">
        <div className="mb-5 flex items-start gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-amber-300/25 to-rose-400/10 px-4 py-4 text-amber-100">
            <BellRing className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">AI Watchlist</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">Alerts & Briefing Cadence</h3>
          </div>
        </div>

        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="app-surface-muted rounded-2xl border p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-foreground">{alert.title}</h4>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.2em] ${
                      severityStyles[alert.severity] ?? "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
                    }`}
                  >
                    {alert.severity}
                  </span>
                  <span className="app-surface-inset rounded-full border px-3 py-1 text-[11px] text-muted-foreground">
                    {alert.cadence}
                  </span>
                </div>
              </div>
              <p className="text-sm leading-7 text-muted-foreground">{alert.message}</p>
            </div>
          ))}
        </div>
      </AppCard>
    </motion.div>
  );
}
