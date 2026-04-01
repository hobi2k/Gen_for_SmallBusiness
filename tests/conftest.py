"""테스트 전역 설정 모듈"""

from __future__ import annotations

import os
from pathlib import Path

import pytest


def pytest_configure() -> None:
    """
    테스트 실행 전에 공통 환경 값을 강제로 고정한다.
    """

    os.environ["USE_LOCAL_AI_MODELS"] = "false"
    os.environ["STORAGE_ROOT"] = str(Path("/tmp/장사한컷-tests"))

    from backend.app.core.config import get_settings

    get_settings.cache_clear()
    settings = get_settings()

    from backend.app import main
    from backend.app.db import session
    from backend.app.services import project_service
    from backend.app.tools import runtime_support

    main.settings = settings
    session.settings = settings
    project_service.settings = settings
    runtime_support.settings = settings


@pytest.fixture(autouse=True)
def patch_llm_calls(monkeypatch) -> None:
    """
    테스트에서 LLM 네트워크 호출을 고정 응답으로 대체한다.
    """

    from backend.app.services import llm_agent_service

    monkeypatch.setattr(
        llm_agent_service,
        "choose_chat_tool_call",
        lambda payload: llm_agent_service.ChatToolDecision(
            tool_name="generate_music"
            if "음악" in payload.message
            else "generate_video"
            if "영상" in payload.message
            else "generate_image",
            arguments={
                "category": payload.category or "일반",
                "product_name": payload.product_name or "채팅 생성 요청",
                "summary": payload.summary or payload.message,
                "description": payload.description or payload.message,
                "keywords": payload.keywords,
                "selling_points": payload.selling_points or [payload.summary or payload.message],
                "tone": payload.tone,
                "video_duration_seconds": payload.video_duration_seconds,
                "include_music": payload.include_music,
                "music_language": payload.music_language,
                "music_lyrics": payload.music_lyrics,
                "music_vocal_mode": payload.music_vocal_mode,
                "assistant_message": "테스트용 도구 호출 응답입니다.",
            },
        ),
    )
    monkeypatch.setattr(
        llm_agent_service,
        "generate_copy_with_llm",
        lambda payload: {
            "headline": f"{payload.product_name} 광고 제목",
            "subheads": [payload.summary, payload.tone],
            "detail_headline": f"{payload.product_name} 상세 제목",
            "short_social_copies": [payload.summary, payload.description],
            "music_prompt": f"{payload.product_name} 음악 프롬프트",
            "music_lyrics": payload.music_lyrics,
            "music_language": payload.music_language,
            "music_vocal_mode": payload.music_vocal_mode,
            "video_script": f"{payload.product_name} 영상 스크립트",
        },
    )
