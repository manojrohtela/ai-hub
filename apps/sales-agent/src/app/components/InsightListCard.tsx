import { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { AppCard } from "./ui/AppCard";

interface InsightListCardProps {
  title: string;
  eyebrow?: string;
  icon: LucideIcon;
  items: string[];
  accentClassName?: string;
  delay?: number;
}

export function InsightListCard({
  title,
  eyebrow,
  icon: Icon,
  items,
  accentClassName = "from-fuchsia-400/20 to-orange-400/10 text-fuchsia-100",
  delay = 0,
}: InsightListCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
    >
      <AppCard className="h-full">
        <div className="mb-5 flex items-start gap-4">
          <div className={`rounded-2xl bg-gradient-to-br px-4 py-4 ${accentClassName}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            {eyebrow ? (
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{eyebrow}</p>
            ) : null}
            <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
          </div>
        </div>
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="app-surface-muted rounded-2xl border px-4 py-3 text-sm leading-relaxed text-foreground"
            >
              {item}
            </div>
          ))}
        </div>
      </AppCard>
    </motion.div>
  );
}
