"""문구 생성 도구 모듈"""

from backend.app.schemas.project import ProjectCreateRequest


def _build_default_lyrics(payload: ProjectCreateRequest) -> str:
    """
    보컬 모드에서 가사가 비어 있을 때 기본 가사를 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        생성된 기본 가사
    """

    if payload.music_vocal_mode != "vocal":
        return ""

    if payload.music_lyrics.strip():
        return payload.music_lyrics.strip()

    lead_point = payload.selling_points[0] if payload.selling_points else payload.summary
    if payload.music_language == "en":
        return (
            f"[verse]\n{payload.product_name} fits right into your day\n"
            f"{lead_point}\n"
            f"[chorus]\n{payload.product_name}, easy to choose\n"
            f"{payload.summary}"
        )

    return (
        f"[verse]\n{payload.product_name}\n"
        f"{lead_point}\n"
        f"[chorus]\n{payload.product_name}\n"
        f"{payload.summary}"
    )


def _build_music_prompt(payload: ProjectCreateRequest) -> str:
    """
    ACE-Step에 넘길 음악 프롬프트를 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        음악 프롬프트
    """

    keywords = ", ".join(payload.keywords[:4]) if payload.keywords else payload.summary
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
        f"commercial music, {payload.tone}, {payload.category}, {payload.product_name}, "
        f"{keywords}, {payload.video_duration_seconds} seconds, {vocal_text}, {language_text}"
    )


def generate_copy(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    요청 정보를 바탕으로 기본 광고 문구 묶음을 생성한다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        메인 문구와 보조 문구가 담긴 딕셔너리
    """

    # 실제 LLM 연결 전까지는 프런트와 백엔드 흐름을 검증하기 위한 안정적인 기본값을 돌려준다.
    selling_point = payload.selling_points[0] if payload.selling_points else payload.summary
    duration_text = f"{payload.video_duration_seconds}초"
    music_lyrics = _build_default_lyrics(payload)
    return {
        "headline": f"{payload.product_name}, 지금 더 눈에 띄게 소개하세요",
        "subheads": [
            selling_point,
            f"{payload.category} 고객이 바로 이해하는 짧은 문구",
        ],
        "detail_headline": f"{payload.product_name}의 매력을 첫 화면에서 바로 보여줍니다",
        "short_social_copies": [
            f"{payload.product_name} 한 장면으로 시선을 잡아보세요",
            f"{payload.tone} 분위기로 바로 쓸 수 있는 광고 소재",
        ],
        "music_prompt": _build_music_prompt(payload),
        "music_lyrics": music_lyrics,
        "music_language": payload.music_language,
        "music_vocal_mode": payload.music_vocal_mode,
        "video_script": (
            f"{payload.product_name}의 핵심 장점을 {duration_text} 안에 보여주는 광고 영상"
        ),
    }
