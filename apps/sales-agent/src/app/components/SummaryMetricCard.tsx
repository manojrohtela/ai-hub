import { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { AppCard } from "./ui/AppCard";

interface SummaryMetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  helper?: string;
  accentClassName?: string;
  delay?: number;
}

export function SummaryMetricCard({
  icon: Icon,
  label,
  value,
  helper,
  accentClassName = "from-cyan-400/20 to-blue-500/10 text-cyan-100",
  delay = 0,
}: SummaryMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <AppCard className="overflow-hidden">
        <div className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br px-4 py-4 ${accentClassName}`}>
          <Icon className="h-6 w-6" />
        </div>
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
        <p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>
        {helper ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{helper}</p> : null}
      </AppCard>
    </motion.div>
  );
}
