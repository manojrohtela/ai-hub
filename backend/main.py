from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Sales Agent — mounts the full FastAPI sub-app
from sales_agent.agent import app as sales_agent_app

# MediFriend — mounts using its create_app factory
from medifriend.main import create_app as create_medifriend_app

# Plotify — mounts via a local wrapper that uses fixed relative imports
from plotify.main import app as plotify_app

app = FastAPI(title="AI Hub Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production to your deployed Vercel domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/api/sales-agent", sales_agent_app)
app.mount("/api/medifriend", create_medifriend_app())
app.mount("/api/plotify", plotify_app)


@app.get("/health")
def health():
    return {"status": "ok", "agents": ["sales-agent", "medifriend", "plotify"]}
