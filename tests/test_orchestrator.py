"""오케스트레이터 분기 테스트 모듈"""

from types import SimpleNamespace

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.services import orchestrator


class _DummyDb:
    """
    오케스트레이터 테스트용 가벼운 DB 흉내 객체다.
    """

    def add(self, project) -> None:
        self.project = project

    def commit(self) -> None:
        return None

    def refresh(self, project) -> None:
        return None


def _make_payload(include_music: bool) -> ProjectCreateRequest:
    """
    오케스트레이터 테스트용 요청 객체를 만든다.

    Args:
        include_music: 음악 포함 여부

    Returns:
        테스트용 프로젝트 요청
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


def test_run_project_generation_skips_music_when_disabled(monkeypatch) -> None:
    """
    include_music가 꺼져 있으면 음악과 합성 단계가 실행되면 안 된다.
    """

    db = _DummyDb()
    monkeypatch.setattr(orchestrator, "validate_input", lambda payload: payload)
    monkeypatch.setattr(orchestrator, "generate_copy", lambda payload: {"video_script": "script"})
    monkeypatch.setattr(orchestrator, "generate_banner_images", lambda *args: ["/tmp/banner.png"])
    monkeypatch.setattr(orchestrator, "generate_detail_images", lambda *args: ["/tmp/detail.png"])
    monkeypatch.setattr(orchestrator, "generate_logo_drafts", lambda *args: ["/tmp/logo.png"])
    monkeypatch.setattr(orchestrator, "select_key_visual", lambda **kwargs: "/tmp/upload.png")
    monkeypatch.setattr(orchestrator, "generate_short_video", lambda *args: "/tmp/video.mp4")
    monkeypatch.setattr(
        orchestrator,
        "persist_generation_result",
        lambda **kwargs: None,
    )
    monkeypatch.setattr(
        orchestrator,
        "mark_project_failure",
        lambda **kwargs: None,
    )

    def _fail_music(*args, **kwargs):
        raise AssertionError("음악 생성이 호출되면 안 됩니다.")

    monkeypatch.setattr(orchestrator, "generate_music", _fail_music)
    monkeypatch.setattr(orchestrator, "compose_final_video", _fail_music)

    project = orchestrator.run_project_generation(db, _make_payload(include_music=False))

    assert project.status == "running"
