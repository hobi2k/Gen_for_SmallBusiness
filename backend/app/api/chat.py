"""채팅 기반 생성 API 모듈"""

from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from backend.app.schemas.chat import ChatGenerateRequest, ChatGenerateResponse
from backend.app.services.chat_service import run_chat_generation
from backend.app.tools.runtime_support import save_uploaded_files

router = APIRouter()


async def _read_uploads(files: list[UploadFile]) -> list[tuple[str, bytes]]:
    """
    채팅 첨부 파일 목록을 메모리로 읽는다.

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


async def _build_chat_payload(
    message: str = Form(...),
    tone: str = Form("깔끔한 판매형"),
    video_duration_seconds: int = Form(6),
    include_music: bool = Form(True),
    music_language: str = Form("ko"),
    music_lyrics: str = Form(""),
    music_vocal_mode: str = Form("instrumental"),
    images: list[UploadFile] = File(default=[]),
) -> ChatGenerateRequest:
    """
    채팅용 multipart/form-data 요청을 채팅 스키마로 바꾼다.

    Returns:
        채팅 생성 요청 객체
    """

    project_id = f"chat-upload-{uuid4()}"
    saved_paths = save_uploaded_files(project_id, await _read_uploads(images))
    return ChatGenerateRequest(
        message=message,
        tone=tone,
        video_duration_seconds=video_duration_seconds,
        image_paths=saved_paths,
        include_music=include_music,
        music_language=music_language,
        music_lyrics=music_lyrics,
        music_vocal_mode=music_vocal_mode,
    )


@router.post("/generate", response_model=ChatGenerateResponse)
def generate_from_chat(
    payload: ChatGenerateRequest = Depends(_build_chat_payload),
) -> ChatGenerateResponse:
    """
    채팅 메시지를 바탕으로 공용 생성 도구를 호출한다.

    Args:
        payload: 채팅 기반 생성 요청

    Returns:
        생성 결과 응답
    """

    try:
        return run_chat_generation(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
