from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"agent": "medifriend", "status": "ok"}


# TODO: Move routes from manojrohtela/MediFriend FastAPI backend here
# Example structure:
# @router.get("/search")
# def search(q: str):
#     ...
#
# @router.post("/chat")
# def chat(payload: ChatRequest):
#     ...
