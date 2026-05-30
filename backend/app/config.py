from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TESTFLOW_", extra="ignore")

    service_name: str = "testflow-backend"
    version: str = "0.1.0"
    data_dir: Path = Field(default=PROJECT_ROOT / "data")
    host: str = "127.0.0.1"
    port: int = 8000

    @property
    def scripts_dir(self) -> Path:
        return self.data_dir / "scripts"

    @property
    def reports_dir(self) -> Path:
        return self.data_dir / "reports"

    @property
    def logs_dir(self) -> Path:
        return self.data_dir / "logs"

    @property
    def database_path(self) -> Path:
        return self.data_dir / "testflow.sqlite3"

    @property
    def app_log_path(self) -> Path:
        return self.logs_dir / "app.log"

    @property
    def execution_log_path(self) -> Path:
        return self.logs_dir / "execution.log"


@lru_cache
def get_settings() -> Settings:
    return Settings()
