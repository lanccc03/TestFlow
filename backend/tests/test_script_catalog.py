from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from autotest.contracts import FrameworkCaseSummary


class CaseRuntime:
    def list_cases(self) -> list[FrameworkCaseSummary]:
        return [
            FrameworkCaseSummary(
                id="case.smoke_cockpit",
                name="座舱冒烟测试",
                description="基础稳定性巡检",
                steps=("启动系统", "确认首页加载", "检查关键状态正常"),
            )
        ]

    def get_case(self, case_id: str) -> FrameworkCaseSummary:
        if case_id != "case.smoke_cockpit":
            raise FileNotFoundError(case_id)
        return self.list_cases()[0]

    def read_config(self):
        return {}

    def write_config(self, config):
        return config

    def run_script(self, request):
        raise NotImplementedError


@pytest.fixture(autouse=True)
def runtime_override():
    from autotest import registry

    registry.set_runtime_for_testing(CaseRuntime())
    yield
    registry.reset_runtime_for_testing()


def test_lists_framework_cases_from_runtime(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/cases")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": "case.smoke_cockpit",
                "name": "座舱冒烟测试",
                "description": "基础稳定性巡检",
                "test_steps": ["启动系统", "确认首页加载", "检查关键状态正常"],
            }
        ]
    }
    assert not (settings.scripts_dir / "case.smoke_cockpit.yaml").exists()


def test_reads_framework_case_detail_from_runtime(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/cases/case.smoke_cockpit")

    assert response.status_code == 200
    assert response.json()["name"] == "座舱冒烟测试"
    assert response.json()["test_steps"] == [
        "启动系统", "确认首页加载", "检查关键状态正常"
    ]


def test_returns_404_for_missing_framework_case(tmp_path: Path) -> None:
    settings = Settings(data_dir=tmp_path)

    with TestClient(create_app(settings)) as client:
        response = client.get("/api/cases/missing")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


