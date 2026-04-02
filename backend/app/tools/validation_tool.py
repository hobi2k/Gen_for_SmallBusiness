"""입력 검증 도구 모듈"""

from backend.app.schemas.project import ProjectCreateRequest

ALLOWED_TONES = {
    "깔끔한 판매형",
    "따뜻한 공감형",
    "밝은 행사형",
    "고급스러운 브랜드형",
}

ALLOWED_VOCAL_MODES = {
    "instrumental",
    "vocal",
}


def _validate_dimension(value: int, label: str) -> None:
    """
    해상도 입력값 범위를 확인한다.

    Args:
        value: 검증할 해상도 숫자
        label: 에러 메시지에 넣을 항목 이름
    """

    if value < 256 or value > 2048:
        raise ValueError(f"{label}는 256 이상 2048 이하만 가능합니다.")


def validate_input(payload: ProjectCreateRequest) -> ProjectCreateRequest:
    """
    생성 요청에 필요한 최소 입력값과 분위기 값을 검증한다.

    Args:
        payload: 사용자가 보낸 생성 요청 데이터

    Returns:
        검증을 통과한 요청 데이터
    """

    if payload.tone not in ALLOWED_TONES:
        raise ValueError("허용되지 않은 분위기 값입니다.")

    if not payload.product_name.strip():
        raise ValueError("상품명은 비어 있을 수 없습니다.")

    if payload.video_duration_seconds < 1 or payload.video_duration_seconds > 40:
        raise ValueError("영상 길이는 1초 이상 40초 이하만 가능합니다.")

    _validate_dimension(payload.banner_width, "배너 너비")
    _validate_dimension(payload.banner_height, "배너 높이")
    _validate_dimension(payload.detail_width, "상세 이미지 너비")
    _validate_dimension(payload.detail_height, "상세 이미지 높이")
    _validate_dimension(payload.video_width, "영상 너비")
    _validate_dimension(payload.video_height, "영상 높이")

    if payload.video_fps < 12 or payload.video_fps > 30:
        raise ValueError("영상 프레임은 12 이상 30 이하만 가능합니다.")

    if payload.video_inference_steps < 8 or payload.video_inference_steps > 24:
        raise ValueError("영상 생성 스텝은 8 이상 24 이하만 가능합니다.")

    if payload.music_vocal_mode not in ALLOWED_VOCAL_MODES:
        raise ValueError("보컬 모드는 instrumental 또는 vocal만 가능합니다.")

    if not payload.music_language.strip():
        raise ValueError("음악 언어는 비어 있을 수 없습니다.")

    if not payload.include_music and payload.music_vocal_mode == "vocal":
        raise ValueError("음악을 끄면 보컬 모드는 사용할 수 없습니다.")

    return payload
