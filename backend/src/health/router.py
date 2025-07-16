from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def read_root():
    return {"status": "ok"}
