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
        banner_width=1280,
        banner_height=720,
        detail_width=720,
        detail_height=1280,
        video_width=720,
        video_height=1280,
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
        lambda *args, **kwargs: ["/tmp/detail.png"],
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
    monkeypatch.setattr(
        generation_service,
        "overlay_text_on_image",
        lambda raw_path, output_path, payload, copy_bundle, asset_kind: output_path,
    )
    monkeypatch.setattr(
        generation_service,
        "overlay_text_on_video",
        lambda project_id, source_path, payload, copy_bundle: "/tmp/video_overlay.mp4",
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

    assert result["hero_asset_path"] == "/tmp/detail_final.png"
    assert result["video"] == "/tmp/video_overlay.mp4"
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

    assert result["hero_asset_path"] == "/tmp/detail_final.png"
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
        lambda *args, **kwargs: ["/tmp/detail.png"],
    )
    monkeypatch.setattr(generation_service, "generate_logo_drafts", lambda *args: ["/tmp/logo.png"])
    monkeypatch.setattr(
        generation_service,
        "overlay_text_on_image",
        lambda raw_path, output_path, payload, copy_bundle, asset_kind: output_path,
    )

    result = generation_service.generate_image_asset_bundle(payload)

    assert result["banners"] == ["/tmp/banner_final.png"]
    assert result["details"] == ["/tmp/detail_final.png"]
    assert result["logos"] == ["/tmp/logo.png"]


def test_generate_video_asset_bundle_passes_custom_resolutions(monkeypatch) -> None:
    """
    영상 생성 서비스가 요청 해상도를 상세 이미지와 영상 생성 단계에 넘기는지 확인한다.
    """

    payload = _make_payload()
    payload.detail_width = 900
    payload.detail_height = 1600
    payload.video_width = 1080
    payload.video_height = 1920

    monkeypatch.setattr(generation_service, "create_validated_request", lambda incoming: incoming)
    monkeypatch.setattr(generation_service.settings, "storage_root", "/tmp")
    monkeypatch.setattr(
        generation_service,
        "generate_copy",
        lambda request: {"video_script": "script"},
    )
    captured: dict[str, tuple[int, int]] = {}

    def _capture_detail_images(*args, **kwargs):
        captured["detail"] = (kwargs["width"], kwargs["height"])
        return ["/tmp/detail.png"]

    def _capture_video(project_id, request, key_visual_path, copy_bundle):
        captured["video"] = (request.video_width, request.video_height)
        return "/tmp/video.mp4"

    monkeypatch.setattr(generation_service, "generate_detail_images", _capture_detail_images)
    monkeypatch.setattr(
        generation_service,
        "generate_banner_images",
        lambda *args: ["/tmp/banner.png"],
    )
    monkeypatch.setattr(
        generation_service,
        "overlay_text_on_image",
        lambda raw_path, output_path, payload, copy_bundle, asset_kind: output_path,
    )
    monkeypatch.setattr(
        generation_service,
        "select_key_visual",
        lambda detail_paths, banner_paths, image_paths: detail_paths[0],
    )
    monkeypatch.setattr(generation_service, "generate_short_video", _capture_video)
    monkeypatch.setattr(
        generation_service,
        "overlay_text_on_video",
        lambda project_id, source_path, payload, copy_bundle: "/tmp/video_overlay.mp4",
    )
    monkeypatch.setattr(generation_service, "generate_music", lambda *args: "/tmp/music.wav")
    monkeypatch.setattr(generation_service, "compose_final_video", lambda *args: "/tmp/final.mp4")

    generation_service.generate_video_asset_bundle(payload)

    assert captured["detail"] == (900, 1600)
    assert captured["video"] == (1080, 1920)
