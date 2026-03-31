"""채팅 기반 생성 요청을 공용 도구 계층으로 연결하는 서비스 모듈"""

from __future__ import annotations

from backend.app.schemas.chat import ChatGenerateRequest, ChatGenerateResponse
from backend.app.schemas.project import ProjectCreateRequest
from backend.app.services.generation_service import (
    create_validated_request,
    generate_image_asset_bundle,
    generate_music_asset_bundle,
    generate_video_asset_bundle,
)


def _detect_intent(message: str) -> str:
    """
    사용자 문장에서 호출할 생성 도구 종류를 추정한다.

    Args:
        message: 사용자 자연어 요청

    Returns:
        추정된 생성 의도 문자열
    """

    lowered = message.lower()
    if "음악" in message or "bgm" in lowered or "배경음" in message:
        return "music"
    if "영상" in message or "video" in lowered or "숏" in message:
        return "video"
    if "이미지" in message or "배너" in message or "로고" in message or "상세" in message:
        return "image"
    return "image"


def _build_project_request(payload: ChatGenerateRequest) -> ProjectCreateRequest:
    """
    채팅 요청을 공용 생성 파이프라인용 프로젝트 요청으로 변환한다.

    Args:
        payload: 채팅 기반 생성 요청

    Returns:
        공용 생성 파이프라인에서 쓰는 요청 객체
    """

    product_name = payload.product_name or "채팅 생성 요청"
    summary = payload.summary or payload.message
    description = payload.description or payload.message
    request = ProjectCreateRequest(
        category=payload.category or "일반",
        product_name=product_name,
        summary=summary,
        description=description,
        keywords=payload.keywords,
        selling_points=payload.selling_points,
        tone=payload.tone,
        video_duration_seconds=payload.video_duration_seconds,
        image_paths=payload.image_paths,
        include_music=payload.include_music,
        music_language=payload.music_language,
        music_lyrics=payload.music_lyrics,
        music_vocal_mode=payload.music_vocal_mode,
    )
    return create_validated_request(request)


def _build_assistant_message(intent: str, asset_paths: dict[str, str | list[str]]) -> str:
    """
    생성 결과 요약 문장을 만든다.

    Args:
        intent: 실행한 생성 의도
        asset_paths: 생성된 자산 경로 딕셔너리

    Returns:
        사용자에게 돌려줄 요약 문장
    """

    if intent == "music":
        return "지금 바로 붙일 수 있는 배경 음악을 만들었습니다."
    if intent == "video":
        return "짧은 광고 영상과 배경 음악, 합성본까지 한 번에 만들었습니다."
    return "배너와 상세 이미지, 로고 초안을 바로 꺼내 쓸 수 있게 만들었습니다."


def run_chat_generation(payload: ChatGenerateRequest) -> ChatGenerateResponse:
    """
    채팅 요청을 받아 공용 도구 계층으로 실제 생성 작업을 수행한다.

    Args:
        payload: 채팅 기반 생성 요청

    Returns:
        생성 결과 경로가 담긴 응답 객체
    """

    intent = _detect_intent(payload.message)
    request = _build_project_request(payload)

    if intent == "music":
        asset_paths = generate_music_asset_bundle(request)
        return ChatGenerateResponse(
            intent=intent,
            assistant_message=_build_assistant_message(
                intent,
                {"music": str(asset_paths["music"])},
            ),
            project_root=str(asset_paths["project_root"]),
            asset_paths=asset_paths,
        )

    if intent == "video":
        asset_paths = generate_video_asset_bundle(request)
        return ChatGenerateResponse(
            intent=intent,
            assistant_message=_build_assistant_message(
                intent,
                {"video": str(asset_paths["video"])},
            ),
            project_root=str(asset_paths["project_root"]),
            asset_paths=asset_paths,
        )

    asset_paths = generate_image_asset_bundle(request)
    return ChatGenerateResponse(
        intent=intent,
        assistant_message=_build_assistant_message(intent, {"banners": []}),
        project_root=str(asset_paths["project_root"]),
        asset_paths=asset_paths,
    )
