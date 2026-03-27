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
logger.info("Loading datawhisperer router...")
from datawhisperer.api import router as datawhisperer_router
logger.info("Loading resumeiq router...")
from resumeiq.api import router as resumeiq_router
logger.info("Loading interviewcoach router...")
from interviewcoach.api import router as interviewcoach_router
logger.info("Loading contractlens router...")
from contractlens.api import router as contractlens_router
logger.info("Loading nutriplan router...")
from nutriplan.api import router as nutriplan_router
logger.info("Loading brandforge router...")
from brandforge.api import router as brandforge_router
logger.info("Loading scorekeeper router...")
from scorekeeper.api import router as scorekeeper_router
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
app.include_router(datawhisperer_router, prefix="/api/datawhisperer")
app.include_router(resumeiq_router, prefix="/api/resumeiq")
app.include_router(interviewcoach_router, prefix="/api/interviewcoach")
app.include_router(contractlens_router, prefix="/api/contractlens")
app.include_router(nutriplan_router, prefix="/api/nutriplan")
app.include_router(brandforge_router, prefix="/api/brandforge")
app.include_router(scorekeeper_router, prefix="/api/scorekeeper")


@app.get("/health")
def health():
    return {"status": "ok", "agents": ["sales-agent", "medifriend", "plotify", "datawhisperer", "resumeiq", "interviewcoach", "contractlens", "nutriplan", "brandforge", "scorekeeper"]}
