import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, CheckCircle, Home } from "lucide-react";
import type { Layout, ApiNote } from "../App";

interface Message {
  id: string;
  type: "user" | "ai";
  text: string;
  options?: string[];
}

interface ChatPanelProps {
  onLayoutUpdate: (layout: Layout) => void;
  onNotesUpdate: (notes: ApiNote[]) => void;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "welcome",
    type: "ai",
    text: "Namaste! 🏠 Main aapka architect hoon — aayiye milke aapka dream home design karte hain. Batayiye, plot kitna bada hai aur kya kya chahiye ghar mein?",
  },
];

export function ChatPanel({ onLayoutUpdate, onNotesUpdate }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now().toString(), type: "user", text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    setIsLoading(true);

    try {
      // Build chat history for context
      const chatHistory = updatedMessages
        .filter((m) => m.id !== "welcome") // skip initial welcome
        .map((m) => ({ type: m.type, text: m.text }));

      const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/plotify"}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chatHistory,
        }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const data = await response.json();
      const llm = data.llmResponse;

      if (data.layout) onLayoutUpdate(data.layout);
      if (Array.isArray(data.notes)) onNotesUpdate(data.notes);
      if (llm.ready) setIsReady(true);

      if (llm.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            type: "ai",
            text: llm.message,
            options: llm.options?.length ? llm.options : undefined,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          type: "ai",
          text: "Oops, server se connection nahi ho paya. Backend chal raha hai na? 🤔",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePlan = () => {
    setIsGenerated(true);
    sendMessage("Generate my house plan");
  };

  return (
    <div className="h-full bg-white rounded-2xl shadow-2xl flex flex-col max-h-full">
      {/* Header — Architect themed */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex items-center gap-3 flex-shrink-0 rounded-t-2xl">
        <div className="bg-amber-400/20 p-2 rounded-lg backdrop-blur-sm">
          <Home className="w-5 h-5 text-amber-300" />
        </div>
        <div>
          <h2 className="text-white font-semibold text-sm">
            Plotify Architect
          </h2>
          <p className="text-white/60 text-xs">
            {isLoading ? "Soch raha hoon..." : "Your personal home designer"}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {(() => {
          // Only show options on the LAST ai message that has options
          const lastOptId = [...messages]
            .reverse()
            .find((m) => m.type === "ai" && m.options?.length)?.id;

          return messages.map((message) => (
            <div key={message.id}>
              <div
                className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                    message.type === "user"
                      ? "bg-slate-800 text-white ml-auto"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {message.text}
                </div>
              </div>

              {/* Quick-tap options */}
              {message.options && message.id === lastOptId && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {message.options.map((option) => (
                    <button
                      key={option}
                      onClick={() => sendMessage(option)}
                      disabled={isLoading}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-full text-xs font-medium hover:bg-slate-50 hover:border-slate-300 transition-all hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ));
        })()}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-5 py-3">
              <span className="flex gap-1">
                <span
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Generate Plan button */}
      <div className="px-4 pt-2 flex-shrink-0">
        <button
          onClick={handleGeneratePlan}
          disabled={isLoading}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
            isReady
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          {isGenerated
            ? "✓ Plan Generated"
            : isReady
              ? "Plan Generate Karo ✨"
              : "Generate Plan"}
        </button>
      </div>

      {/* Text input */}
      <div className="p-3 border-t border-gray-100 bg-white rounded-b-2xl flex-shrink-0 mt-1">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height =
                Math.min(e.target.scrollHeight, 96) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Batao kya chahiye ghar mein..."
            disabled={isLoading}
            rows={1}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-transparent text-sm disabled:opacity-50 resize-none overflow-hidden leading-5 placeholder:text-gray-400"
            style={{ minHeight: "42px", maxHeight: "96px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="p-2.5 bg-slate-800 text-white rounded-full hover:bg-slate-700 transition-all hover:scale-105 active:scale-95 flex-shrink-0 disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
