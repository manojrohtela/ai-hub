import { ReactNode } from "react";
import { IconContainer } from "./ui/IconContainer";
import { LucideIcon } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

interface PageHeaderProps {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
}

export function PageHeader({ title, icon, action }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-10 border-b app-header-surface backdrop-blur-sm">
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconContainer icon={icon} />
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle compact />
          {action ? <div>{action}</div> : null}
        </div>
      </div>
    </div>
  );
}
