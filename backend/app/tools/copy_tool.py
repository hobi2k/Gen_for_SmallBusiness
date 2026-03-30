"""문구 생성 도구 모듈"""

from backend.app.schemas.project import ProjectCreateRequest


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
        "music_prompt": (
            f"{payload.tone} 분위기의 {duration_text} 광고 배경 음악, "
            f"{payload.product_name}, {payload.category}, "
            f"{', '.join(payload.keywords[:4]) if payload.keywords else payload.summary}, "
            "instrumental, short commercial bgm"
        ),
        "video_script": f"{payload.product_name}의 핵심 장점을 {duration_text} 안에 보여주는 광고 영상",
    }
