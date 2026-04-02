"""이미지, 영상, 음악 전용 생성 API 모듈"""

from __future__ import annotations

import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.app.schemas.generation import GenerationResponse
from backend.app.schemas.project import ProjectCreateRequest
from backend.app.services.generation_service import (
    create_validated_request,
    generate_image_asset_bundle,
    generate_music_asset_bundle,
    generate_video_asset_bundle,
)
from backend.app.tools.runtime_support import save_uploaded_files

router = APIRouter()
logger = logging.getLogger(__name__)


async def _read_uploads(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    """
    업로드 파일 목록을 메모리로 읽는다.

    Args:
        files: 업로드된 파일 객체 목록

    Returns:
        파일 이름과 바이트 목록
    """

    uploads: list[tuple[str, bytes]] = []
    for file in files:
        content = await file.read()
        if content:
            uploads.append((file.filename or "upload.bin", content))
    return uploads


async def _build_form_payload(
    product_name: str = Form(...),
    prompt: str = Form(...),
    tone: str = Form(...),
    banner_width: int = Form(1280),
    banner_height: int = Form(720),
    detail_width: int = Form(720),
    detail_height: int = Form(1280),
    video_width: int = Form(832),
    video_height: int = Form(480),
    video_fps: int = Form(24),
    video_inference_steps: int = Form(12),
    video_duration_seconds: int = Form(15),
    include_music: bool = Form(True),
    music_language: str = Form("ko"),
    music_lyrics: str = Form(""),
    music_vocal_mode: str = Form("instrumental"),
    images: list[UploadFile] = File(default=[]),
) -> ProjectCreateRequest:
    """
    multipart/form-data 요청을 프로젝트 요청 객체로 바꾼다.

    Returns:
        생성 요청 객체
    """

    project_id = f"upload-{uuid4()}"
    saved_paths = save_uploaded_files(project_id, await _read_uploads(images))
    return ProjectCreateRequest(
        product_name=product_name,
        prompt=prompt,
        tone=tone,
        banner_width=banner_width,
        banner_height=banner_height,
        detail_width=detail_width,
        detail_height=detail_height,
        video_width=video_width,
        video_height=video_height,
        video_fps=video_fps,
        video_inference_steps=video_inference_steps,
        video_duration_seconds=video_duration_seconds,
        image_paths=saved_paths,
        include_music=include_music,
        music_language=music_language,
        music_lyrics=music_lyrics,
        music_vocal_mode=music_vocal_mode,
    )


@router.post("/image", response_model=GenerationResponse)
async def generate_image(
    payload: ProjectCreateRequest = Depends(_build_form_payload),
) -> GenerationResponse:
    """
    이미지 전용 생성 요청을 처리한다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        이미지 생성 결과
    """

    try:
        logger.info("API /generate/image 요청 수신")
        asset_paths = generate_image_asset_bundle(create_validated_request(payload))
        logger.info("API /generate/image 요청 완료")
        return GenerationResponse(
            mode="image",
            message="배너와 상세 이미지, 로고 초안이 준비됐습니다.",
            project_root=str(asset_paths["project_root"]),
            asset_paths=asset_paths,
        )
    except ValueError as exc:
        logger.exception("API /generate/image 검증 오류")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("API /generate/image 처리 오류")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/video", response_model=GenerationResponse)
async def generate_video(
    payload: ProjectCreateRequest = Depends(_build_form_payload),
) -> GenerationResponse:
    """
    영상 전용 생성 요청을 처리한다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        영상 생성 결과
    """

    try:
        logger.info("API /generate/video 요청 수신")
        asset_paths = generate_video_asset_bundle(create_validated_request(payload))
        logger.info("API /generate/video 요청 완료")
        return GenerationResponse(
            mode="video",
            message="짧은 광고 영상과 배경 음악, 최종 합성본이 준비됐습니다.",
            project_root=str(asset_paths["project_root"]),
            asset_paths=asset_paths,
        )
    except ValueError as exc:
        logger.exception("API /generate/video 검증 오류")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("API /generate/video 처리 오류")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/music", response_model=GenerationResponse)
async def generate_music(
    payload: ProjectCreateRequest = Depends(_build_form_payload),
) -> GenerationResponse:
    """
    음악 전용 생성 요청을 처리한다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        음악 생성 결과
    """

    try:
        logger.info("API /generate/music 요청 수신")
        asset_paths = generate_music_asset_bundle(create_validated_request(payload))
        logger.info("API /generate/music 요청 완료")
        return GenerationResponse(
            mode="music",
            message="영상 길이에 맞춘 배경 음악이 준비됐습니다.",
            project_root=str(asset_paths["project_root"]),
            asset_paths=asset_paths,
        )
    except ValueError as exc:
        logger.exception("API /generate/music 검증 오류")
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("API /generate/music 처리 오류")
        raise HTTPException(status_code=500, detail=str(exc)) from exc
