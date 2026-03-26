from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"agent": "sales-agent", "status": "ok"}


# TODO: Move routes from manojrohtela/SalesAgent FastAPI backend here
# Example structure:
# @router.post("/analyze")
# def analyze(file: UploadFile = File(...)):
#     ...
#
# @router.post("/chat")
# def chat(payload: ChatRequest):
#     ...
