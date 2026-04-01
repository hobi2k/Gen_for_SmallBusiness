"""런타임 보조 함수 테스트 모듈"""

from pathlib import Path

from backend.app.tools import runtime_support


def test_pick_tone_colors_accepts_all_allowed_tones() -> None:
    """
    허용된 톤 이름이 모두 별도 색상 팔레트를 가져야 한다.
    """

    tones = {
        "깔끔한 판매형",
        "따뜻한 공감형",
        "밝은 행사형",
        "고급스러운 브랜드형",
    }

    for tone in tones:
        start_color, end_color = runtime_support.pick_tone_colors(tone)
        assert start_color != (238, 238, 238)
        assert end_color != (148, 148, 148)


def test_get_model_repo_id_returns_manifest_value() -> None:
    """
    모델 이름으로 repo_id를 정확히 찾을 수 있어야 한다.
    """

    assert runtime_support.get_model_repo_id("ace_step") == "ACE-Step/Ace-Step1.5"


def test_get_project_root_returns_storage_root_path(monkeypatch) -> None:
    """
    프로젝트 루트 계산이 저장 루트 기준으로 일관되어야 한다.
    """

    monkeypatch.setattr(runtime_support.settings, "storage_root", "/tmp/장사한컷-tests")

    assert runtime_support.get_project_root("sample-project") == Path("/tmp/장사한컷-tests/sample-project")
