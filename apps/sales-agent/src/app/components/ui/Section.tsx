import { ReactNode } from "react";
import { motion } from "motion/react";

interface SectionProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  animate?: boolean;
  delay?: number;
}

export function Section({
  children,
  title,
  subtitle,
  className = "",
  animate = false,
  delay = 0,
}: SectionProps) {
  const content = (
    <>
      {(title || subtitle) && (
        <div className="text-center mb-8">
          {title && <h2 className="text-2xl sm:text-3xl font-bold mb-2">{title}</h2>}
          {subtitle && <p className="text-gray-400 text-base sm:text-lg">{subtitle}</p>}
        </div>
      )}
      {children}
    </>
  );

  if (animate) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay }}
        className={className}
      >
        {content}
      </motion.section>
    );
  }

  return <section className={className}>{content}</section>;
}
