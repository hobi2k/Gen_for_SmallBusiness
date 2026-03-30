"""프로젝트 생성과 조회 API 모듈"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.project import Project
from backend.app.schemas.project import ProjectCreateRequest, ProjectResponse
from backend.app.services.orchestrator import run_project_generation

router = APIRouter()


@router.post("", response_model=ProjectResponse)
def create_project(
    payload: ProjectCreateRequest,
    db: Session = Depends(get_db),
) -> ProjectResponse:
    """
    새 광고 콘텐츠 생성 프로젝트를 시작한다.

    Args:
        payload: 생성 요청 데이터
        db: 데이터베이스 세션

    Returns:
        생성된 프로젝트 응답
    """

    try:
        project = run_project_generation(db=db, payload=payload)
    except ValueError as exc:
        # 사용자 입력 오류는 400으로 돌려줘야 프런트에서 즉시 수정할 수 있다.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        # 생성 단계의 실패는 500으로 돌려주되, DB에는 실패 상태가 남도록 한다.
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ProjectResponse.model_validate(project)


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)) -> list[ProjectResponse]:
    """
    저장된 프로젝트 목록을 반환한다.

    Args:
        db: 데이터베이스 세션

    Returns:
        프로젝트 응답 목록
    """

    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [ProjectResponse.model_validate(project) for project in projects]
