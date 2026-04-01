"""음악 생성 길이 검증 테스트 모듈"""

import pytest

from backend.app.tools import music_tool


def test_validate_music_duration_accepts_close_length(monkeypatch) -> None:
    """
    생성된 음악 길이가 목표 길이와 충분히 가깝다면 통과해야 한다.
    """

    monkeypatch.setattr(music_tool, 'get_media_duration', lambda path: 6.18)

    music_tool._validate_music_duration('/tmp/music.wav', 6)


def test_validate_music_duration_rejects_far_length(monkeypatch) -> None:
    """
    생성된 음악 길이가 목표 길이와 너무 다르면 실패해야 한다.
    """

    monkeypatch.setattr(music_tool, 'get_media_duration', lambda path: 5.2)

    with pytest.raises(RuntimeError):
        music_tool._validate_music_duration('/tmp/music.wav', 6)


def test_find_ace_step_checkpoint_dir_uses_manifest_repo_id(tmp_path, monkeypatch) -> None:
    """
    ACE-Step 체크포인트 탐색이 매니페스트 repo_id 기준 경로를 따라야 한다.
    """

    snapshot_dir = tmp_path / "models--ACE-Step--Ace-Step1.5" / "snapshots" / "snapshot-1"
    (snapshot_dir / "music_dcae_f8c8").mkdir(parents=True)
    (snapshot_dir / "music_vocoder").mkdir()
    (snapshot_dir / "ace_step_transformer").mkdir()
    (snapshot_dir / "umt5-base").mkdir()

    monkeypatch.setattr(music_tool, "get_model_repo_id", lambda model_name: "ACE-Step/Ace-Step1.5")

    assert music_tool._find_ace_step_checkpoint_dir(tmp_path) == snapshot_dir
