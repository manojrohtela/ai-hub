import { ReactNode } from "react";
import { motion } from "motion/react";

interface AppCardProps {
  children: ReactNode;
  hover?: boolean;
  onClick?: () => void;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function AppCard({
  children,
  hover = false,
  onClick,
  className = "",
  padding = "md",
}: AppCardProps) {
  const baseClasses =
    "app-surface-strong rounded-xl border text-card-foreground transition-all duration-300 backdrop-blur-sm";
  const hoverClasses = hover
    ? "hover:border-indigo-500/50 hover:shadow-indigo-500/10 shadow-lg cursor-pointer"
    : "shadow-lg";
  const paddingClass = paddingClasses[padding];

  const combinedClassName = `${baseClasses} ${hoverClasses} ${paddingClass} ${className}`;

  if (hover) {
    return (
      <motion.div
        whileHover={{ y: -4 }}
        className={combinedClassName}
        onClick={onClick}
      >
        {children}
      </motion.div>
    );
  }

  return <div className={combinedClassName} onClick={onClick}>{children}</div>;
}
