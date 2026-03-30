"""입력 검증 도구 모듈"""

from backend.app.schemas.project import ProjectCreateRequest

ALLOWED_TONES = {
    "깔끔한 판매형",
    "따뜻한 공감형",
    "밝은 행사형",
    "고급스러운 브랜드형",
}


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

    if not payload.category.strip():
        raise ValueError("업종은 비어 있을 수 없습니다.")

    if payload.video_duration_seconds < 3 or payload.video_duration_seconds > 10:
        raise ValueError("영상 길이는 3초 이상 10초 이하만 가능합니다.")

    return payload
