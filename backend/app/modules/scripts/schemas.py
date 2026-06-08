from pydantic import BaseModel, ConfigDict


class FrameworkCaseSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    description: str = ""
    steps: list[str] = []
