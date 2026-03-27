import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Leaf, Sparkles, Send, AlertCircle, ShoppingCart,
  Clock, Flame, Dumbbell, ChevronDown, ChevronRight,
  MessageSquare, RotateCcw, Lightbulb,
} from 'lucide-react';
import { generatePlan, chatNutri } from './lib/api';
import type { DayPlan, Meal, PlanResponse } from './lib/types';

type ChatMsg = { role: 'user' | 'assistant'; text: string };

const GOALS = ['Lose Weight', 'Build Muscle', 'Maintain Weight', 'Improve Energy', 'Eat Healthier'];
const DIETS = ['Omnivore', 'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Mediterranean'];
const COMMON_ALLERGIES = ['Gluten', 'Dairy', 'Nuts', 'Eggs', 'Soy', 'Shellfish'];

function MacroBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${color}`}>
      {label}: <strong>{value}g</strong>
    </span>
  );
}

function MealCard({ meal }: { meal: Meal }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-900/60 border border-slate-700/30 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-800/40 transition-colors">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{meal.name}</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <Flame className="w-3 h-3" />{meal.calories} kcal
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock className="w-3 h-3" />{meal.prep_minutes}m
            </span>
            <MacroBadge label="P" value={meal.protein_g} color="bg-emerald-500/10 text-emerald-400" />
            <MacroBadge label="C" value={meal.carbs_g} color="bg-blue-500/10 text-blue-400" />
            <MacroBadge label="F" value={meal.fat_g} color="bg-amber-500/10 text-amber-400" />
          </div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-500 mt-1" /> : <ChevronRight className="w-4 h-4 text-slate-500 mt-1" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="px-3 pb-3 border-t border-slate-700/30 pt-2">
              <p className="text-xs text-slate-500 mb-1">Ingredients</p>
              <div className="flex flex-wrap gap-1">
                {meal.ingredients.map(i => (
                  <span key={i} className="text-xs bg-slate-800 border border-slate-700/50 rounded-full px-2 py-0.5 text-slate-300">{i}</span>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DayCard({ day }: { day: DayPlan }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/70 transition-colors">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-white">{day.day}</span>
          <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5">
            <Flame className="w-3 h-3" />{day.total_calories} kcal
          </span>
          <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">
            <Dumbbell className="w-3 h-3" />{day.total_protein_g}g protein
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2 border-t border-slate-700/30 pt-3">
              {day.meals.map((m, i) => <MealCard key={i} meal={m} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const [goal, setGoal] = useState('');
  const [diet, setDiet] = useState('Omnivore');
  const [calories, setCalories] = useState('');
  const [allergies, setAllergies] = useState<string[]>([]);
  const [days, setDays] = useState(7);
  const [mealsPerDay, setMealsPerDay] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const toggleAllergy = (a: string) =>
    setAllergies(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]);

  async function handleGenerate() {
    if (!goal) { setError('Please select a goal.'); return; }
    setLoading(true); setError(null);
    try {
      const p = await generatePlan(
        goal, diet, calories ? Number(calories) : null, allergies, days, mealsPerDay,
      );
      setPlan(p); setChatMsgs([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  }

  async function sendChat() {
    if (!chatInput.trim() || chatLoading) return;
    const q = chatInput.trim(); setChatInput('');
    setChatMsgs(prev => [...prev, { role: 'user', text: q }]);
    setChatLoading(true);
    const summary = plan ? `Goal: ${plan.goal}, Diet: ${plan.diet_type}, Calories: ${plan.daily_calorie_target}/day` : undefined;
    try {
      const r = await chatNutri(q, summary);
      setChatMsgs(prev => [...prev, { role: 'assistant', text: r.answer }]);
    } catch (e) {
      setChatMsgs(prev => [...prev, { role: 'assistant', text: e instanceof Error ? e.message : 'Error' }]);
    } finally { setChatLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 mb-4">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-emerald-300">AI Nutrition Coach</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">
            Nutri
            <span className="bg-gradient-to-r from-emerald-400 to-indigo-400 bg-clip-text text-transparent">Plan</span>
          </h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            Get a personalised meal plan with macros, ingredients, and a shopping list — tailored to your goals.
          </p>
        </motion.div>

        {!plan ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 space-y-5">
            {/* Goal */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Your Goal *</label>
              <div className="flex flex-wrap gap-2">
                {GOALS.map(g => (
                  <button key={g} onClick={() => setGoal(g)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                      goal === g
                        ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 text-white'
                        : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                    }`}>{g}</button>
                ))}
              </div>
            </div>

            {/* Diet */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Diet Type</label>
              <div className="flex flex-wrap gap-2">
                {DIETS.map(d => (
                  <button key={d} onClick={() => setDiet(d)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                      diet === d
                        ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white'
                    }`}>{d}</button>
                ))}
              </div>
            </div>

            {/* Days + Meals + Calories */}
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Days ({days})</label>
                <input type="range" min={1} max={7} value={days} onChange={e => setDays(Number(e.target.value))}
                  className="w-full accent-emerald-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Meals / Day ({mealsPerDay})</label>
                <input type="range" min={2} max={5} value={mealsPerDay} onChange={e => setMealsPerDay(Number(e.target.value))}
                  className="w-full accent-emerald-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-2 block">Calorie Target (optional)</label>
                <input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="e.g. 1800"
                  className="w-full bg-slate-900/60 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 outline-none" />
              </div>
            </div>

            {/* Allergies */}
            <div>
              <label className="text-sm font-medium text-slate-300 mb-2 block">Allergies / Avoid</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_ALLERGIES.map(a => (
                  <button key={a} onClick={() => toggleAllergy(a)}
                    className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                      allergies.includes(a)
                        ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                        : 'bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white'
                    }`}>{a}</button>
                ))}
              </div>
            </div>

            {error && <div className="flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}

            <button onClick={handleGenerate} disabled={loading || !goal}
              className="w-full bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-40 text-white py-4 rounded-2xl text-base font-medium flex items-center justify-center gap-2 transition-all">
              {loading
                ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating your plan…</>
                : <><Leaf className="w-5 h-5" />Generate Meal Plan</>
              }
            </button>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white capitalize">{plan.goal} · {plan.diet_type}</h2>
                <p className="text-sm text-slate-400">{plan.daily_calorie_target} kcal/day · {plan.days.length}-day plan</p>
              </div>
              <button onClick={() => setPlan(null)}
                className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors">
                <RotateCcw className="w-4 h-4" /> New plan
              </button>
            </div>

            {/* Day cards */}
            <div className="space-y-3">
              {plan.days.map(d => <DayCard key={d.day} day={d} />)}
            </div>

            {/* Shopping list */}
            {plan.shopping_list.length > 0 && (
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" /> Shopping List
                </h3>
                <div className="flex flex-wrap gap-2">
                  {plan.shopping_list.map(item => (
                    <span key={item} className="text-sm bg-slate-900/60 border border-slate-700/40 rounded-full px-3 py-1 text-slate-300">{item}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            {plan.tips.length > 0 && (
              <div className="bg-slate-800/50 border border-emerald-500/20 rounded-2xl p-5">
                <h3 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5" /> Nutrition Tips
                </h3>
                <ul className="space-y-2">
                  {plan.tips.map(t => (
                    <li key={t} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Chat */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
              <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" /> Ask Your Nutritionist
              </h3>
              <div className="space-y-3 mb-4 max-h-56 overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {chatMsgs.map((m, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] text-sm px-4 py-2.5 rounded-2xl ${
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-emerald-600 to-indigo-600 text-white rounded-tr-sm'
                          : 'bg-slate-700/60 text-slate-200 rounded-tl-sm'
                      }`}>{m.text}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {chatLoading && (
                  <div className="flex gap-1 px-2">
                    {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Can I substitute chicken with tofu? What snacks can I add?"
                  className="flex-1 bg-slate-900/60 border border-slate-700/50 focus:border-emerald-500/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none"
                  disabled={chatLoading} />
                <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                  className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-indigo-600 rounded-xl flex items-center justify-center disabled:opacity-40">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <p className="text-center text-xs text-slate-600 mt-8">NutriPlan · Powered by Groq LLM · Not a substitute for medical advice</p>
      </div>
    </div>
  );
}
