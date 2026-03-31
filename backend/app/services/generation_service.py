"""이미지, 영상, 음악 전용 생성 서비스를 제공하는 모듈"""

from __future__ import annotations

from uuid import uuid4

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.composition_tool import compose_final_video
from backend.app.tools.copy_tool import generate_copy
from backend.app.tools.image_tool import (
    generate_banner_images,
    generate_detail_images,
    generate_logo_drafts,
)
from backend.app.tools.music_tool import generate_music
from backend.app.tools.runtime_support import ensure_project_root
from backend.app.tools.validation_tool import validate_input
from backend.app.tools.video_tool import generate_short_video, select_key_visual


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

    request = create_validated_request(payload)
    project_id = f"image-{uuid4()}"
    project_root = ensure_project_root(project_id)
    copy_bundle = generate_copy(request)
    banner_paths = generate_banner_images(project_id, request, copy_bundle)
    detail_paths = generate_detail_images(project_id, request, copy_bundle)
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

    request = create_validated_request(payload)
    project_id = f"video-{uuid4()}"
    project_root = ensure_project_root(project_id)
    copy_bundle = generate_copy(request)
    detail_paths = generate_detail_images(project_id, request, copy_bundle)
    banner_paths = generate_banner_images(project_id, request, copy_bundle)
    key_visual = select_key_visual(
        detail_paths=detail_paths,
        banner_paths=banner_paths,
        image_paths=request.image_paths,
    )
    video_path = generate_short_video(project_id, request, key_visual, copy_bundle)
    asset_bundle = {
        "project_root": str(project_root),
        "copy": copy_bundle,
        "banners": banner_paths,
        "details": detail_paths,
        "hero_asset_path": key_visual or detail_paths[0],
        "video": video_path,
    }
    if request.include_music:
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

    request = create_validated_request(payload)
    project_id = f"music-{uuid4()}"
    project_root = ensure_project_root(project_id)
    copy_bundle = generate_copy(request)
    music_path = generate_music(project_id, request, copy_bundle)
    return {
        "project_root": str(project_root),
        "copy": copy_bundle,
        "music": music_path,
    }
