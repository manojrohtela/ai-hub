import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic, Send, Sparkles, CheckCircle2, AlertCircle,
  Trophy, ChevronDown, ChevronRight, RotateCcw, User,
} from 'lucide-react';
import { startInterview, submitAnswer, getSummary } from './lib/api';
import type { AnswerResponse, FeedbackItem, StartResponse, SummaryResponse } from './lib/types';

type Screen = 'setup' | 'interview' | 'feedback' | 'summary';

const LEVELS = ['junior', 'mid', 'senior'];
const FOCUS_AREAS = ['General', 'Behavioural', 'System Design', 'Coding', 'Leadership', 'Product'];

function FeedbackCard({ item }: { item: FeedbackItem }) {
  const color = item.score >= 8 ? 'text-emerald-400' : item.score >= 5 ? 'text-yellow-400' : 'text-red-400';
  const bar = item.score >= 8 ? 'bg-emerald-500' : item.score >= 5 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="bg-slate-900/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-300">{item.category}</span>
        <span className={`text-xs font-bold ${color}`}>{item.score}/10</span>
      </div>
      <div className="h-1 bg-slate-700 rounded-full overflow-hidden mb-1.5">
        <motion.div className={`h-full rounded-full ${bar}`}
          initial={{ width: 0 }} animate={{ width: `${item.score * 10}%` }} transition={{ duration: 0.6 }} />
      </div>
      <p className="text-xs text-slate-400">{item.comment}</p>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [role, setRole] = useState('');
  const [level, setLevel] = useState('mid');
  const [focus, setFocus] = useState('General');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [session, setSession] = useState<StartResponse | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedbackData, setFeedbackData] = useState<AnswerResponse | null>(null);
  const [showSample, setShowSample] = useState(false);
  const [currentQ, setCurrentQ] = useState('');
  const [qNum, setQNum] = useState(1);

  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  async function handleStart() {
    if (!role.trim()) { setError('Please enter a job role.'); return; }
    setLoading(true); setError(null);
    try {
      const resp = await startInterview(role, level, focus === 'General' ? undefined : focus);
      setSession(resp);
      setCurrentQ(resp.first_question);
      setQNum(1);
      setScreen('interview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswer() {
    if (!answer.trim() || !session || loading) return;
    setLoading(true); setError(null);
    try {
      const resp = await submitAnswer(session.session_id, answer);
      setFeedbackData(resp);
      setShowSample(false);
      setAnswer('');
      setScreen('feedback');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  async function handleNext() {
    if (!feedbackData || !session) return;
    if (feedbackData.is_complete) {
      setLoading(true);
      try {
        const s = await getSummary(session.session_id);
        setSummary(s);
        setScreen('summary');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to get summary');
      } finally {
        setLoading(false);
      }
    } else {
      setCurrentQ(feedbackData.next_question!);
      setQNum(feedbackData.question_number + 1);
      setFeedbackData(null);
      setScreen('interview');
    }
  }

  function handleReset() {
    setScreen('setup'); setSession(null); setFeedbackData(null);
    setSummary(null); setRole(''); setAnswer(''); setError(null);
  }

  const verdictColor = (v: string) =>
    v === 'Excellent' ? 'text-emerald-400' :
    v === 'Good' ? 'text-indigo-400' :
    v === 'Needs Improvement' ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">AI Mock Interview</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Interview
            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Coach</span>
          </h1>
          <p className="text-slate-400 max-w-md mx-auto">
            Practice with {session?.total_questions ?? 5} AI-generated questions and get expert feedback instantly.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Setup */}
          {screen === 'setup' && (
            <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Job Role *</label>
                  <input value={role} onChange={e => setRole(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleStart()}
                    placeholder="e.g. Frontend Engineer, Product Manager…"
                    className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none" />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Experience Level</label>
                  <div className="flex gap-2">
                    {LEVELS.map(l => (
                      <button key={l} onClick={() => setLevel(l)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors capitalize ${
                          level === l
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                            : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                        }`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-300 mb-2 block">Focus Area</label>
                  <div className="flex flex-wrap gap-2">
                    {FOCUS_AREAS.map(f => (
                      <button key={f} onClick={() => setFocus(f)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          focus === f
                            ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                            : 'bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white'
                        }`}>
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

              <button onClick={handleStart} disabled={loading || !role.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white py-4 rounded-2xl text-base font-medium transition-all flex items-center justify-center gap-2">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Mic className="w-5 h-5" />Start Interview</>}
              </button>
            </motion.div>
          )}

          {/* Interview */}
          {screen === 'interview' && (
            <motion.div key="interview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4">
              <div className="flex items-center justify-between text-sm text-slate-400">
                <span>Question {qNum} of {session?.total_questions}</span>
                <div className="flex gap-1">
                  {Array.from({ length: session?.total_questions ?? 5 }).map((_, i) => (
                    <div key={i} className={`w-6 h-1.5 rounded-full ${i < qNum ? 'bg-indigo-500' : 'bg-slate-700'}`} />
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-indigo-500/20 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Mic className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-white text-base leading-relaxed">{currentQ}</p>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
                <label className="text-xs text-slate-500 mb-2 block flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Your Answer
                </label>
                <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={6}
                  placeholder="Type your answer here… Be specific, use examples, structure your response."
                  className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none resize-none" />
              </div>

              {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

              <button onClick={handleAnswer} disabled={loading || !answer.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40 text-white py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 transition-all">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-4 h-4" />Submit Answer</>}
              </button>
            </motion.div>
          )}

          {/* Feedback */}
          {screen === 'feedback' && feedbackData && (
            <motion.div key="feedback" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="space-y-4">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 text-center">
                <p className="text-slate-400 text-sm mb-1">Overall Score</p>
                <span className={`text-5xl font-bold ${
                  feedbackData.overall_score >= 8 ? 'text-emerald-400' :
                  feedbackData.overall_score >= 5 ? 'text-yellow-400' : 'text-red-400'
                }`}>{feedbackData.overall_score}</span>
                <span className="text-slate-500 text-xl">/10</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {feedbackData.feedback.map(f => <FeedbackCard key={f.category} item={f} />)}
              </div>

              {/* Sample answer toggle */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
                <button onClick={() => setShowSample(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:text-white transition-colors">
                  <span>View model answer</span>
                  {showSample ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <AnimatePresence>
                  {showSample && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                      className="overflow-hidden">
                      <p className="px-4 pb-4 text-sm text-slate-300 border-t border-slate-700/50 pt-3 leading-relaxed">
                        {feedbackData.sample_answer}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={handleNext} disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 disabled:opacity-40 text-white py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : feedbackData.is_complete ? <><Trophy className="w-4 h-4" />View Final Report</>
                  : <><Send className="w-4 h-4" />Next Question ({feedbackData.question_number + 1}/{feedbackData.total_questions})</>}
              </button>
            </motion.div>
          )}

          {/* Summary */}
          {screen === 'summary' && summary && (
            <motion.div key="summary" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="space-y-5">
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 text-center">
                <Trophy className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-1">{summary.role} · {summary.level}</p>
                <p className={`text-3xl font-bold mb-1 ${verdictColor(summary.verdict)}`}>{summary.verdict}</p>
                <p className="text-slate-400">Avg score: <span className="text-white font-semibold">{summary.average_score}/10</span></p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-800/50 border border-emerald-500/20 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Top Strengths
                  </h3>
                  <ul className="space-y-2">
                    {summary.top_strengths.map(s => (
                      <li key={s} className="text-sm text-slate-300 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="bg-slate-800/50 border border-amber-500/20 rounded-2xl p-4">
                  <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Areas to Improve
                  </h3>
                  <ul className="space-y-2">
                    {summary.top_improvements.map(s => (
                      <li key={s} className="text-sm text-slate-300 flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button onClick={handleReset}
                className="w-full bg-slate-800 border border-slate-700 hover:border-indigo-500/50 text-white py-3.5 rounded-2xl font-medium flex items-center justify-center gap-2 transition-colors">
                <RotateCcw className="w-4 h-4" /> Practice Again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-slate-600 mt-8">InterviewCoach · Powered by Groq LLM</p>
      </div>
    </div>
  );
}
