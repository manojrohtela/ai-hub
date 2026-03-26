import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import { ChatPanelHeader } from "./ChatPanelHeader";
import { useData } from "../DataContext";
import { analyzeDataset, AnswerAudit } from "../api";

interface Message {
  id: number;
  type: "user" | "ai";
  content: string;
  audit?: AnswerAudit;
}

interface ChatPanelProps {
  initialMessages?: Message[];
  className?: string;
  onClose?: () => void;
}

function looksLikeChartRequest(question: string) {
  return /(chart|plot|graph|visual|pie|bar|line|scatter|trend|forecast|prediction|correlation|distribution|outlier|compare)/i.test(
    question
  );
}

export function ChatPanel({ initialMessages = [], className = "", onClose }: ChatPanelProps) {
  const {
    setAiChartHistory,
    setPendingAiChartPrompt,
    selectedFile,
    useDemo,
    demoDatasetName,
  } = useData();
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.length > 0
      ? initialMessages
      : [
          {
            id: 1,
            type: "ai",
            content: "Hello! I've analyzed your data. What insights would you like to explore?",
          },
        ]
  );
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const questionText = inputValue.trim();
    const userMessage: Message = {
      id: messages.length + 1,
      type: "user",
      content: questionText,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);

    const shouldShowChartPlaceholder = looksLikeChartRequest(questionText);
    if (shouldShowChartPlaceholder) {
      setPendingAiChartPrompt(questionText);
    }

    try {
      const aiResponse = await analyzeDataset(
        useDemo, 
        questionText, 
        selectedFile || undefined, 
        demoDatasetName || undefined
      );

      if (aiResponse.charts?.dynamic_chart) {
        setAiChartHistory((previousCharts) => [
          ...previousCharts,
          {
            id: `${Date.now()}-${previousCharts.length + 1}`,
            prompt: questionText,
            chart: aiResponse.charts.dynamic_chart,
            createdAt: new Date().toISOString(),
          },
        ]);
      }

      const chartHint = aiResponse.charts?.dynamic_chart
        ? "\n\nThe chart has been added to the AI Charts section."
        : "";
      
      const aiMessage: Message = {
        id: messages.length + 2,
        type: "ai",
        content: `${aiResponse.structured_report}${chartHint}`,
        audit: aiResponse.answer_audit,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
      const errorMessage: Message = {
        id: messages.length + 2,
        type: "ai",
        content: "I encountered an error while trying to process your request. Please try again.",
        audit: {
          question: questionText,
          question_type: "ERROR",
          evidence: ["The request failed before a verified answer could be produced."],
        },
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      if (shouldShowChartPlaceholder) {
        setPendingAiChartPrompt(null);
      }
      setIsTyping(false);
    }
  };

  return (
    <div className={`app-chat-surface flex h-full flex-col overflow-hidden rounded-[28px] border backdrop-blur-xl ${className}`}>
      <ChatPanelHeader onClose={onClose} />

      {/* Chat Messages */}
      <div className="app-accent-ai flex-1 overflow-y-auto p-5 space-y-4">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            type={message.type}
            content={message.content}
            audit={message.audit}
          />
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      <div className="border-t app-surface-inset p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Ask anything about your data..."
            className="app-chat-input flex-1 rounded-2xl border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isTyping}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-3 transition-all duration-300 hover:scale-105 hover:from-cyan-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
