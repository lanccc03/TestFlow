from datetime import UTC, datetime

from app.core.config import Settings
from app.modules.keywords.service import load_keywords
from app.modules.scripts.repository import (
    delete_script_file,
    list_script_paths,
    read_script_file,
    script_file_exists,
    write_script_file,
)
from app.modules.scripts.schemas import (
    ScriptSummary,
    ScriptValidationError,
    ScriptVersion,
    TestScript,
)
from app.modules.scripts.validators import validate_script


def list_scripts(settings: Settings) -> list[ScriptSummary]:
    summaries = [
        _script_to_summary(read_script(settings, path.stem))
        for path in list_script_paths(settings)
    ]
    return sorted(summaries, key=lambda summary: summary.updated_at, reverse=True)


def read_script(settings: Settings, script_id: str) -> TestScript:
    return read_script_file(settings, script_id)


def save_script(settings: Settings, script: TestScript) -> tuple[TestScript, bool]:
    keywords = {keyword.name: keyword for keyword in load_keywords(settings)}
    if script.status == "published":
        issues = validate_script(script, keywords)
        if issues:
            raise ScriptValidationError(issues)

    was_created = not script_file_exists(settings, script.id)
    revision = 1
    if not was_created:
        existing = read_script(settings, script.id)
        revision = (existing.version.revision if existing.version else 0) + 1

    saved_script = script.model_copy(
        update={
            "schema_version": 1,
            "version": ScriptVersion(
                revision=revision,
                updated_at=datetime.now(UTC).isoformat(),
            ),
        }
    )
    write_script_file(settings, saved_script)
    return saved_script, was_created


def delete_script(settings: Settings, script_id: str) -> bool:
    return delete_script_file(settings, script_id)


def _script_to_summary(script: TestScript) -> ScriptSummary:
    version = script.version
    return ScriptSummary(
        id=script.id,
        name=script.name,
        description=script.description,
        step_count=len(script.steps),
        enabled_step_count=sum(1 for step in script.steps if step.enabled),
        revision=version.revision if version else 1,
        updated_at=version.updated_at if version else "",
        status=script.status,
        tags=script.tags,
        group=script.group,
    )
