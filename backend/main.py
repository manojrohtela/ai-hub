from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sales_agent.agent import router as sales_agent_router
from medifriend.api import router as medifriend_router
from plotify.routes.chat import router as plotify_router

app = FastAPI(title="AI Hub Backend", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten in production to your deployed Vercel domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sales_agent_router, prefix="/api/sales-agent")
app.include_router(medifriend_router, prefix="/api/medifriend")
app.include_router(plotify_router, prefix="/api/plotify")


@app.get("/health")
def health():
    return {"status": "ok", "agents": ["sales-agent", "medifriend", "plotify"]}
