import { motion } from "motion/react";
import { Bot, User } from "lucide-react";
import { AnswerAudit } from "../api";
import { AuditTrail } from "./AuditTrail";

interface ChatMessageProps {
  type: "user" | "ai";
  content: string;
  audit?: AnswerAudit;
}

export function ChatMessage({ type, content, audit }: ChatMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex ${type === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex gap-3 max-w-[85%] ${
          type === "user" ? "flex-row-reverse" : ""
        }`}
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            type === "user"
              ? "app-surface-inset text-foreground"
              : "bg-gradient-to-br from-indigo-500 to-purple-600"
          }`}
        >
          {type === "user" ? (
            <User className="w-4 h-4" />
          ) : (
            <Bot className="w-4 h-4" />
          )}
        </div>
        <div
          className={`rounded-2xl px-4 py-3 ${
            type === "user"
              ? "bg-indigo-600 text-white"
              : "app-surface-strong border text-foreground"
          }`}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
          {type === "ai" ? <AuditTrail audit={audit} /> : null}
        </div>
      </div>
    </motion.div>
  );
}
