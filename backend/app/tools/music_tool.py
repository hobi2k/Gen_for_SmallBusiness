"""음악 생성 도구 모듈"""

from __future__ import annotations

import logging
import os
from pathlib import Path
import subprocess
import sys

from acestep.inference import create_sample, format_sample
from acestep.llm_inference import LLMHandler
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
PROJECT_ROOT = Path(__file__).resolve().parents[3]


def _find_ace_step_checkpoint_dir(model_dir: Path) -> Path:
    """
    ACE-Step 실제 체크포인트 스냅샷 디렉토리를 찾는다.

    Args:
        model_dir: ACE-Step 모델 루트 디렉토리

    Returns:
        실제 체크포인트 스냅샷 경로
    """

    required_dir_names = [
        "acestep-v15-turbo",
        "vae",
        "Qwen3-Embedding-0.6B",
        "acestep-5Hz-lm-4B",
    ]

    direct_required = [model_dir / name for name in required_dir_names]
    if all(path.exists() for path in direct_required):
        return model_dir

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

    raise FileNotFoundError(f"ACE-Step 1.5 체크포인트 경로를 찾지 못했습니다: {model_dir}")


def _build_music_prompt(payload: ProjectCreateRequest) -> str:
    """
    광고 음악 생성용 프롬프트를 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        음악 생성 프롬프트 문자열
    """

    vocal_text = "instrumental only" if payload.music_vocal_mode == "instrumental" else "lead vocal"
    language_text = "korean lyrics" if payload.music_language.startswith("ko") else "english lyrics"
    return (
        f"ad music, {payload.tone}, {payload.product_name}, "
        f"{payload.video_duration_seconds} seconds, {vocal_text}, {language_text}, "
        "catchy hook, clean mix, clear pronunciation, short phrases, memorable chorus"
    )


def _build_music_query(
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
) -> str:
    """
    ACE-Step 1.5 simple mode에 넣을 질의문을 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과

    Returns:
        simple mode 질의문
    """

    llm_prompt = str(copy_bundle.get("music_prompt", "")).strip()
    if llm_prompt:
        return llm_prompt
    return (
        f"{payload.product_name} 광고 음악, {payload.tone}, "
        f"{payload.prompt}, 길이 {payload.video_duration_seconds}초"
    )


def _prepare_ace_step_runtime_root(checkpoint_dir: Path) -> Path:
    """
    공식 ACE-Step 1.5 핸들러가 기대하는 project_root/checkpoints 구조를 만든다.

    Args:
        checkpoint_dir: 체크포인트 디렉토리

    Returns:
        임시 project_root 경로
    """

    runtime_root = PROJECT_ROOT / ".runtime" / "ace-step-runtime"
    runtime_root.mkdir(parents=True, exist_ok=True)
    checkpoints_link = runtime_root / "checkpoints"
    if checkpoints_link.is_symlink() or checkpoints_link.exists():
        if checkpoints_link.resolve() != checkpoint_dir.resolve():
            checkpoints_link.unlink()
    if not checkpoints_link.exists():
        checkpoints_link.symlink_to(checkpoint_dir, target_is_directory=True)
    return runtime_root


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
        runtime_root = _prepare_ace_step_runtime_root(checkpoint_dir)
        query = music_prompt or _build_music_prompt(payload)
        instrumental = payload.music_vocal_mode == "instrumental"
        user_lyrics = music_lyrics.strip()
        generated_caption = query
        generated_lyrics = user_lyrics
        generated_bpm: int | None = None
        generated_keyscale = ""
        generated_timesignature = ""
        generated_language = payload.music_language

        logger.info(
            "ACE-Step 1.5 음악 생성 시작: 길이=%s초, 보컬=%s, 언어=%s",
            payload.video_duration_seconds,
            payload.music_vocal_mode,
            payload.music_language,
        )
        logger.info("ACE-Step 체크포인트 사용: %s", checkpoint_dir)

        llm_handler = LLMHandler()
        llm_model_name = "acestep-5Hz-lm-4B"
        llm_status, llm_ok = llm_handler.initialize(
            checkpoint_dir=str(checkpoint_dir),
            lm_model_path=llm_model_name,
            backend="pt",
            device="cuda",
            offload_to_cpu=True,
            dtype=None,
        )
        if not llm_ok:
            logger.error("ACE-Step 5Hz LM 초기화 실패: %s", llm_status)
            raise RuntimeError(llm_status)
        logger.info("ACE-Step 5Hz LM 초기화 완료: %s", llm_status)

        if instrumental:
            logger.info("ACE-Step 5Hz LM simple mode 호출 시작")
            sample_result = create_sample(
                llm_handler=llm_handler,
                query=query,
                instrumental=instrumental,
                vocal_language=(
                    payload.music_language
                    if payload.music_language and payload.music_language != "unknown"
                    else None
                ),
                temperature=0.85,
                top_k=None,
                top_p=0.9,
            )
            if not sample_result.success:
                raise RuntimeError(
                    sample_result.error or sample_result.status_message or "5Hz LM sample 생성 실패"
                )
            logger.info("ACE-Step 5Hz LM simple mode 호출 완료")
            generated_caption = sample_result.caption or generated_caption
            generated_bpm = sample_result.bpm
            generated_keyscale = sample_result.keyscale or generated_keyscale
            generated_timesignature = sample_result.timesignature or generated_timesignature
            if sample_result.language:
                generated_language = sample_result.language
        else:
            if not generated_lyrics.strip():
                raise RuntimeError("보컬 음악은 사용자 가사 또는 GPT가 생성한 가사가 필요합니다.")
            logger.info("ACE-Step 5Hz LM format mode 호출 시작")
            format_result = format_sample(
                llm_handler=llm_handler,
                caption=query,
                lyrics=generated_lyrics,
                user_metadata={
                    "duration": payload.video_duration_seconds,
                    "language": payload.music_language,
                },
                temperature=0.85,
                top_k=None,
                top_p=0.9,
            )
            if not format_result.success:
                raise RuntimeError(
                    format_result.error or format_result.status_message or "5Hz LM format 생성 실패"
                )
            logger.info("ACE-Step 5Hz LM format mode 호출 완료")
            generated_caption = format_result.caption or generated_caption
            # 보컬 가사는 사용자 입력 또는 GPT 생성 결과를 그대로 유지한다.
            generated_lyrics = generated_lyrics
            generated_bpm = format_result.bpm
            generated_keyscale = format_result.keyscale or generated_keyscale
            generated_timesignature = format_result.timesignature or generated_timesignature
            if format_result.language:
                generated_language = format_result.language

        if instrumental:
            generated_lyrics = "[Instrumental]"
        elif not generated_lyrics.strip():
            raise RuntimeError("보컬 음악은 가사 또는 5Hz LM 생성 결과가 필요합니다.")

        logger.info(
            "ACE-Step 공식 파라미터: caption=%s, bpm=%s, key=%s, time=%s, language=%s",
            generated_caption,
            generated_bpm,
            generated_keyscale,
            generated_timesignature,
            payload.music_language or generated_language,
        )
        logger.info("ACE-Step 서브프로세스 호출 시작: %s", output_path)
        subprocess.run(
            [
                sys.executable,
                str(_get_ace_step_worker_path()),
                "--project-root",
                str(runtime_root),
                "--checkpoint-dir",
                str(checkpoint_dir),
                "--dit-model",
                "acestep-v15-turbo",
                "--lm-model",
                llm_model_name,
                "--caption",
                generated_caption,
                "--lyrics",
                generated_lyrics,
                "--instrumental",
                "true" if instrumental else "false",
                "--language",
                payload.music_language or generated_language or "unknown",
                "--bpm",
                "" if generated_bpm is None else str(generated_bpm),
                "--keyscale",
                generated_keyscale,
                "--time-signature",
                generated_timesignature,
                "--duration",
                str(float(payload.video_duration_seconds)),
                "--output-path",
                str(output_path),
            ],
            check=True,
            env={
                **os.environ,
                "ACESTEP_PROJECT_ROOT": str(runtime_root),
            },
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
    music_prompt = _build_music_query(payload, copy_bundle)
    llm_lyrics = str(copy_bundle.get("music_lyrics", "")).strip()
    user_lyrics = payload.music_lyrics.strip()
    music_lyrics = user_lyrics or llm_lyrics
    if payload.music_vocal_mode == "vocal":
        lyrics_source = "사용자 입력" if user_lyrics else "GPT 생성"
        logger.info("보컬 가사 사용: 출처=%s, 길이=%s자", lyrics_source, len(music_lyrics))
    generated_path = _try_generate_with_ace_step(
        root,
        payload,
        music_prompt,
        music_lyrics,
    )
    if generated_path is None:
        raise RuntimeError("실제 음악 모델 생성에 실패했습니다.")
    return generated_path
