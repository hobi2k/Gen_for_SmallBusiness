"""텍스트 오버레이 도구 테스트 모듈"""

from pathlib import Path

from PIL import Image

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.text_overlay_tool import overlay_text_on_image


def _make_payload() -> ProjectCreateRequest:
    """
    오버레이 테스트용 기본 요청 객체를 만든다.

    Returns:
        테스트용 요청 객체
    """

    return ProjectCreateRequest(
        category="식품",
        product_name="수제 딸기잼",
        summary="빵과 잘 어울리는 수제 잼",
        description="딸기를 오래 졸여 만든 수제 잼입니다.",
        keywords=["수제", "딸기"],
        selling_points=["과육이 살아 있습니다."],
        tone="깔끔한 판매형",
        video_duration_seconds=6,
        image_paths=[],
    )


def test_overlay_text_on_image_creates_output(tmp_path: Path) -> None:
    """
    이미지 오버레이 함수가 최종 파일을 실제로 저장하는지 확인한다.
    """

    source_path = tmp_path / "source.png"
    output_path = tmp_path / "output.png"
    Image.new("RGB", (1280, 720), (230, 220, 210)).save(source_path)
    copy_bundle = {
        "headline": "수제 딸기잼",
        "detail_headline": "빵과 함께 더 맛있는 수제 잼",
        "subheads": ["과육이 살아 있는 아침 한 스푼"],
        "short_social_copies": ["한 번 보면 바로 맛이 상상되는 잼"],
    }

    result = overlay_text_on_image(
        str(source_path),
        str(output_path),
        _make_payload(),
        copy_bundle,
        asset_kind="banner",
    )

    assert result == str(output_path)
    assert output_path.exists()
