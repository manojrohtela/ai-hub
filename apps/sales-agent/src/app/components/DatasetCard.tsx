import { motion } from "motion/react";
import { Database, LucideIcon } from "lucide-react";
import { IconContainer } from "./ui/IconContainer";

interface DatasetCardProps {
  name: string;
  description: string;
  rows: number;
  columns: number;
  icon: LucideIcon;
  onSelect: () => void;
  delay?: number;
}

export function DatasetCard({
  name,
  description,
  rows,
  columns,
  icon: Icon,
  onSelect,
  delay = 0,
}: DatasetCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="app-surface-strong rounded-xl border p-6 transition-all duration-300 cursor-pointer shadow-xl hover:border-indigo-500 hover:shadow-indigo-500/20 group"
      onClick={onSelect}
    >
      <div className="flex items-center mb-4">
        <div className="w-12 h-12 bg-indigo-500/10 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/20 transition-all duration-300">
          {Icon ? <Icon className="w-6 h-6 text-indigo-400" /> : null}
        </div>
      </div>

      <h3 className="text-xl font-semibold mb-2">{name}</h3>
      <p className="app-subtle-text mb-6 min-h-[40px] text-sm">{description}</p>

      <div className="app-subtle-text mb-6 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1">
          <Database className="w-4 h-4" />
          <span>{rows.toLocaleString()} rows</span>
        </div>
        <div className="flex items-center gap-1">
          <span>•</span>
          <span>{columns} columns</span>
        </div>
      </div>

      <button className="w-full rounded-lg bg-indigo-600 py-2.5 font-medium text-white transition-all duration-300 hover:bg-indigo-700 group-hover:shadow-lg group-hover:shadow-indigo-500/30">
        Use this data
      </button>
    </motion.div>
  );
}
