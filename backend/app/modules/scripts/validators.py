from typing import Any

from app.modules.keywords.schemas import KeywordMetadata, ParameterType
from app.modules.scripts.schemas import (
    ScriptValidationIssue,
    TestScript,
)


def validate_script(
    script: TestScript,
    keywords: dict[str, KeywordMetadata],
) -> list[ScriptValidationIssue]:
    issues: list[ScriptValidationIssue] = []
    for step_index, step in enumerate(script.steps):
        keyword = keywords.get(step.keyword)
        if keyword is None or not keyword.enabled:
            issues.append(
                ScriptValidationIssue(
                    field=f"steps[{step_index}].keyword",
                    message=f"Unknown keyword: {step.keyword}",
                )
            )
            continue

        for parameter in keyword.parameters:
            parameter_path = f"steps[{step_index}].params.{parameter.name}"
            has_value = parameter.name in step.params
            if parameter.required and not has_value:
                issues.append(
                    ScriptValidationIssue(
                        field=parameter_path,
                        message="Missing required parameter",
                    )
                )
                continue

            if has_value and not _matches_type(
                step.params[parameter.name],
                parameter.type,
            ):
                issues.append(
                    ScriptValidationIssue(
                        field=parameter_path,
                        message=f"Expected {parameter.type}",
                    )
                )

    return issues


def _matches_type(value: Any, parameter_type: ParameterType) -> bool:
    if parameter_type == "string":
        return isinstance(value, str)
    if parameter_type == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if parameter_type == "number":
        return (isinstance(value, int | float)) and not isinstance(value, bool)
    if parameter_type == "boolean":
        return isinstance(value, bool)
    if parameter_type == "object":
        return isinstance(value, dict)
    if parameter_type == "array":
        return isinstance(value, list)
    return False
