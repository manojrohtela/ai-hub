import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database, Upload, Send, Sparkles, Code2, TableProperties,
  AlertCircle, ChevronDown, ChevronRight, FileSpreadsheet,
} from 'lucide-react';
import { uploadCSV, runQuery } from './lib/api';
import type { ColumnInfo, QueryResponse, UploadResponse } from './lib/types';

type ChatRole = 'user' | 'assistant';

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  result?: QueryResponse;
}

function makeId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function SchemaPanel({ columns }: { columns: ColumnInfo[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2">
          <TableProperties className="w-4 h-4 text-indigo-400" />
          Table schema — {columns.length} columns
        </span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {columns.map(col => (
                <span
                  key={col.name}
                  className="inline-flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-1 text-xs text-indigo-300"
                >
                  <span className="font-mono font-semibold">{col.name}</span>
                  <span className="text-indigo-500">·</span>
                  <span className="text-slate-400">{col.dtype}</span>
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultTable({ result }: { result: QueryResponse }) {
  if (result.error) {
    return (
      <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300 mt-3">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span>{result.error}</span>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {/* SQL pill */}
      <div className="flex items-start gap-2 bg-slate-900/60 border border-slate-700/40 rounded-xl p-3">
        <Code2 className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
        <code className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-all">
          {result.sql}
        </code>
      </div>

      {/* Table */}
      {result.columns.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800/80">
                {result.columns.map(col => (
                  <th
                    key={col}
                    className="px-4 py-2 text-left text-xs font-semibold text-indigo-400 uppercase tracking-wider whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.slice(0, 50).map((row, ri) => (
                <tr
                  key={ri}
                  className="border-t border-slate-700/30 hover:bg-slate-800/30 transition-colors"
                >
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-4 py-2 text-slate-300 whitespace-nowrap text-xs">
                      {cell === null || cell === undefined ? (
                        <span className="text-slate-600 italic">null</span>
                      ) : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-slate-900/40 text-xs text-slate-500 border-t border-slate-700/30">
            {result.row_count} row{result.row_count !== 1 ? 's' : ''} returned
            {result.row_count > 50 ? ' (showing first 50)' : ''}
          </div>
        </div>
      )}

      {result.columns.length === 0 && !result.error && (
        <p className="text-xs text-slate-500 italic">No rows returned.</p>
      )}
    </div>
  );
}

const SAMPLE_QUESTIONS = [
  'Show the first 10 rows',
  'How many rows are there?',
  'What are the unique values in the first column?',
  'Show summary statistics',
];

export default function App() {
  const [session, setSession] = useState<UploadResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () =>
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setUploadError('Please upload a CSV file.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    setMessages([]);
    try {
      const resp = await uploadCSV(file);
      setSession(resp);
      setMessages([{
        id: makeId(),
        role: 'assistant',
        text: `Loaded **${file.name}** — ${resp.row_count.toLocaleString()} rows, ${resp.columns.length} columns. Ask me anything about this data!`,
      }]);
      scrollToBottom();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function sendQuestion(question: string) {
    if (!session || !question.trim() || querying) return;
    const q = question.trim();
    setInput('');
    setMessages(prev => [...prev, { id: makeId(), role: 'user', text: q }]);
    setQuerying(true);
    scrollToBottom();
    try {
      const result = await runQuery(session.session_id, q);
      setMessages(prev => [...prev, {
        id: makeId(),
        role: 'assistant',
        text: result.error
          ? 'I encountered an error running that query.'
          : `Found ${result.row_count.toLocaleString()} result${result.row_count !== 1 ? 's' : ''}.`,
        result,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: makeId(),
        role: 'assistant',
        text: err instanceof Error ? err.message : 'Something went wrong.',
      }]);
    } finally {
      setQuerying(false);
      scrollToBottom();
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8 flex flex-col min-h-screen">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">Natural Language SQL</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Data
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Whisperer
            </span>
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Upload any CSV and ask questions in plain English — get instant SQL-powered answers.
          </p>
        </motion.div>

        {/* Upload zone */}
        {!session && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              className="border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-2xl p-12 text-center cursor-pointer transition-colors duration-300 group"
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400">Loading your data…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center group-hover:from-indigo-500/30 group-hover:to-purple-600/30 transition-colors">
                    <FileSpreadsheet className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Drop your CSV here</p>
                    <p className="text-slate-500 text-sm mt-1">or click to browse</p>
                  </div>
                  <p className="text-xs text-slate-600">Any CSV file • headers required</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {uploadError && (
              <div className="flex items-center gap-2 mt-3 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {uploadError}
              </div>
            )}
          </motion.div>
        )}

        {/* Session banner + schema */}
        {session && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Database className="w-4 h-4 text-indigo-400" />
                <span className="font-mono text-indigo-300">{session.table_name}</span>
                <span className="text-slate-500">·</span>
                <span>{session.row_count.toLocaleString()} rows</span>
              </div>
              <button
                onClick={() => { setSession(null); setMessages([]); }}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-white transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                New file
              </button>
            </div>
            <SchemaPanel columns={session.columns} />
          </motion.div>
        )}

        {/* Chat area */}
        {session && (
          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ maxHeight: '50vh' }}>
              <AnimatePresence initial={false}>
                {messages.map(msg => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'user' ? (
                      <div className="max-w-[80%] bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="max-w-[90%] w-full">
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Database className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                            <p className="text-sm text-slate-200">{msg.text}</p>
                            {msg.result && <ResultTable result={msg.result} />}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {querying && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-slate-400">Generating SQL…</span>
                  </div>
                </motion.div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick suggestions */}
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {SAMPLE_QUESTIONS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendQuestion(q)}
                    className="text-xs bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/50 rounded-full px-3 py-1.5 text-slate-400 hover:text-white transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 focus-within:border-indigo-500/50 rounded-2xl px-4 py-3 transition-colors">
              <input
                className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
                placeholder="Ask a question about your data…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendQuestion(input)}
                disabled={querying}
              />
              <button
                onClick={() => sendQuestion(input)}
                disabled={!input.trim() || querying}
                className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-6">
          DataWhisperer · Powered by Groq LLM · Data stays in your session
        </p>
      </div>
    </div>
  );
}
