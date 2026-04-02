"""도구 호출 순서를 조율하는 오케스트레이터 모듈"""

import json
from uuid import uuid4

from sqlalchemy.orm import Session

from backend.app.models.project import Project
from backend.app.schemas.project import ProjectCreateRequest
from backend.app.services.project_service import mark_project_failure, persist_generation_result
from backend.app.tools.composition_tool import compose_final_video
from backend.app.tools.copy_tool import generate_copy
from backend.app.tools.image_tool import (
    generate_banner_images,
    generate_detail_images,
    generate_logo_drafts,
)
from backend.app.tools.music_tool import generate_music
from backend.app.tools.validation_tool import validate_input
from backend.app.tools.video_tool import generate_short_video, select_key_visual


def run_project_generation(db: Session, payload: ProjectCreateRequest) -> Project:
    """
    광고 콘텐츠 생성 흐름을 순서대로 실행한다.

    Args:
        db: 데이터베이스 세션
        payload: 프로젝트 생성 요청 값

    Returns:
        생성 상태가 반영된 프로젝트 모델
    """

    validated_payload = validate_input(payload)
    request_snapshot = json.dumps(validated_payload.model_dump(), ensure_ascii=False)
    project = Project(
        id=str(uuid4()),
        product_name=validated_payload.product_name,
        tone=validated_payload.tone,
        status="running",
        request_snapshot=request_snapshot,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    try:
        # 전체 파이프라인이 길기 때문에 각 단계 결과를 명시적으로 분리해 둔다.
        copy_bundle = generate_copy(validated_payload)
        banner_paths = generate_banner_images(project.id, validated_payload, copy_bundle)
        detail_paths = generate_detail_images(project.id, validated_payload, copy_bundle)
        logo_paths = generate_logo_drafts(project.id, validated_payload)
        key_visual = select_key_visual(
            detail_paths=detail_paths,
            banner_paths=banner_paths,
            image_paths=validated_payload.image_paths,
        )
        video_path = generate_short_video(project.id, validated_payload, key_visual, copy_bundle)
        music_path = None
        final_video_path = None

        if validated_payload.include_music:
            music_path = generate_music(project.id, validated_payload, copy_bundle)
            final_video_path = compose_final_video(project.id, video_path, music_path)

        persist_generation_result(
            db=db,
            project=project,
            hero_asset_path=key_visual,
            asset_paths={
                "request": validated_payload.model_dump(),
                "copy": copy_bundle,
                "banners": banner_paths,
                "details": detail_paths,
                "logos": logo_paths,
                "video": video_path,
                **({"music": music_path} if music_path else {}),
                **({"final_video": final_video_path} if final_video_path else {}),
            },
        )
        return project
    except Exception as exc:
        # 어느 단계에서라도 예외가 나면 running 상태가 남지 않도록 바로 실패로 바꾼다.
        mark_project_failure(
            db=db,
            project=project,
            stage_name="generation",
            message=str(exc),
        )
        raise
