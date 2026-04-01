"""실사용 흐름 기준 회귀 테스트 모듈"""

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.services import generation_service


def _make_payload(include_music: bool = True) -> ProjectCreateRequest:
    """
    회귀 테스트용 기본 요청 객체를 만든다.

    Args:
        include_music: 영상에 음악 포함 여부

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
        image_paths=["/tmp/upload.png"],
        include_music=include_music,
    )


def _patch_common_video_flow(monkeypatch, payload: ProjectCreateRequest) -> None:
    """
    영상 생성 서비스 테스트에 공통으로 쓰는 모의 함수를 등록한다.

    Args:
        monkeypatch: pytest monkeypatch 도구
        payload: 테스트용 요청 객체
    """

    monkeypatch.setattr(generation_service, "create_validated_request", lambda incoming: incoming)
    monkeypatch.setattr(generation_service.settings, "storage_root", "/tmp")
    monkeypatch.setattr(
        generation_service,
        "generate_copy",
        lambda request: {"video_script": "script"},
    )
    monkeypatch.setattr(
        generation_service,
        "generate_detail_images",
        lambda *args: ["/tmp/detail.png"],
    )
    monkeypatch.setattr(
        generation_service,
        "generate_banner_images",
        lambda *args: ["/tmp/banner.png"],
    )
    monkeypatch.setattr(
        generation_service,
        "select_key_visual",
        lambda detail_paths, banner_paths, image_paths: image_paths[0],
    )
    monkeypatch.setattr(
        generation_service,
        "generate_short_video",
        lambda *args: "/tmp/video.mp4",
    )


def test_generate_video_asset_bundle_skips_music_when_disabled(monkeypatch) -> None:
    """
    영상 생성에서 음악을 끄면 음악과 합성 단계가 호출되지 않는지 확인한다.
    """

    payload = _make_payload(include_music=False)
    _patch_common_video_flow(monkeypatch, payload)

    def _fail_music(*args, **kwargs):
        raise AssertionError("음악 생성이 호출되면 안 됩니다.")

    monkeypatch.setattr(generation_service, "generate_music", _fail_music)
    monkeypatch.setattr(generation_service, "compose_final_video", _fail_music)

    result = generation_service.generate_video_asset_bundle(payload)

    assert result["hero_asset_path"] == "/tmp/upload.png"
    assert result["video"] == "/tmp/video.mp4"
    assert "music" not in result
    assert "final_video" not in result


def test_generate_video_asset_bundle_includes_music_when_enabled(monkeypatch) -> None:
    """
    영상 생성에서 음악을 켜면 음악과 합성본 경로가 결과에 포함되는지 확인한다.
    """

    payload = _make_payload(include_music=True)
    _patch_common_video_flow(monkeypatch, payload)
    monkeypatch.setattr(generation_service, "generate_music", lambda *args: "/tmp/music.wav")
    monkeypatch.setattr(generation_service, "compose_final_video", lambda *args: "/tmp/final.mp4")

    result = generation_service.generate_video_asset_bundle(payload)

    assert result["hero_asset_path"] == "/tmp/upload.png"
    assert result["music"] == "/tmp/music.wav"
    assert result["final_video"] == "/tmp/final.mp4"


def test_generate_image_asset_bundle_returns_full_asset_groups(monkeypatch) -> None:
    """
    이미지 생성 결과에 배너, 상세, 로고 경로가 모두 담기는지 확인한다.
    """

    payload = _make_payload()
    monkeypatch.setattr(generation_service, "create_validated_request", lambda incoming: incoming)
    monkeypatch.setattr(generation_service.settings, "storage_root", "/tmp")
    monkeypatch.setattr(generation_service, "generate_copy", lambda request: {"headline": "제목"})
    monkeypatch.setattr(
        generation_service,
        "generate_banner_images",
        lambda *args: ["/tmp/banner.png"],
    )
    monkeypatch.setattr(
        generation_service,
        "generate_detail_images",
        lambda *args: ["/tmp/detail.png"],
    )
    monkeypatch.setattr(generation_service, "generate_logo_drafts", lambda *args: ["/tmp/logo.png"])

    result = generation_service.generate_image_asset_bundle(payload)

    assert result["banners"] == ["/tmp/banner.png"]
    assert result["details"] == ["/tmp/detail.png"]
    assert result["logos"] == ["/tmp/logo.png"]
