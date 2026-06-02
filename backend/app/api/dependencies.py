from fastapi import Request

from app.modules.executions.service import ExecutionService


def execution_service(request: Request) -> ExecutionService:
    return request.app.state.execution_service
