"""이미지, 영상, 음악 전용 생성 서비스를 제공하는 모듈"""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import uuid4

from backend.app.core.config import get_settings
from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.composition_tool import compose_final_video
from backend.app.tools.copy_tool import generate_copy
from backend.app.tools.image_tool import (
    generate_banner_images,
    generate_detail_images,
    generate_logo_drafts,
    release_image_pipelines,
)
from backend.app.tools.music_tool import generate_music
from backend.app.tools.text_overlay_tool import overlay_text_on_image, overlay_text_on_video
from backend.app.tools.validation_tool import validate_input
from backend.app.tools.video_tool import (
    generate_short_video,
    release_video_pipelines,
    select_key_visual,
)

settings = get_settings()
logger = logging.getLogger(__name__)


def _create_project_context(prefix: str) -> tuple[str, Path]:
    """
    생성 모드에 맞는 프로젝트 식별자와 저장 루트를 만든다.

    Args:
        prefix: image, video, music 중 하나인 접두어

    Returns:
        프로젝트 식별자와 저장 루트
    """

    project_id = f"{prefix}-{uuid4()}"
    project_root = Path(settings.storage_root) / project_id
    return project_id, project_root


def _generate_copy_bundle(mode: str, payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    생성 모드에 맞는 문구 묶음을 만들고 로그를 남긴다.

    Args:
        mode: image, video, music 중 하나
        payload: 생성 요청 데이터

    Returns:
        문구 생성 결과 딕셔너리
    """

    logger.info("문구 생성 시작: %s", mode)
    copy_bundle = generate_copy(payload)
    logger.info("문구 생성 완료: %s", mode)
    return copy_bundle


def _build_overlay_paths(paths: list[str], suffix: str) -> list[str]:
    """
    원본 자산 경로 목록을 오버레이 결과 경로 목록으로 바꾼다.

    Args:
        paths: 원본 파일 경로 목록
        suffix: 파일명 뒤에 붙일 접미사

    Returns:
        오버레이 결과 경로 목록
    """

    return [
        str(Path(path).with_name(f"{Path(path).stem}_{suffix}{Path(path).suffix}"))
        for path in paths
    ]


def _overlay_image_assets(
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    asset_kind: str,
    raw_paths: list[str],
) -> list[str]:
    """
    생성된 이미지 목록 위에 한글 문구를 오버레이한다.

    Args:
        payload: 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        asset_kind: banner 또는 detail
        raw_paths: 원본 이미지 경로 목록

    Returns:
        오버레이 적용 결과 경로 목록
    """

    overlay_paths = _build_overlay_paths(raw_paths, "final")
    return [
        overlay_text_on_image(
            raw_path,
            overlay_path,
            payload,
            copy_bundle,
            asset_kind=asset_kind,
        )
        for raw_path, overlay_path in zip(raw_paths, overlay_paths, strict=True)
    ]


def create_validated_request(payload: ProjectCreateRequest) -> ProjectCreateRequest:
    """
    전용 생성 서비스에서 사용할 요청 객체를 검증한다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        검증된 요청 객체
    """

    logger.info("입력 검증 시작")
    validated = validate_input(payload)
    logger.info("입력 검증 완료")
    return validated


def generate_image_asset_bundle(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    이미지 전용 생성 결과를 만든다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        이미지 자산 경로 딕셔너리
    """

    project_id, project_root = _create_project_context("image")
    logger.info("이미지 번들 생성 시작: project_id=%s, project_root=%s", project_id, project_root)
    copy_bundle = _generate_copy_bundle("image", payload)
    try:
        logger.info("배너 이미지 생성 시작")
        raw_banner_paths = generate_banner_images(project_id, payload, copy_bundle)
        logger.info("배너 이미지 생성 완료: %s개", len(raw_banner_paths))
        logger.info("상세 이미지 생성 시작")
        raw_detail_paths = generate_detail_images(project_id, payload, copy_bundle)
        logger.info("상세 이미지 생성 완료: %s개", len(raw_detail_paths))
        logger.info("배너 오버레이 시작")
        banner_paths = _overlay_image_assets(
            payload,
            copy_bundle,
            asset_kind="banner",
            raw_paths=raw_banner_paths,
        )
        logger.info("배너 오버레이 완료: %s개", len(banner_paths))
        logger.info("상세 오버레이 시작")
        detail_paths = _overlay_image_assets(
            payload,
            copy_bundle,
            asset_kind="detail",
            raw_paths=raw_detail_paths,
        )
        logger.info("상세 오버레이 완료: %s개", len(detail_paths))
        logger.info("로고 초안 생성 시작")
        logo_paths = generate_logo_drafts(project_id, payload)
        logger.info("로고 초안 생성 완료: %s개", len(logo_paths))
        logger.info("이미지 번들 생성 완료: project_id=%s", project_id)
        return {
            "project_root": str(project_root),
            "copy": copy_bundle,
            "banners": banner_paths,
            "details": detail_paths,
            "logos": logo_paths,
        }
    finally:
        logger.info("이미지 파이프라인 해제 시작")
        release_image_pipelines()
        logger.info("이미지 파이프라인 해제 완료")


def generate_video_asset_bundle(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    영상 전용 생성 결과를 만든다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        영상 자산 경로 딕셔너리
    """

    project_id, project_root = _create_project_context("video")
    logger.info("영상 번들 생성 시작: project_id=%s, project_root=%s", project_id, project_root)
    copy_bundle = _generate_copy_bundle("video", payload)
    try:
        logger.info("대표 이미지 선택 시작")
        key_visual = select_key_visual(
            detail_paths=[],
            banner_paths=[],
            image_paths=payload.image_paths,
        )
        logger.info("대표 이미지 선택 완료: %s", key_visual or "없음")
        logger.info("원본 영상 생성 시작")
        raw_video_path = generate_short_video(project_id, payload, key_visual, copy_bundle)
        logger.info("원본 영상 생성 완료: %s", raw_video_path)
        logger.info("영상 오버레이 시작")
        video_path = overlay_text_on_video(project_id, raw_video_path, payload, copy_bundle)
        logger.info("영상 오버레이 완료: %s", video_path)
        asset_bundle = {
            "project_root": str(project_root),
            "copy": copy_bundle,
            "video": video_path,
        }
        if payload.include_music:
            logger.info("영상 파이프라인 선해제 시작")
            release_video_pipelines()
            logger.info("영상 파이프라인 선해제 완료")
            logger.info("음악 생성 시작")
            music_path = generate_music(project_id, payload, copy_bundle)
            logger.info("음악 생성 완료: %s", music_path)
            logger.info("최종 합성 시작")
            final_video_path = compose_final_video(project_id, video_path, music_path)
            logger.info("최종 합성 완료: %s", final_video_path)
            asset_bundle["music"] = music_path
            asset_bundle["final_video"] = final_video_path
        logger.info("영상 번들 생성 완료: project_id=%s", project_id)
        return asset_bundle
    finally:
        logger.info("영상 파이프라인 해제 시작")
        release_video_pipelines()
        logger.info("영상 파이프라인 해제 완료")


def generate_music_asset_bundle(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    음악 전용 생성 결과를 만든다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        음악 자산 경로 딕셔너리
    """

    project_id, project_root = _create_project_context("music")
    logger.info("음악 번들 생성 시작: project_id=%s, project_root=%s", project_id, project_root)
    copy_bundle = _generate_copy_bundle("music", payload)
    logger.info("음악 생성 시작")
    music_path = generate_music(project_id, payload, copy_bundle)
    logger.info("음악 생성 완료: %s", music_path)
    return {
        "project_root": str(project_root),
        "copy": copy_bundle,
        "music": music_path,
    }
