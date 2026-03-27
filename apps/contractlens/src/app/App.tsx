import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Sparkles, AlertTriangle, CheckCircle2, Calendar,
  ClipboardList, MessageSquare, Send, Upload, AlertCircle, Scale,
} from 'lucide-react';
import { analyzeContract, chatContract } from './lib/api';
import type { AnalyzeResponse, RiskItem } from './lib/types';

type ChatMsg = { role: 'user' | 'assistant'; text: string };

const SEVERITY_COLORS: Record<string, string> = {
  high:   'bg-red-500/10 border-red-500/30 text-red-400',
  medium: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  low:    'bg-blue-500/10 border-blue-500/30 text-blue-400',
};
const SEVERITY_DOT: Record<string, string> = {
  high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-blue-400',
};

function RiskCard({ risk }: { risk: RiskItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden ${SEVERITY_COLORS[risk.severity]}`}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 p-4 text-left">
        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${SEVERITY_DOT[risk.severity]}`} />
        <div className="flex-1">
          <p className="text-sm font-medium">{risk.clause}</p>
          <span className="text-xs opacity-70 capitalize">{risk.severity} risk</span>
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2 border-t border-current/10 pt-3">
              <p className="text-xs opacity-80"><strong>Why it matters:</strong> {risk.explanation}</p>
              <p className="text-xs opacity-80"><strong>Suggestion:</strong> {risk.suggestion}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [contractText, setContractText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleFile(file: File) {
    setLoading(true); setError(null);
    if (!file.name.endsWith('.pdf')) {
      const t = await file.text(); setContractText(t);
    }
    try {
      const data = await analyzeContract(file);
      setResult(data); setChatMsgs([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || !contractText || chatLoading) return;
    const q = chatInput.trim(); setChatInput('');
    setChatMsgs(prev => [...prev, { role: 'user', text: q }]);
    setChatLoading(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const r = await chatContract(contractText, q);
      setChatMsgs(prev => [...prev, { role: 'assistant', text: r.answer }]);
    } catch (e) {
      setChatMsgs(prev => [...prev, { role: 'assistant', text: e instanceof Error ? e.message : 'Error' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  const riskColor = (score: number) =>
    score >= 70 ? 'text-red-400' : score >= 40 ? 'text-amber-400' : 'text-emerald-400';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">AI Legal Analysis</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Contract
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Lens</span>
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Upload any contract and instantly identify risks, obligations, and red flags in plain English.
          </p>
        </motion.div>

        {/* Upload zone */}
        {!result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className="border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-2xl p-14 text-center cursor-pointer transition-colors group"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400">Analyzing contract…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center group-hover:from-indigo-500/30 transition-colors">
                    <Scale className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Drop your contract here</p>
                    <p className="text-slate-500 text-sm mt-1">PDF or TXT · click to browse</p>
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
            {error && <div className="flex items-center gap-2 mt-3 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
          </motion.div>
        )}

        {/* Results */}
        {result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <button
              onClick={() => { setResult(null); setContractText(''); setChatMsgs([]); }}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Upload className="w-4 h-4" /> Analyze another contract
            </button>

            {/* Overview */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Contract Type</p>
                <p className="text-lg font-semibold text-white mb-3">{result.contract_type}</p>
                <p className="text-sm text-slate-300 leading-relaxed">{result.party_summary}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex flex-col items-center justify-center">
                <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Risk Score</p>
                <p className={`text-5xl font-bold ${riskColor(result.risk_score)}`}>{result.risk_score}</p>
                <p className="text-slate-500 text-sm">/ 100</p>
              </div>
            </div>

            {/* Plain summary */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" /> Plain English Summary
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">{result.plain_summary}</p>
            </div>

            {/* Key dates & obligations */}
            <div className="grid md:grid-cols-2 gap-4">
              {result.key_dates.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" /> Key Dates
                  </h3>
                  <ul className="space-y-1.5">
                    {result.key_dates.map(d => (
                      <li key={d} className="text-sm text-slate-300 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />{d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.key_obligations.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                  <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-indigo-400" /> Key Obligations
                  </h3>
                  <ul className="space-y-1.5">
                    {result.key_obligations.map(o => (
                      <li key={o} className="text-sm text-slate-300 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />{o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Risks */}
            {result.risks.length > 0 && (
              <div>
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> Identified Risks ({result.risks.length})
                </h3>
                <div className="space-y-2">
                  {result.risks.map((r, i) => <RiskCard key={i} risk={r} />)}
                </div>
              </div>
            )}

            {/* Missing clauses */}
            {result.missing_clauses.length > 0 && (
              <div className="bg-slate-800/50 border border-red-500/20 rounded-2xl p-5">
                <h3 className="font-semibold text-red-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Missing Clauses
                </h3>
                <div className="flex flex-wrap gap-2">
                  {result.missing_clauses.map(c => (
                    <span key={c} className="text-xs bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 text-red-300">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Chat */}
            {contractText && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" /> Ask About This Contract
                </h3>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {chatMsgs.map((m, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] text-sm px-4 py-2.5 rounded-2xl ${
                          m.role === 'user'
                            ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-tr-sm'
                            : 'bg-slate-700/60 text-slate-200 rounded-tl-sm'
                        }`}>{m.text}</div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {chatLoading && (
                    <div className="flex gap-1 px-2">
                      {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
                <div className="flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="What does clause 4.2 mean? Is there a termination penalty?"
                    className="flex-1 bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                    disabled={chatLoading} />
                  <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                    className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center disabled:opacity-40">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  * Not legal advice — consult a qualified lawyer for binding decisions.
                </p>
              </div>
            )}
          </motion.div>
        )}

        <p className="text-center text-xs text-slate-600 mt-8">ContractLens · Powered by Groq LLM · Not a substitute for legal counsel</p>
      </div>
    </div>
  );
}
