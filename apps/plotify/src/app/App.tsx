import { useEffect, useState } from "react";
import { ChatPanel } from "./components/chat-panel";
import { FloorPlanCanvas } from "./components/floor-plan-canvas";
import { StickyNotesPanel } from "./components/sticky-notes-panel";

export interface LayoutRoom {
  roomType: string;
  name: string;
  x: number; // feet from plot origin
  y: number; // feet from plot origin
  width: number; // feet
  height: number; // feet
  color: string; // hex color
  door: string | null; // "north" | "south" | "east" | "west" | null
  zone: string;
  // New fields from v3 engine
  windows?: string[]; // exterior wall sides that have windows
  stairType?: string; // "straight" | "L-shaped" (only for stairs)
  stairDir?: string; // "up" (only for stairs)
}

export interface LayoutVariant {
  id: number;
  label: string;
  rooms: LayoutRoom[];
}

export interface Layout {
  variants: LayoutVariant[];
  plotWidth: number; // feet
  plotLength: number; // feet
  totalArea: number;
  description: string;
  // New fields from v3 engine
  wallThickness?: number; // feet (typically 0.75)
  roadDirection?: string; // "north" | "south" | "east" | "west"
}

export interface ApiNote {
  id: string;
  label: string;
  value: string;
  deleteAction?: { type: string; payload: Record<string, unknown> };
}

export default function App() {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [apiNotes, setApiNotes] = useState<ApiNote[]>([]);

  useEffect(() => {
    // Reset backend state on every fresh page load
    fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/plotify"}/reset`, { method: "POST" }).catch(() => {});
  }, []);

  /** Sends a direct action to backend (skips LLM), updates layout + notes. */
  const dispatchAction = async (action: {
    type: string;
    payload: Record<string, unknown>;
  }) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/plotify"}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data.layout) setLayout(data.layout);
      if (Array.isArray(data.notes)) setApiNotes(data.notes);
    } catch {
      // silently fail — note stays visible until next successful response
    }
  };

  return (
    <div className="w-screen h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 overflow-hidden">
      <div className="h-full w-full grid grid-cols-12 gap-4 p-4 max-h-screen">
        {/* Left: Chat Panel */}
        <div className="col-span-3 h-full overflow-hidden">
          <ChatPanel onLayoutUpdate={setLayout} onNotesUpdate={setApiNotes} />
        </div>

        {/* Center: Main Canvas */}
        <div className="col-span-6 h-full overflow-hidden">
          <FloorPlanCanvas layout={layout} />
        </div>

        {/* Right: Sticky Notes */}
        <div className="col-span-3 h-full overflow-hidden">
          <StickyNotesPanel
            apiNotes={apiNotes}
            onDispatchAction={dispatchAction}
          />
        </div>
      </div>
    </div>
  );
}
