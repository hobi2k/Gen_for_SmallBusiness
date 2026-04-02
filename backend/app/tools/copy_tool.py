"""문구 생성 도구 모듈"""

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.services import llm_agent_service


def _build_music_prompt(payload: ProjectCreateRequest) -> str:
    """
    ACE-Step에 넘길 음악 프롬프트를 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        음악 프롬프트
    """

    vocal_text = (
        "instrumental only"
        if payload.music_vocal_mode == "instrumental"
        else "with vocals"
    )
    language_text = (
        f"{payload.music_language} lyrics"
        if payload.music_vocal_mode == "vocal"
        else "no lyrics"
    )
    return (
        f"commercial music, {payload.tone}, {payload.product_name}, "
        f"{payload.prompt}, {payload.video_duration_seconds} seconds, "
        f"{vocal_text}, {language_text}"
    )


def generate_copy(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    요청 정보를 바탕으로 기본 광고 문구 묶음을 생성한다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        메인 문구와 보조 문구가 담긴 딕셔너리
    """

    copy_bundle = llm_agent_service.generate_copy_with_llm(payload)

    if payload.music_vocal_mode == "vocal" and not copy_bundle.get("music_lyrics"):
        raise ValueError("보컬 모드에서는 LLM이 생성한 가사가 반드시 필요합니다.")

    if not copy_bundle.get("music_prompt"):
        copy_bundle["music_prompt"] = _build_music_prompt(payload)

    return copy_bundle
