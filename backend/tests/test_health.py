from pathlib import Path

from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health_returns_service_status_version_and_data_directory(
    tmp_path: Path,
) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "testflow-backend",
        "version": "0.1.0",
        "data_dir": tmp_path.as_posix(),
    }
