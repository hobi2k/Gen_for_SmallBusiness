"""도구 계층 테스트 모듈"""

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.copy_tool import generate_copy
from backend.app.tools.validation_tool import validate_input
from backend.app.tools.video_tool import select_key_visual


def _make_payload() -> ProjectCreateRequest:
    """
    테스트용 기본 프로젝트 요청 값을 만든다.

    Returns:
        테스트용 요청 객체
    """

    return ProjectCreateRequest(
        category='식품',
        product_name='수제 딸기잼',
        summary='빵과 잘 어울리는 수제 잼',
        description='딸기를 오래 졸여 만든 수제 잼입니다.',
        keywords=['수제', '딸기', '잼'],
        selling_points=['달지 않고 과육이 살아 있습니다.'],
        tone='깔끔한 판매형',
        video_duration_seconds=6,
        image_paths=[],
    )


def test_validate_input_accepts_allowed_tone() -> None:
    """
    허용된 분위기 값이 검증을 통과하는지 확인한다.
    """

    payload = _make_payload()
    validated = validate_input(payload)
    assert validated.tone == '깔끔한 판매형'


def test_generate_copy_returns_video_script() -> None:
    """
    문구 생성 결과에 영상용 대본이 포함되는지 확인한다.
    """

    copy_bundle = generate_copy(_make_payload())
    assert 'video_script' in copy_bundle
    assert 'music_prompt' in copy_bundle
    assert '6초' in str(copy_bundle['music_prompt'])


def test_select_key_visual_prefers_uploaded_image() -> None:
    """
    대표 이미지 선택 시 업로드 이미지를 우선하는지 확인한다.
    """

    selected = select_key_visual(
        detail_paths=['detail.txt'],
        banner_paths=['banner.txt'],
        image_paths=['upload.png'],
    )
    assert selected == 'upload.png'
