import { X } from "lucide-react";

interface StickyNoteProps {
  id: string;
  title: string;
  value: string;
  color: string;
  onDelete?: () => void;
}

const colorMap: Record<string, string> = {
  yellow: "bg-yellow-100 border-yellow-300",
  blue:   "bg-blue-100 border-blue-300",
  green:  "bg-green-100 border-green-300",
  purple: "bg-purple-100 border-purple-300",
  pink:   "bg-pink-100 border-pink-300",
};

const textColorMap: Record<string, string> = {
  yellow: "text-yellow-800",
  blue:   "text-blue-800",
  green:  "text-green-800",
  purple: "text-purple-800",
  pink:   "text-pink-800",
};

export function StickyNote({ id, title, value, color, onDelete }: StickyNoteProps) {
  const bg = colorMap[color] ?? "bg-gray-100 border-gray-300";
  const text = textColorMap[color] ?? "text-gray-800";

  return (
    <div className={`relative group inline-flex flex-col gap-0.5 px-3 py-2 rounded-xl border-2 shadow-sm animate-in fade-in zoom-in-95 duration-300 ${bg}`}>
      <span className={`text-[10px] font-medium uppercase tracking-wide opacity-60 ${text}`}>
        {title}
      </span>
      <span className={`text-sm font-bold ${text}`}>
        {value}
      </span>

      {onDelete && (
        <button
          onClick={() => onDelete()}
          className="absolute -top-1.5 -right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white rounded-full p-0.5 shadow border border-gray-200"
          aria-label="Delete note"
        >
          <X className="w-3 h-3 text-gray-500" />
        </button>
      )}
    </div>
  );
}
