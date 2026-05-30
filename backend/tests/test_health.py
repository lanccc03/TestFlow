from fastapi.testclient import TestClient

from app.main import app


def test_health_returns_service_status_and_data_directory() -> None:
    client = TestClient(app)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "testflow-backend",
        "version": "0.1.0",
        "data_dir": "../data",
    }
