from pydantic import BaseModel, ConfigDict


class CaseSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str = ""
    tag: str = ""
    test_steps: list[str] = []
