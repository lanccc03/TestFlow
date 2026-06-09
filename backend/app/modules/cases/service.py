from app.modules.cases.schemas import CaseSummary
from autotest.entry import get_case, list_cases


def list_all_cases() -> list[CaseSummary]:
    return [
        CaseSummary(
            id=case.id,
            name=case.name,
            description=case.description,
            test_steps=list(case.steps),
        )
        for case in sorted(list_cases(), key=lambda item: item.name)
    ]


def read_case(case_id: str) -> CaseSummary:
    case = get_case(case_id)
    return CaseSummary(
        id=case.id,
        name=case.name,
        description=case.description,
        test_steps=list(case.steps),
    )
