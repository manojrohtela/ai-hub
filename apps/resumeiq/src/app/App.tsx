import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Briefcase, Upload, Send, Sparkles, CheckCircle2, AlertCircle,
  TrendingUp, FileText, Star, ChevronDown, ChevronRight, MessageSquare,
} from 'lucide-react';
import { analyzeResume, chatWithResume } from './lib/api';
import type { AnalyzeResponse, ScoreSection } from './lib/types';

type Screen = 'upload' | 'results';
type ChatMsg = { role: 'user' | 'assistant'; text: string };

function ScoreRing({ score }: { score: number }) {
  const color =
    score >= 80 ? 'text-emerald-400' :
    score >= 60 ? 'text-yellow-400' :
    'text-red-400';
  const ring =
    score >= 80 ? 'stroke-emerald-400' :
    score >= 60 ? 'stroke-yellow-400' :
    'stroke-red-400';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="rgb(51,65,85)" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          className={ring}
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

function SectionBar({ section }: { section: ScoreSection }) {
  const [open, setOpen] = useState(false);
  const color =
    section.score >= 80 ? 'bg-emerald-500' :
    section.score >= 60 ? 'bg-yellow-500' :
    'bg-red-500';

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/70 transition-colors"
      >
        <div className="flex-1 text-left">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-slate-200">{section.label}</span>
            <span className="text-sm font-semibold text-white">{section.score}</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${color}`}
              initial={{ width: 0 }}
              animate={{ width: `${section.score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
        <div className="flex-shrink-0">
          {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </div>
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
            <p className="px-4 pb-3 text-sm text-slate-400 border-t border-slate-700/50 pt-2">
              {section.feedback}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('upload');
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jobDesc, setJobDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    try {
      // Store raw text for chat later (read as text for non-PDF, skip for PDF)
      if (!file.name.endsWith('.pdf')) {
        const text = await file.text();
        setResumeText(text);
      }
      const data = await analyzeResume(file, jobDesc || undefined);
      setResult(data);
      setScreen('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading || !resumeText) return;
    const q = chatInput.trim();
    setChatInput('');
    setChatMsgs(prev => [...prev, { role: 'user', text: q }]);
    setChatLoading(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    try {
      const resp = await chatWithResume(resumeText, q, jobDesc || undefined);
      setChatMsgs(prev => [...prev, { role: 'assistant', text: resp.answer }]);
    } catch (err) {
      setChatMsgs(prev => [...prev, { role: 'assistant', text: err instanceof Error ? err.message : 'Error' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

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
            <span className="text-sm text-indigo-300">AI Career Coach</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Resume
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">IQ</span>
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Upload your resume and get an instant AI-powered score, actionable feedback, and career coaching.
          </p>
        </motion.div>

        {/* Upload screen */}
        {screen === 'upload' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Optional JD */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
              <label className="text-sm font-medium text-slate-300 mb-2 block flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-400" />
                Job Description (optional — for keyword match)
              </label>
              <textarea
                value={jobDesc}
                onChange={e => setJobDesc(e.target.value)}
                rows={3}
                className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-indigo-500/50 resize-none"
                placeholder="Paste the job description here…"
              />
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
              className="border-2 border-dashed border-slate-600 hover:border-indigo-500 rounded-2xl p-12 text-center cursor-pointer transition-colors duration-300 group"
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-400">Analysing your resume…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-2xl flex items-center justify-center group-hover:from-indigo-500/30 group-hover:to-purple-600/30 transition-colors">
                    <FileText className="w-8 h-8 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-white font-medium">Drop your resume here</p>
                    <p className="text-slate-500 text-sm mt-1">PDF or TXT • click to browse</p>
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />{error}
              </div>
            )}
          </motion.div>
        )}

        {/* Results screen */}
        {screen === 'results' && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Back */}
            <button
              onClick={() => { setScreen('upload'); setResult(null); setChatMsgs([]); }}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <Upload className="w-4 h-4" /> Analyse another resume
            </button>

            {/* Overall score */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-center">
              <ScoreRing score={result.overall_score} />
              <p className="mt-4 text-slate-300 text-sm max-w-lg mx-auto">{result.summary}</p>
            </div>

            {/* Section scores */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-400" /> Section Breakdown
              </h2>
              <div className="space-y-2">
                {result.sections.map(s => <SectionBar key={s.label} section={s} />)}
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800/50 border border-emerald-500/20 rounded-2xl p-4">
                <h3 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Strengths
                </h3>
                <ul className="space-y-2">
                  {result.strengths.map(s => (
                    <li key={s} className="flex items-start gap-2 text-sm text-slate-300">
                      <Star className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-slate-800/50 border border-amber-500/20 rounded-2xl p-4">
                <h3 className="font-semibold text-amber-400 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Improvements
                </h3>
                <ul className="space-y-2">
                  {result.improvements.map(s => (
                    <li key={s} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />{s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Keywords */}
            {(result.keywords_found.length > 0 || result.keywords_missing.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {result.keywords_found.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Keywords Found</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords_found.map(k => (
                        <span key={k} className="text-xs bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 text-emerald-300">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
                {result.keywords_missing.length > 0 && (
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-3">Keywords Missing</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords_missing.map(k => (
                        <span key={k} className="text-xs bg-red-500/10 border border-red-500/20 rounded-full px-3 py-1 text-red-300">{k}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Chat (only if we have text) */}
            {resumeText && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-indigo-400" /> Ask Your Career Coach
                </h3>
                <div className="space-y-3 mb-4 max-h-64 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {chatMsgs.map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] text-sm px-4 py-2.5 rounded-2xl ${
                          m.role === 'user'
                            ? 'bg-gradient-to-br from-indigo-600 to-purple-600 rounded-tr-sm text-white'
                            : 'bg-slate-700/60 rounded-tl-sm text-slate-200'
                        }`}>
                          {m.text}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {chatLoading && (
                    <div className="flex gap-1 px-4">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="How can I improve my summary section?"
                    className="flex-1 bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                    disabled={chatLoading}
                  />
                  <button
                    onClick={sendChat}
                    disabled={!chatInput.trim() || chatLoading}
                    className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center disabled:opacity-40"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        <p className="text-center text-xs text-slate-600 mt-8">
          ResumeIQ · Powered by Groq LLM · Your data is never stored
        </p>
      </div>
    </div>
  );
}
