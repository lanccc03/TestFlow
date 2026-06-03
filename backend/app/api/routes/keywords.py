from fastapi import APIRouter

from app.modules.keywords.service import load_keywords

router = APIRouter()


@router.get("/keywords")
def list_keyword_metadata() -> dict[str, list[dict[str, object]]]:
    keywords = load_keywords()
    return {"items": [keyword.model_dump(mode="json") for keyword in keywords]}
