from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
    return {"agent": "plotify", "status": "ok"}


# TODO: Move routes from manojrohtela/plotify FastAPI backend here
# Example structure:
# @router.post("/generate-layout")
# def generate_layout(payload: LayoutRequest):
#     ...
#
# @router.post("/chat")
# def chat(payload: ChatRequest):
#     ...
