from app.modules.keywords.schemas import KeywordMetadata, KeywordParameter
from autotest.contracts import FrameworkKeywordDef, FrameworkKeywordParam
from autotest.entry import list_keywords as list_autotest_keywords


def load_keyword_metadata() -> list[KeywordMetadata]:
    """Load keyword definitions from the automation framework.

    The autotest framework is the source of truth for available keywords.
    This function converts framework-level keyword contracts into
    app-level KeywordMetadata models used by the API and validators.
    """
    return [_to_keyword_metadata(kw) for kw in list_autotest_keywords()]


def _to_keyword_metadata(kw: FrameworkKeywordDef) -> KeywordMetadata:
    return KeywordMetadata(
        name=kw.name,
        description=kw.description,
        module=kw.module,
        parameters=[_to_keyword_param(p) for p in kw.parameters],
        example=kw.example,
        enabled=kw.enabled,
    )


def _to_keyword_param(p: FrameworkKeywordParam) -> KeywordParameter:
    return KeywordParameter(
        name=p.name,
        description=p.description,
        type=p.type,
        default=p.default,
        required=p.required,
        example=p.example,
    )
