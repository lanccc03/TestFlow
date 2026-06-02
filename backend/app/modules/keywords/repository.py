from pathlib import Path

import yaml

from app.core.config import Settings
from app.modules.keywords.schemas import KeywordMetadata

DEFAULT_KEYWORDS_PATH = Path(__file__).resolve().parents[2] / "default_keywords.yaml"


def load_keyword_metadata(settings: Settings) -> list[KeywordMetadata]:
    config_path = settings.keyword_config_path
    if not config_path.is_file():
        config_path = DEFAULT_KEYWORDS_PATH

    data = yaml.safe_load(config_path.read_text(encoding="utf-8")) or []
    return [KeywordMetadata.model_validate(item) for item in data]
