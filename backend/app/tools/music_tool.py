"""음악 생성 도구 모듈"""

from __future__ import annotations

import logging
from pathlib import Path
import subprocess
import sys

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.runtime_support import (
    can_use_cuda_models,
    ensure_project_root,
    get_media_duration,
    get_model_dir,
    get_model_repo_id,
    is_model_downloaded,
    run_ffmpeg,
)

logger = logging.getLogger(__name__)


def _find_ace_step_checkpoint_dir(model_dir: Path) -> Path:
    """
    ACE-Step 실제 체크포인트 스냅샷 디렉토리를 찾는다.

    Args:
        model_dir: ACE-Step 모델 루트 디렉토리

    Returns:
        실제 체크포인트 스냅샷 경로
    """

    required_dir_names = [
        "music_dcae_f8c8",
        "music_vocoder",
        "ace_step_transformer",
        "umt5-base",
    ]

    repo_id = get_model_repo_id("ace_step")
    preferred_repo_dir_name = f"models--{repo_id.replace('/', '--')}"
    preferred_candidates = sorted(
        model_dir.glob(f"{preferred_repo_dir_name}/snapshots/*"),
    )
    fallback_candidates = sorted(model_dir.glob("models--ACE-Step--*/snapshots/*"))
    direct_candidates = [path for path in model_dir.iterdir() if path.is_dir()]

    seen: set[Path] = set()
    for candidate in [*preferred_candidates, *fallback_candidates, *direct_candidates]:
        if candidate in seen:
            continue
        seen.add(candidate)

        required_dirs = [candidate / name for name in required_dir_names]
        if all(path.exists() for path in required_dirs):
            return candidate

    raise FileNotFoundError(f"ACE-Step 체크포인트 스냅샷을 찾지 못했습니다: {model_dir}")


def _build_music_prompt(payload: ProjectCreateRequest) -> str:
    """
    광고 음악 생성용 프롬프트를 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        음악 생성 프롬프트 문자열
    """

    vocal_text = (
        "instrumental only"
        if payload.music_vocal_mode == "instrumental"
        else "with vocals"
    )
    return (
        f"commercial music, {payload.tone}, {payload.product_name}, "
        f"{payload.prompt}, {payload.video_duration_seconds} seconds, {vocal_text}, "
        "clear pronunciation, simple memorable melody, "
        "natural vocal timing, easy syllables, "
        f"{payload.music_language}"
    )


def _build_lyrics(payload: ProjectCreateRequest, copy_bundle: dict[str, str | list[str]]) -> str:
    """
    실제 음악 생성에 사용할 가사를 정리한다.

    Args:
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과

    Returns:
        가사 문자열
    """

    if payload.music_vocal_mode != "vocal":
        return ""

    lyrics = str(copy_bundle.get("music_lyrics", payload.music_lyrics)).strip()
    return lyrics


def _validate_music_duration(output_path: str, expected_seconds: int) -> None:
    """
    생성된 음악 길이가 목표 길이와 충분히 가까운지 확인한다.

    Args:
        output_path: 생성된 음악 파일 경로
        expected_seconds: 목표 길이
    """

    actual_duration = get_media_duration(output_path)
    if abs(actual_duration - float(expected_seconds)) > 0.35:
        raise RuntimeError(
            f"생성된 음악 길이가 목표 길이와 다릅니다. "
            f"(목표 {expected_seconds}초, 실제 {actual_duration:.2f}초)"
        )


def _postprocess_music(output_path: Path, expected_seconds: int) -> None:
    """
    생성된 음악 끝부분을 자연스럽게 정리하고 길이를 목표 길이로 맞춘다.

    Args:
        output_path: 생성된 wav 경로
        expected_seconds: 목표 길이
    """

    actual_duration = get_media_duration(str(output_path))
    fade_duration = 0.75
    fade_start = max(min(actual_duration - fade_duration, float(expected_seconds) - fade_duration), 0.0)
    polished_path = output_path.with_name("music_polished.wav")
    logger.info(
        "음악 후처리 시작: 입력=%s, 목표길이=%s초, 실제길이=%.2f초",
        output_path,
        expected_seconds,
        actual_duration,
    )
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(output_path),
            "-af",
            (
                f"afade=t=out:st={fade_start:.3f}:d={fade_duration:.3f},"
                f"apad=whole_dur={float(expected_seconds):.3f},"
                f"atrim=end={float(expected_seconds):.3f}"
            ),
            "-c:a",
            "pcm_s16le",
            str(polished_path),
        ],
    )
    polished_path.replace(output_path)
    logger.info("음악 후처리 완료: %s", output_path)


def _get_ace_step_worker_path() -> Path:
    """
    ACE-Step 서브프로세스 작업 스크립트 경로를 반환한다.

    Returns:
        작업 스크립트 경로
    """

    return Path(__file__).with_name("ace_step_worker.py")


def _try_generate_with_ace_step(
    project_root,
    payload: ProjectCreateRequest,
    music_prompt: str,
    music_lyrics: str,
) -> str | None:
    """
    ACE-Step 로컬 모델이 준비된 경우 실제 배경 음악 생성을 시도한다.

    Args:
        project_root: 프로젝트 저장 루트
        payload: 프로젝트 생성 요청 데이터
        music_prompt: 문구 생성 단계에서 정리된 음악 프롬프트

    Returns:
        성공 시 저장 경로, 실패 시 None
    """

    if not can_use_cuda_models():
        return None
    if not is_model_downloaded("ace_step"):
        return None

    try:
        output_path = project_root / "music.wav"
        model_dir = get_model_dir("ace_step")
        checkpoint_dir = _find_ace_step_checkpoint_dir(model_dir)
        prompt = music_prompt or _build_music_prompt(payload)
        logger.info(
            "ACE-Step 음악 생성 시작: 길이=%s초, 보컬=%s, 언어=%s",
            payload.video_duration_seconds,
            payload.music_vocal_mode,
            payload.music_language,
        )
        logger.info("ACE-Step 체크포인트 사용: %s", checkpoint_dir)
        logger.info("ACE-Step 서브프로세스 호출 시작: %s", output_path)
        subprocess.run(
            [
                sys.executable,
                str(_get_ace_step_worker_path()),
                "--checkpoint-dir",
                str(checkpoint_dir),
                "--duration",
                str(float(payload.video_duration_seconds)),
                "--prompt",
                prompt,
                "--lyrics",
                music_lyrics,
                "--output-path",
                str(output_path),
            ],
            check=True,
        )
        logger.info("ACE-Step 서브프로세스 호출 완료: %s", output_path)
        _postprocess_music(output_path, payload.video_duration_seconds)
        _validate_music_duration(str(output_path), payload.video_duration_seconds)
        logger.info("음악 길이 검증 완료: %s", output_path)
        return str(output_path)
    except Exception as exc:
        raise RuntimeError("ACE-Step 음악 생성에 실패했습니다.") from exc


def generate_music(
    project_id: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
) -> str:
    """
    분위기에 맞는 배경 음악 결과물 경로를 생성한다.

    Args:
        project_id: 프로젝트 식별자
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과

    Returns:
        생성된 음악 파일 경로
    """

    root = ensure_project_root(project_id)
    music_prompt = str(copy_bundle.get("music_prompt", _build_music_prompt(payload)))
    music_lyrics = _build_lyrics(payload, copy_bundle)
    generated_path = _try_generate_with_ace_step(
        root,
        payload,
        music_prompt,
        music_lyrics,
    )
    if generated_path is None:
        raise RuntimeError("실제 음악 모델 생성에 실패했습니다.")
    return generated_path
