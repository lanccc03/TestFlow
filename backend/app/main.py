from pathlib import Path

from fastapi import FastAPI

app = FastAPI(title="TestFlow Backend")

DATA_DIR = Path("..") / "data"


@app.get("/health")
def read_health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "testflow-backend",
        "version": "0.1.0",
        "data_dir": DATA_DIR.as_posix(),
    }
