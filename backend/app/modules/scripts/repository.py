from pathlib import Path

import yaml

from app.core.config import Settings
from app.modules.scripts.schemas import TestScript


def list_script_paths(settings: Settings) -> list[Path]:
    return sorted(settings.scripts_dir.glob("*.yaml"))


def read_script_file(settings: Settings, script_id: str) -> TestScript:
    script_path = script_path_for(settings, script_id)
    data = yaml.safe_load(script_path.read_text(encoding="utf-8")) or {}
    return TestScript.model_validate(data)


def write_script_file(settings: Settings, script: TestScript) -> None:
    script_path = script_path_for(settings, script.id)
    script_path.parent.mkdir(parents=True, exist_ok=True)
    script_path.write_text(
        yaml.safe_dump(
            script.model_dump(mode="json", exclude_none=True),
            allow_unicode=True,
            sort_keys=False,
        ),
        encoding="utf-8",
    )


def delete_script_file(settings: Settings, script_id: str) -> bool:
    script_path = script_path_for(settings, script_id)
    if not script_path.exists():
        return False

    script_path.unlink()
    return True


def script_file_exists(settings: Settings, script_id: str) -> bool:
    return script_path_for(settings, script_id).exists()


def script_path_for(settings: Settings, script_id: str) -> Path:
    return settings.scripts_dir / f"{script_id}.yaml"
