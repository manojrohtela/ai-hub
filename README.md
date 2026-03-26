# AI Hub

A monorepo housing a unified landing page and three specialized AI agents — all sharing a common design system and a single combined FastAPI backend.

## Agents

| Agent | Description | Tech |
|---|---|---|
| **Sales AI Agent** | Upload a sales CSV (or auto-generate one), get automated analysis, charts, and natural language Q&A with structured business reports | FastAPI · LangChain · Groq · Pandas |
| **MediFriend** | Search medicines, find alternatives, and get chat-assisted information backed by a comprehensive medicine dataset | FastAPI · Groq · React · Tailwind |
| **Plotify** | Describe your home requirements in natural language and get AI-generated 2D floor plan layouts with room customization and zoning rules | FastAPI · Groq · React · SVG Canvas |

## Monorepo Structure

```
ai-hub/
  apps/
    hub/            ← Landing page (this repo's main entry point)
    sales-agent/    ← Sales AI Agent frontend
    medifriend/     ← MediFriend frontend
    plotify/        ← Plotify frontend
  packages/
    ui/             ← Shared theme tokens and cn() utility
  backend/
    main.py         ← Combined FastAPI app — mounts all 3 agents
    sales_agent/    ← Sales agent backend logic
    medifriend/     ← MediFriend backend logic + medicine CSVs
    plotify/        ← Plotify backend logic
    requirements.txt
  pnpm-workspace.yaml
```

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Python 3.11+

### 1. Install frontend dependencies

```bash
pnpm install
```

### 2. Set up backend

```bash
cd backend
pip install -r requirements.txt
```

Create a `backend/.env` file:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Run everything locally

**Backend** (port 8000):
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Hub landing page:**
```bash
pnpm dev:hub          # http://localhost:5173
```

**Individual agents:**
```bash
pnpm dev:sales-agent  # http://localhost:5174
pnpm dev:medifriend   # http://localhost:5175
pnpm dev:plotify      # http://localhost:5176
```

### Backend API routes

Once running, all agents are served from a single backend:

```
GET  /health                        → status check
POST /api/sales-agent/analyze       → analyze CSV data
POST /api/sales-agent/chat          → Q&A on sales data
GET  /api/medifriend/search         → search medicines
POST /api/medifriend/intent         → chat-based medicine lookup
POST /api/plotify/chat              → generate floor plan from conversation
POST /api/plotify/reset             → reset session state
```

## Deployment

### Frontend → Vercel

Each app deploys as a separate Vercel project. Set the **root directory** for each:

| Vercel Project | Root Directory |
|---|---|
| ai-hub | `apps/hub` |
| sales-agent | `apps/sales-agent` |
| medifriend | `apps/medifriend` |
| plotify | `apps/plotify` |

After deploying, add environment variables to the hub project:

```env
VITE_SALES_AGENT_URL=https://your-sales-agent.vercel.app
VITE_MEDIFRIEND_URL=https://your-medifriend.vercel.app
VITE_PLOTIFY_URL=https://your-plotify.vercel.app
```

### Backend → Render

- **Root directory:** `backend`
- **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment variable:** `GROQ_API_KEY=your_key`

## Adding a New Agent

1. Create `apps/your-agent/` with a Vite + React frontend
2. Add `packages/ui` as a dependency for shared theming
3. Add backend logic under `backend/your_agent/`
4. Register the router in `backend/main.py`:
   ```python
   app.mount("/api/your-agent", your_agent_app)
   ```
5. Add `VITE_YOUR_AGENT_URL` to `apps/hub/.env`
6. Add the agent entry to the `agents` array in `apps/hub/src/app/App.tsx`

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS v4, Framer Motion, shadcn/ui
- **Backend:** FastAPI, Uvicorn, LangChain, Groq SDK
- **Package manager:** pnpm workspaces (monorepo)
- **Deployment:** Vercel (frontends) + Render (backend)
