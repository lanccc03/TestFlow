from app.modules.keywords.repository import load_keyword_metadata
from app.modules.keywords.schemas import KeywordMetadata


def load_keywords() -> list[KeywordMetadata]:
    return load_keyword_metadata()
