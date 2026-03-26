import { useState } from "react";
import { StickyNote } from "./sticky-note";
import { Plus } from "lucide-react";
import type { ApiNote } from "../App";

interface ManualNote {
  id: string;
  title: string;
  value: string;
  color: string;
}

interface StickyNotesPanelProps {
  apiNotes: ApiNote[];
  onDispatchAction: (action: { type: string; payload: Record<string, unknown> }) => Promise<void>;
}

const COLORS = ["yellow", "blue", "green", "purple", "pink"];

const NOTE_COLORS: Record<string, string> = {
  plot:          "yellow",
  roadDirection: "blue",
  houseType:     "pink",
  floors:        "blue",
  bedroom:       "purple",
  masterBedroom: "pink",
  guestRoom:     "yellow",
  bathroom:      "blue",
  kitchen:       "green",
  livingRoom:    "blue",
  dining:        "yellow",
  study:         "green",
  garage:        "blue",
  parking:       "blue",
  poojaRoom:     "yellow",
  garden:        "green",
  terrace:       "blue",
  store:         "yellow",
};

export function StickyNotesPanel({ apiNotes, onDispatchAction }: StickyNotesPanelProps) {
  const [manualNotes, setManualNotes] = useState<ManualNote[]>([]);

  const handleDeleteManual = (id: string) => () => {
    setManualNotes((prev) => prev.filter((n) => n.id !== id));
  };

  /** Called when an API note's delete button is clicked. Sends action to backend. */
  const handleDeleteApiNote = (deleteAction: ApiNote["deleteAction"]) => {
    if (deleteAction) {
      onDispatchAction(deleteAction as { type: string; payload: Record<string, unknown> });
    }
  };

  const handleAddNote = () => {
    setManualNotes((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        title: "New Note",
        value: "Edit me",
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      },
    ]);
  };

  return (
    <div className="h-full flex flex-col p-6 bg-white/40 backdrop-blur-sm overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">Notes</h2>
        <button
          onClick={handleAddNote}
          className="p-2 rounded-full bg-white shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95"
          aria-label="Add note"
        >
          <Plus className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      <div className="flex flex-wrap gap-3 content-start">
        {apiNotes.length === 0 && manualNotes.length === 0 ? (
          <p className="text-sm text-gray-400 mt-8 w-full text-center">
            Notes will appear here as you chat.
          </p>
        ) : (
          <>
            {apiNotes.map((note) => (
              <StickyNote
                key={note.id}
                id={note.id}
                title={note.label}
                value={note.value}
                color={NOTE_COLORS[note.id] ?? COLORS[note.id.charCodeAt(0) % COLORS.length]}
                onDelete={
                  note.deleteAction
                    ? () => handleDeleteApiNote(note.deleteAction)
                    : undefined
                }
              />
            ))}
            {manualNotes.map((note) => (
              <StickyNote
                key={note.id}
                id={note.id}
                title={note.title}
                value={note.value}
                color={note.color}
                onDelete={handleDeleteManual(note.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
