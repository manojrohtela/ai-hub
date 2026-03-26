import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface IconContainerProps {
  icon?: LucideIcon;
  children?: ReactNode;
  variant?: "square" | "circle";
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-6 h-6",
};

export function IconContainer({
  icon: Icon,
  children,
  variant = "square",
  size = "md",
  className = "",
}: IconContainerProps) {
  const baseClasses = "bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center";
  const shapeClass = variant === "circle" ? "rounded-full" : "rounded-lg";
  const sizeClass = sizeClasses[size];

  return (
    <div className={`${baseClasses} ${shapeClass} ${sizeClass} ${className}`}>
      {Icon && <Icon className={`${iconSizes[size]} text-white`} />}
      {children}
    </div>
  );
}
