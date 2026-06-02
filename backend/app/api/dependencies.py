from fastapi import Request

from app.execution.service import ExecutionService


def execution_service(request: Request) -> ExecutionService:
    return request.app.state.execution_service
