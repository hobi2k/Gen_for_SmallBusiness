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
        f"advertising soundtrack, {payload.tone}, {payload.product_name}, "
        f"{payload.video_duration_seconds} seconds, {vocal_text}, {language_text}, "
        "clear lead melody, short hook, memorable motif, clean arrangement"
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

    if payload.music_vocal_mode == "vocal" and payload.music_lyrics:
        copy_bundle["music_lyrics"] = payload.music_lyrics
    if payload.music_vocal_mode == "vocal" and not copy_bundle.get("music_lyrics"):
        raise ValueError("보컬 모드에서는 사용자 가사 또는 GPT가 생성한 가사가 필요합니다.")

    if not copy_bundle.get("music_prompt"):
        copy_bundle["music_prompt"] = _build_music_prompt(payload)
    if not copy_bundle.get("image_prompt"):
        copy_bundle["image_prompt"] = (
            f"commercial banner visual of {payload.product_name}, {payload.tone}, "
            f"{payload.prompt}, polished advertising composition, clean layout"
        )

    if not copy_bundle.get("detail_image_prompt"):
        copy_bundle["detail_image_prompt"] = (
            f"vertical product detail visual of {payload.product_name}, {payload.tone}, "
            f"{payload.prompt}, clean hero composition, premium commercial lighting"
        )

    if not copy_bundle.get("logo_image_prompt"):
        copy_bundle["logo_image_prompt"] = (
            f"brand logo poster for {payload.product_name}, {payload.tone}, "
            f"{payload.prompt}, iconic symbol, clean commercial poster layout"
        )

    if not copy_bundle.get("video_prompt"):
        copy_bundle["video_prompt"] = (
            f"short advertising video for {payload.product_name}, {payload.tone}, "
            f"{payload.prompt}, cinematic motion, clear focal subject, no subtitles"
        )

    return copy_bundle
