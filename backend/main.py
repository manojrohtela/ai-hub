import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

logger.info("Loading sales_agent router...")
from sales_agent.agent import router as sales_agent_router
logger.info("Loading medifriend router...")
from medifriend.api import router as medifriend_router
logger.info("Loading plotify router...")
from plotify.routes.chat import router as plotify_router
logger.info("All routers loaded.")

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
