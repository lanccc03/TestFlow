from app.modules.scripts.schemas import FrameworkCaseSummary
from autotest.entry import get_case, list_cases


def list_scripts() -> list[FrameworkCaseSummary]:
    return [
        _case_to_schema(case)
        for case in sorted(list_cases(), key=lambda item: item.name)
    ]


def read_script(script_id: str) -> FrameworkCaseSummary:
    return _case_to_schema(get_case(script_id))


def _case_to_schema(case) -> FrameworkCaseSummary:
    return FrameworkCaseSummary(
        id=case.id,
        name=case.name,
        description=case.description,
        steps=list(case.steps),
    )
