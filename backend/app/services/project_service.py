"""프로젝트 저장과 조회를 담당하는 서비스 모듈"""

import json
from pathlib import Path
from typing import Any

from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.models.project import Project

settings = get_settings()


def persist_generation_result(
    db: Session,
    project: Project,
    hero_asset_path: str | None,
    asset_paths: dict[str, Any],
) -> Project:
    """
    생성 결과 메타데이터를 파일과 데이터베이스에 저장한다.

    Args:
        db: 데이터베이스 세션
        project: 저장 대상 프로젝트
        hero_asset_path: 대표 결과물 경로
        asset_paths: 생성 단계별 결과물 정보

    Returns:
        저장이 완료된 프로젝트 모델
    """

    project_root = Path(settings.storage_root) / project.id
    project_root.mkdir(parents=True, exist_ok=True)

    # 파일 기반 메타데이터를 남겨 두면 나중에 UI와 관리자 화면에서 쉽게 재사용할 수 있다.
    (project_root / "assets.json").write_text(
        json.dumps(asset_paths, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    project.status = "completed"
    project.hero_asset_path = hero_asset_path
    project.failure_stage = None
    project.error_message = None
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def mark_project_failure(db: Session, project: Project, stage_name: str, message: str) -> Project:
    """
    프로젝트를 실패 상태로 기록한다.

    Args:
        db: 데이터베이스 세션
        project: 실패한 프로젝트 모델
        stage_name: 실패 단계 이름
        message: 오류 메시지

    Returns:
        실패 정보가 반영된 프로젝트 모델
    """

    project.status = "failed"
    project.failure_stage = stage_name
    project.error_message = message
    db.add(project)
    db.commit()
    db.refresh(project)
    return project
