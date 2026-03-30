"""작업자 레이어에서 재사용할 진입점을 제공하는 모듈"""

from sqlalchemy.orm import Session

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.services.orchestrator import run_project_generation


def run_generation_task(db: Session, payload: ProjectCreateRequest):
    """
    백그라운드 작업에서 전체 생성 흐름을 실행한다.

    Args:
        db: 데이터베이스 세션
        payload: 프로젝트 생성 요청 값

    Returns:
        생성이 완료된 프로젝트 모델
    """

    return run_project_generation(db=db, payload=payload)
