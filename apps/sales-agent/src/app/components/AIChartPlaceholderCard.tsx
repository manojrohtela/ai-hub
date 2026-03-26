import { WandSparkles } from "lucide-react";
import { motion } from "motion/react";
import { AppCard } from "./ui/AppCard";

interface AIChartPlaceholderCardProps {
  prompt: string;
}

export function AIChartPlaceholderCard({ prompt }: AIChartPlaceholderCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <AppCard className="app-accent-ai overflow-hidden border">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-300/80 mb-2">AI Chart</p>
            <h3 className="text-lg font-semibold text-foreground">Generating your chart</h3>
            <p className="app-surface-muted mt-3 max-w-2xl rounded-2xl border px-4 py-3 text-sm text-muted-foreground">
              {prompt}
            </p>
          </div>
          <div className="rounded-2xl bg-cyan-400/10 px-4 py-4 text-cyan-100">
            <WandSparkles className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-6 grid gap-3">
          <motion.div
            className="h-5 rounded-full bg-cyan-300/15"
            animate={{ opacity: [0.35, 0.9, 0.35], scaleX: [0.96, 1, 0.96] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="app-placeholder-grid grid h-64 grid-cols-12 items-end gap-3 rounded-3xl border p-4">
            {[32, 54, 40, 72, 58, 84, 48, 64, 77, 61, 89, 70].map((height, index) => (
              <motion.div
                key={`placeholder-bar-${index}`}
                className="rounded-t-2xl bg-gradient-to-t from-cyan-500/35 via-sky-400/50 to-white/65"
                style={{ height: `${height}%` }}
                animate={{ opacity: [0.45, 1, 0.45] }}
                transition={{ duration: 1.1, repeat: Infinity, delay: index * 0.08 }}
              />
            ))}
          </div>
        </div>
      </AppCard>
    </motion.div>
  );
}
