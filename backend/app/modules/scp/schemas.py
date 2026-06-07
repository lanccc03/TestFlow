from pydantic import BaseModel, Field


class ScpFileNode(BaseModel):
    name: str
    path: str
    type: str
    size: int | None = None
    modified_at: str | None = None


class ScpFileTree(BaseModel):
    path: str
    items: list[ScpFileNode]


class ScpTransferCreate(BaseModel):
    session_id: str = Field(min_length=1)
    source_path: str = Field(min_length=1)
    target_path: str = Field(min_length=1)


class ScpTransferTask(BaseModel):
    id: str
    direction: str
    source_path: str
    target_path: str
    status: str
    progress: int = Field(ge=0, le=100)
    error_message: str | None = None


class ScpTransferEvent(BaseModel):
    type: str = "transfer_update"
    task: ScpTransferTask
