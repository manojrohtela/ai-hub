import { motion } from "motion/react";
import { AgentCard, type Agent } from "./components/AgentCard";
import { TrendingUp, HeartPulse, Home, Sparkles, Target, Zap, Database, Briefcase, Mic, Scale, Leaf, Wand2 } from "lucide-react";

const agents: Agent[] = [
  {
    id: 1,
    icon: TrendingUp,
    name: "Sales AI Agent",
    description:
      "End-to-end AI business intelligence agent. Upload your sales CSV (or auto-generate one), get automated analysis, visualizations, and natural language Q&A with structured business reports.",
    tags: ["FastAPI", "LangChain", "Groq", "Streamlit", "Pandas"],
    githubUrl: "https://github.com/manojrohtela/SalesAgent",
    liveUrl: import.meta.env.VITE_SALES_AGENT_URL,
  },
  {
    id: 2,
    icon: HeartPulse,
    name: "MediFriend",
    description:
      "AI-powered medicine search and lookup. Find medicines, discover alternatives, and get chat-assisted information — backed by a comprehensive medicine dataset and Groq LLM.",
    tags: ["React", "FastAPI", "Groq", "Tailwind", "Framer Motion"],
    githubUrl: "https://github.com/manojrohtela/MediFriend",
    liveUrl: import.meta.env.VITE_MEDIFRIEND_URL,
  },
  {
    id: 3,
    icon: Home,
    name: "Plotify",
    description:
      "Describe your home requirements in natural language and get AI-generated floor plan layouts with 2D visualization. Supports room customization, zoning rules, and action-based editing.",
    tags: ["React", "FastAPI", "Groq", "SVG Canvas"],
    githubUrl: "https://github.com/manojrohtela/plotify",
    liveUrl: import.meta.env.VITE_PLOTIFY_URL,
  },
  {
    id: 4,
    icon: Database,
    name: "DataWhisperer",
    description:
      "Upload any CSV and ask questions in plain English. DataWhisperer generates SQL queries using Groq LLM and returns instant results with interactive tables — no SQL knowledge required.",
    tags: ["React", "FastAPI", "Groq", "SQLite", "Pandas"],
    githubUrl: "https://github.com/manojrohtela/DataWhisperer",
    liveUrl: import.meta.env.VITE_DATAWHISPERER_URL,
  },
  {
    id: 5,
    icon: Briefcase,
    name: "ResumeIQ",
    description:
      "Upload your resume and get an instant AI-powered score, section-by-section feedback, keyword analysis against job descriptions, and an interactive career coaching chatbot.",
    tags: ["React", "FastAPI", "Groq", "PyPDF2", "Tailwind"],
    githubUrl: "https://github.com/manojrohtela/ResumeIQ",
    liveUrl: import.meta.env.VITE_RESUMEIQ_URL,
  },
  {
    id: 6,
    icon: Mic,
    name: "InterviewCoach",
    description:
      "Practice job interviews with 5 AI-generated questions tailored to your role and experience level. Get scored feedback on clarity, depth, and examples — plus a model answer after each response.",
    tags: ["React", "FastAPI", "Groq", "Tailwind", "Framer Motion"],
    githubUrl: "https://github.com/manojrohtela/InterviewCoach",
    liveUrl: import.meta.env.VITE_INTERVIEWCOACH_URL,
  },
  {
    id: 7,
    icon: Scale,
    name: "ContractLens",
    description:
      "Upload any contract and instantly surface risks, obligations, key dates, and missing clauses — explained in plain English. Includes a legal Q&A chat for follow-up questions.",
    tags: ["React", "FastAPI", "Groq", "PyPDF2", "Tailwind"],
    githubUrl: "https://github.com/manojrohtela/ContractLens",
    liveUrl: import.meta.env.VITE_CONTRACTLENS_URL,
  },
  {
    id: 8,
    icon: Leaf,
    name: "NutriPlan",
    description:
      "Generate a personalised meal plan with macros, ingredients, and a shopping list — tailored to your goal, diet type, and allergies. Includes a chat-based nutritionist for follow-up questions.",
    tags: ["React", "FastAPI", "Groq", "Tailwind", "Framer Motion"],
    githubUrl: "https://github.com/manojrohtela/NutriPlan",
    liveUrl: import.meta.env.VITE_NUTRIPLAN_URL,
  },
  {
    id: 9,
    icon: Wand2,
    name: "BrandForge",
    description:
      "Describe your startup and get a complete brand identity: name options, taglines, color palette, mission statement, value propositions, social bio, and elevator pitch. Refine with natural language feedback.",
    tags: ["React", "FastAPI", "Groq", "Tailwind", "Framer Motion"],
    githubUrl: "https://github.com/manojrohtela/BrandForge",
    liveUrl: import.meta.env.VITE_BRANDFORGE_URL,
  },
];

export default function App() {
  const howItWorks = [
    {
      step: 1,
      icon: Target,
      title: "Choose an agent",
      description: "Select from our suite of specialized AI tools",
    },
    {
      step: 2,
      icon: Sparkles,
      title: "Provide your input",
      description: "Share your requirements or data",
    },
    {
      step: 3,
      icon: Zap,
      title: "Get intelligent results",
      description: "Receive AI-powered insights instantly",
    },
  ];

  const scrollToAgents = () => {
    document.getElementById("agents")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Hero Section */}
        <section className="container mx-auto px-6 pt-20 pb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-2 mb-8"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-sm text-indigo-300">Powered by Advanced AI</span>
            </motion.div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Your AI Agent{" "}
              <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Hub
              </span>
            </h1>

            <p className="text-xl text-slate-400 mb-10 max-w-3xl mx-auto leading-relaxed">
              Access powerful AI tools for business, life, and design — all in one place
            </p>

            <motion.button
              onClick={scrollToAgents}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-8 py-4 rounded-xl text-lg font-medium shadow-lg shadow-indigo-500/30 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Explore Agents
            </motion.button>
          </motion.div>
        </section>

        {/* Agent Grid Section */}
        <section id="agents" className="container mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
              Intelligent Agents
            </h2>
            <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
              Choose from our specialized AI agents, each designed to solve specific challenges
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
              {agents.map((agent, index) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <AgentCard agent={agent} />
                </motion.div>
              ))}
            </div>

            {/* Coming Soon Badge */}
            <motion.div
              className="text-center mt-12"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-full px-6 py-3">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <span className="text-slate-300">More AI agents coming soon...</span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* How It Works Section */}
        <section className="container mx-auto px-6 py-20">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
              How It Works
            </h2>
            <p className="text-slate-400 text-center mb-16 max-w-2xl mx-auto">
              Get started in three simple steps
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {howItWorks.map((item, index) => (
                <motion.div
                  key={item.step}
                  className="relative text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.15 }}
                  viewport={{ once: true }}
                >
                  {/* Step number */}
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {item.step}
                  </div>

                  {/* Icon container */}
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 pt-12">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <item.icon className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-slate-400">{item.description}</p>
                  </div>

                  {/* Connector line (hidden on last item and mobile) */}
                  {index < howItWorks.length - 1 && (
                    <div className="hidden md:block absolute top-1/2 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-slate-700 to-transparent" />
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* Scalability Section */}
        <section className="container mx-auto px-6 py-20">
          <motion.div
            className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-900/30 via-purple-900/30 to-pink-900/30 border border-indigo-500/20 rounded-3xl p-12 text-center"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Sparkles className="w-12 h-12 text-indigo-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Expand Your AI Toolkit
            </h2>
            <p className="text-slate-300 text-lg mb-6">
              We're constantly developing new AI agents to help you tackle more challenges.
              Your AI Hub grows with your needs.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Finance AI", "Legal Assistant", "Content Creator", "Research Agent"].map(
                (future) => (
                  <span
                    key={future}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-2 text-sm text-slate-400"
                  >
                    {future}
                  </span>
                )
              )}
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-slate-800 mt-20">
          <div className="container mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent mb-2">
                  AI Hub
                </h3>
                <p className="text-slate-500 text-sm">
                  Your unified AI agent platform
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-6">
                <a
                  href="https://github.com/manojrohtela"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white transition-colors duration-200"
                >
                  GitHub
                </a>
                <a href="#agents" className="text-slate-400 hover:text-white transition-colors duration-200">
                  Agents
                </a>
              </div>
            </div>

            <div className="text-center mt-8 pt-8 border-t border-slate-800">
              <p className="text-slate-500 text-sm">
                © 2026 AI Hub. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
