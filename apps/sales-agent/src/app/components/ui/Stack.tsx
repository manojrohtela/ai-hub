import { ReactNode } from "react";

interface StackProps {
  children: ReactNode;
  direction?: "vertical" | "horizontal";
  gap?: number;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between" | "around";
  className?: string;
}

export function Stack({
  children,
  direction = "vertical",
  gap = 4,
  align = "stretch",
  justify = "start",
  className = "",
}: StackProps) {
  const flexDirection = direction === "vertical" ? "flex-col" : "flex-row";
  
  const alignClasses = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
  };

  const justifyClasses = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
  };

  return (
    <div
      className={`flex ${flexDirection} gap-${gap} ${alignClasses[align]} ${justifyClasses[justify]} ${className}`}
    >
      {children}
    </div>
  );
}
