from pydantic import BaseModel, Field


class SshConnectMessage(BaseModel):
    type: str
    host: str = Field(min_length=1)
    port: int = Field(default=22, ge=1, le=65535)
    username: str = Field(min_length=1)
    password: str = ""
    cols: int = Field(default=80, ge=1)
    rows: int = Field(default=24, ge=1)
    skip_host_key_check: bool = False
