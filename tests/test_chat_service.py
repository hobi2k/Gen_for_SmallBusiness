"""채팅 서비스의 도구 호출 흐름 테스트 모듈"""

from backend.app.schemas.chat import ChatGenerateRequest
from backend.app.services import chat_service, llm_agent_service


def test_run_chat_generation_uses_tool_call_for_video(monkeypatch) -> None:
    """
    채팅 서비스가 도구 호출 결과에 따라 영상 생성 경로를 타는지 확인한다.
    """

    monkeypatch.setattr(
        llm_agent_service,
        "choose_chat_tool_call",
        lambda payload: llm_agent_service.ChatToolDecision(
            tool_name="generate_video",
            arguments={
                "category": "생활용품",
                "product_name": "세제",
                "summary": "향이 오래가는 세제",
                "description": "빨래 후에도 향이 오래 남는 세제입니다.",
                "keywords": ["세제", "향기"],
                "selling_points": ["향이 오래갑니다."],
                "tone": "깔끔한 판매형",
                "video_duration_seconds": 7,
                "include_music": False,
                "music_language": "ko",
                "music_lyrics": "",
                "music_vocal_mode": "instrumental",
                "assistant_message": "영상으로 바로 만들겠습니다.",
            },
        ),
    )
    monkeypatch.setattr(chat_service, "create_validated_request", lambda request: request)
    monkeypatch.setattr(
        chat_service,
        "generate_video_asset_bundle",
        lambda request: {
            "project_root": "/tmp/video-project",
            "video": "/tmp/video.mp4",
        },
    )

    result = chat_service.run_chat_generation(
        ChatGenerateRequest(message="세제 광고 하나 만들어줘")
    )

    assert result.intent == "video"
    assert result.assistant_message == "영상으로 바로 만들겠습니다."
    assert result.asset_paths["video"] == "/tmp/video.mp4"


def test_run_chat_generation_returns_question_when_more_input_is_needed(monkeypatch) -> None:
    """
    입력이 부족하면 생성 대신 추가 질문 응답을 돌려줘야 한다.
    """

    monkeypatch.setattr(
        llm_agent_service,
        "choose_chat_tool_call",
        lambda payload: llm_agent_service.ChatToolDecision(
            tool_name="ask_for_more_info",
            arguments={"question": "어떤 상품을 만들지 먼저 알려주세요."},
        ),
    )

    result = chat_service.run_chat_generation(ChatGenerateRequest(message="광고 하나 만들어줘"))

    assert result.status == "needs_input"
    assert result.assistant_message == "어떤 상품을 만들지 먼저 알려주세요."
    assert result.asset_paths == {}
