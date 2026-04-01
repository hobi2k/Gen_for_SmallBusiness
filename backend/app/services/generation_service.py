"""이미지, 영상, 음악 전용 생성 서비스를 제공하는 모듈"""

from __future__ import annotations

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
from backend.app.tools.video_tool import generate_short_video, release_video_pipelines, select_key_visual

settings = get_settings()


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

    return validate_input(payload)


def generate_image_asset_bundle(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    이미지 전용 생성 결과를 만든다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        이미지 자산 경로 딕셔너리
    """

    request = payload
    project_id = f"image-{uuid4()}"
    project_root = Path(settings.storage_root) / project_id
    copy_bundle = generate_copy(request)
    raw_banner_paths = generate_banner_images(project_id, request, copy_bundle)
    raw_detail_paths = generate_detail_images(project_id, request, copy_bundle)
    banner_paths = _overlay_image_assets(
        request,
        copy_bundle,
        asset_kind="banner",
        raw_paths=raw_banner_paths,
    )
    detail_paths = _overlay_image_assets(
        request,
        copy_bundle,
        asset_kind="detail",
        raw_paths=raw_detail_paths,
    )
    logo_paths = generate_logo_drafts(project_id, request)
    return {
        "project_root": str(project_root),
        "copy": copy_bundle,
        "banners": banner_paths,
        "details": detail_paths,
        "logos": logo_paths,
    }


def generate_video_asset_bundle(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    영상 전용 생성 결과를 만든다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        영상 자산 경로 딕셔너리
    """

    request = payload
    project_id = f"video-{uuid4()}"
    project_root = Path(settings.storage_root) / project_id
    copy_bundle = generate_copy(request)
    raw_detail_paths = generate_detail_images(project_id, request, copy_bundle)
    raw_banner_paths = generate_banner_images(project_id, request, copy_bundle)
    detail_paths = _overlay_image_assets(
        request,
        copy_bundle,
        asset_kind="detail",
        raw_paths=raw_detail_paths,
    )
    banner_paths = _overlay_image_assets(
        request,
        copy_bundle,
        asset_kind="banner",
        raw_paths=raw_banner_paths,
    )
    key_visual = select_key_visual(
        detail_paths=raw_detail_paths,
        banner_paths=raw_banner_paths,
        image_paths=request.image_paths,
    )
    release_image_pipelines()
    raw_video_path = generate_short_video(project_id, request, key_visual, copy_bundle)
    video_path = overlay_text_on_video(project_id, raw_video_path, request, copy_bundle)
    asset_bundle = {
        "project_root": str(project_root),
        "copy": copy_bundle,
        "banners": banner_paths,
        "details": detail_paths,
        "hero_asset_path": detail_paths[0],
        "video": video_path,
    }
    if request.include_music:
        release_video_pipelines()
        music_path = generate_music(project_id, request, copy_bundle)
        final_video_path = compose_final_video(project_id, video_path, music_path)
        asset_bundle["music"] = music_path
        asset_bundle["final_video"] = final_video_path
    return asset_bundle


def generate_music_asset_bundle(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    음악 전용 생성 결과를 만든다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        음악 자산 경로 딕셔너리
    """

    request = payload
    project_id = f"music-{uuid4()}"
    project_root = Path(settings.storage_root) / project_id
    copy_bundle = generate_copy(request)
    music_path = generate_music(project_id, request, copy_bundle)
    return {
        "project_root": str(project_root),
        "copy": copy_bundle,
        "music": music_path,
    }
