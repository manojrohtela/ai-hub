import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Zap, Sparkles, AlertCircle, RotateCcw, Copy,
  Check, Palette, Type, Globe, Megaphone, Target,
} from 'lucide-react';
import { generateBrand, refineBrand } from './lib/api';
import type { BrandResponse, ColorPalette, NameOption } from './lib/types';

const TONES = ['Professional', 'Playful', 'Bold', 'Minimal', 'Luxury', 'Techy'];
const INDUSTRIES = [
  'SaaS / Tech', 'Health & Wellness', 'E-commerce', 'FinTech', 'EdTech',
  'Food & Beverage', 'Fashion', 'Media', 'Sustainability', 'Other',
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-white"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function ColorSwatch({ label, hex }: { label: string; hex: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="w-12 h-12 rounded-xl border border-slate-700/50 shadow" style={{ backgroundColor: hex }} />
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xs font-mono text-slate-300">{hex}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <Icon className="w-4 h-4 text-indigo-400" />{title}
      </h3>
      {children}
    </div>
  );
}

export default function App() {
  const [idea, setIdea] = useState('');
  const [industry, setIndustry] = useState('SaaS / Tech');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('Professional');
  const [competitors, setCompetitors] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brand, setBrand] = useState<BrandResponse | null>(null);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);
  const [refineResult, setRefineResult] = useState<{ section: string; suggestion: string } | null>(null);

  async function handleGenerate() {
    if (!idea.trim() || !audience.trim()) { setError('Please fill in your startup idea and target audience.'); return; }
    setLoading(true); setError(null); setRefineResult(null);
    try {
      const comp = competitors.split(',').map(s => s.trim()).filter(Boolean);
      const data = await generateBrand(idea, industry, audience, tone, comp);
      setBrand(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate brand');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!feedback.trim() || !brand) return;
    setRefining(true);
    try {
      const r = await refineBrand(JSON.stringify(brand), feedback);
      setRefineResult({ section: r.updated_section, suggestion: r.suggestion });
      setFeedback('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refinement failed');
    } finally {
      setRefining(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-sm text-indigo-300">AI Brand Identity</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Brand
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Forge</span>
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Describe your startup and get a complete brand identity — names, colors, taglines, pitch, and more.
          </p>
        </motion.div>

        {/* Setup form */}
        {!brand && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Startup Idea *</label>
              <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={3}
                placeholder="e.g. An AI-powered tool that helps freelancers automatically track their time and invoice clients…"
                className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none resize-none" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Industry</label>
                <select value={industry} onChange={e => setIndustry(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-sm text-white outline-none">
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Target Audience *</label>
                <input value={audience} onChange={e => setAudience(e.target.value)}
                  placeholder="e.g. Freelancers, small business owners aged 25-45"
                  className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Brand Tone</label>
              <div className="flex flex-wrap gap-2">
                {TONES.map(t => (
                  <button key={t} onClick={() => setTone(t)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      tone === t
                        ? 'bg-indigo-500/20 border border-indigo-500/40 text-indigo-300'
                        : 'bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white'
                    }`}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Competitors (optional, comma-separated)</label>
              <input value={competitors} onChange={e => setCompetitors(e.target.value)}
                placeholder="e.g. Toggl, Harvest, Clockify"
                className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none" />
            </div>

            {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            <button onClick={handleGenerate} disabled={loading || !idea.trim() || !audience.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white py-4 rounded-2xl text-base font-medium flex items-center justify-center gap-2 transition-all">
              {loading
                ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Forging your brand…</>
                : <><Zap className="w-5 h-5" />Forge My Brand</>
              }
            </button>
          </motion.div>
        )}

        {/* Brand results */}
        {brand && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Your Brand Identity</h2>
              <button onClick={() => { setBrand(null); setRefineResult(null); }}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
                <RotateCcw className="w-4 h-4" /> Start over
              </button>
            </div>

            {/* Elevator pitch */}
            <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/40 to-pink-900/40 border border-indigo-500/20 rounded-2xl p-6 text-center">
              <p className="text-white text-lg leading-relaxed italic">"{brand.elevator_pitch}"</p>
            </div>

            {/* Brand names */}
            <Section title="Brand Name Options" icon={Target}>
              <div className="space-y-3">
                {brand.brand_names.map((n: NameOption) => (
                  <div key={n.name} className="bg-slate-900/50 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xl font-bold text-white">{n.name}</p>
                        <p className="text-xs text-indigo-400 flex items-center gap-1 mt-0.5">
                          <Globe className="w-3 h-3" />{n.domain_hint}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">{n.rationale}</p>
                      </div>
                      <CopyButton text={n.name} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Taglines */}
            <Section title="Taglines" icon={Megaphone}>
              <div className="space-y-2">
                {brand.taglines.map(t => (
                  <div key={t} className="flex items-center justify-between bg-slate-900/50 rounded-xl px-4 py-3">
                    <p className="text-sm text-white italic">"{t}"</p>
                    <CopyButton text={t} />
                  </div>
                ))}
              </div>
            </Section>

            {/* Mission + Voice */}
            <div className="grid md:grid-cols-2 gap-4">
              <Section title="Mission Statement" icon={Target}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-300 leading-relaxed">{brand.mission_statement}</p>
                  <CopyButton text={brand.mission_statement} />
                </div>
              </Section>
              <Section title="Brand Voice" icon={Megaphone}>
                <p className="text-sm text-slate-300 leading-relaxed">{brand.brand_voice}</p>
              </Section>
            </div>

            {/* Value props */}
            <Section title="Value Propositions" icon={Zap}>
              <ul className="space-y-2">
                {brand.value_propositions.map(vp => (
                  <li key={vp} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />{vp}
                  </li>
                ))}
              </ul>
            </Section>

            {/* Color palette */}
            <Section title="Color Palette" icon={Palette}>
              <div className="flex flex-wrap gap-6 justify-center mb-4">
                {(['primary','secondary','accent','background','text'] as const).map(k => (
                  <ColorSwatch key={k} label={k} hex={brand.color_palette[k as keyof ColorPalette] as string} />
                ))}
              </div>
              <p className="text-xs text-slate-400 text-center">{brand.color_palette.rationale}</p>
            </Section>

            {/* Fonts */}
            <Section title="Font Recommendations" icon={Type}>
              <div className="flex flex-wrap gap-2">
                {brand.font_recommendations.map(f => (
                  <span key={f} className="bg-slate-900/60 border border-slate-700/40 rounded-full px-3 py-1.5 text-sm text-slate-300">{f}</span>
                ))}
              </div>
            </Section>

            {/* Social bio */}
            <Section title="Social Media Bio" icon={Globe}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-slate-300">{brand.social_bio}</p>
                <CopyButton text={brand.social_bio} />
              </div>
              <p className="text-xs text-slate-600 mt-1">{brand.social_bio.length} / 150 chars</p>
            </Section>

            {/* Refinement */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Refine with Feedback
              </h3>
              <div className="flex gap-2">
                <input value={feedback} onChange={e => setFeedback(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRefine()}
                  placeholder="e.g. Make the name more playful, or suggest a different color scheme…"
                  className="flex-1 bg-slate-900/60 border border-slate-700/50 focus:border-indigo-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                  disabled={refining} />
                <button onClick={handleRefine} disabled={!feedback.trim() || refining}
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl text-sm font-medium disabled:opacity-40 flex items-center gap-2">
                  {refining ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Refine'}
                </button>
              </div>
              <AnimatePresence>
                {refineResult && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-xs text-indigo-400 mb-1 font-medium capitalize">{refineResult.section}</p>
                    <p className="text-sm text-slate-200">{refineResult.suggestion}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        <p className="text-center text-xs text-slate-600 mt-8">BrandForge · Powered by Groq LLM</p>
      </div>
    </div>
  );
}
