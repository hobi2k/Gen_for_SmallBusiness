"""헬스 체크 API 모듈"""

from fastapi import APIRouter

from backend.app.core.config import get_settings
from backend.app.schemas.project import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def read_health() -> HealthResponse:
    """
    애플리케이션 기본 상태를 반환한다.
    """

    settings = get_settings()
    return HealthResponse(status="ok", app_name=settings.app_name)
