import { motion } from "motion/react";
import { LucideIcon, ExternalLink } from "lucide-react";

export interface Agent {
  id: number;
  icon: LucideIcon;
  name: string;
  description: string;
  tags: string[];
  githubUrl: string;
  /** Set once deployed — automatically enables the "Open Agent" button */
  liveUrl?: string;
}

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  const { icon: Icon, name, description, tags, liveUrl } = agent;

  return (
    <motion.div
      className="group relative bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6 overflow-hidden h-full flex flex-col"
      whileHover={{ y: -8, scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      {/* Hover glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-300 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Icon + Status badge */}
        <div className="flex items-start justify-between mb-4">
          <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shrink-0">
            <Icon className="w-7 h-7 text-white" />
          </div>

          {liveUrl && (
            <span className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>

        {/* Name + Description */}
        <h3 className="text-xl font-semibold text-white mb-2">{name}</h3>
        <p className="text-slate-400 mb-4 leading-relaxed flex-grow text-sm">{description}</p>

        {/* Tech tags */}
        <div className="flex flex-wrap gap-2 mb-5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="bg-slate-700/60 text-slate-300 text-xs px-2.5 py-1 rounded-md border border-slate-600/40"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-auto">
          {liveUrl ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-4 rounded-lg transition-colors duration-200 group-hover:shadow-lg group-hover:shadow-indigo-500/30 text-sm font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Open Agent
            </a>
          ) : (
            <div className="flex-1 flex items-center justify-center gap-2 bg-slate-700/40 text-slate-500 py-2.5 px-4 rounded-lg text-sm font-medium cursor-default">
              Coming Soon
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
