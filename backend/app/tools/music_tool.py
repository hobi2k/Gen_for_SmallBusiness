"""음악 생성 도구 모듈"""

from __future__ import annotations

from functools import lru_cache

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.runtime_support import (
    can_use_cuda_models,
    ensure_project_root,
    get_model_dir,
    is_model_downloaded,
    run_ffmpeg,
)


def _pick_frequency(tone: str) -> int:
    """
    분위기 값에 따라 간단한 폴백 배경음 기본 주파수를 고른다.

    Args:
        tone: 사용자가 고른 분위기

    Returns:
        기본 주파수 값
    """

    table = {
        "깔끔한 판매형": 392,
        "신뢰감 있는 설명형": 330,
        "감성 공감형": 262,
        "밝은 행사 홍보형": 523,
    }
    return table.get(tone, 392)


def _build_music_prompt(payload: ProjectCreateRequest) -> str:
    """
    광고 음악 생성용 프롬프트를 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        음악 생성 프롬프트 문자열
    """

    keywords = ", ".join(payload.keywords[:4]) if payload.keywords else payload.category
    vocal_text = (
        "instrumental only"
        if payload.music_vocal_mode == "instrumental"
        else "with vocals"
    )
    return (
        f"commercial music, {payload.tone}, {payload.product_name}, {payload.category}, "
        f"{keywords}, {payload.video_duration_seconds} seconds, {vocal_text}, "
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


@lru_cache(maxsize=1)
def _get_ace_step_pipeline():
    """
    ACE-Step 파이프라인을 한 번만 로드한다.

    Returns:
        로드된 ACE-Step 파이프라인
    """

    from acestep.pipeline_ace_step import ACEStepPipeline

    model_dir = get_model_dir("ace_step")
    return ACEStepPipeline(
        checkpoint_dir=str(model_dir),
        dtype="bfloat16",
        torch_compile=False,
    )


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
        model_demo = _get_ace_step_pipeline()
        prompt = music_prompt or _build_music_prompt(payload)

        # 공식 infer-api 예시의 호출 인자 순서를 그대로 따른다.
        # 지금 서비스는 짧은 광고용 배경음이 목적이므로 가사 없이 6초 음악으로 고정한다.
        model_demo(
            "wav",  # format
            float(payload.video_duration_seconds),  # audio_duration
            prompt,
            music_lyrics,
            8,  # infer_step
            7.5,  # guidance_scale
            "euler",  # scheduler_type
            "apg",  # cfg_type
            10.0,  # omega_scale
            [42],  # manual_seeds
            0.0,  # guidance_interval
            0.0,  # guidance_interval_decay
            5.0,  # min_guidance_scale
            True,  # use_erg_tag
            bool(music_lyrics),  # use_erg_lyric
            False,  # use_erg_diffusion
            "",  # oss_steps
            0.0,  # guidance_scale_text
            0.0,  # guidance_scale_lyric
            save_path=str(output_path),
        )
        return str(output_path)
    except Exception:
        # ACE-Step 자체는 실제 모델 경로를 시도하되, 환경이 맞지 않으면 생성 전체를 막지 않는다.
        return None


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
    if generated_path is not None:
        return generated_path

    output_path = root / "music.wav"
    frequency = _pick_frequency(payload.tone)

    # GPU나 체크포인트가 없을 때도 전체 파이프라인이 멈추지 않도록
    # 간단한 폴백 배경음을 실제 wav 파일로 생성한다.
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"sine=frequency={frequency}:duration={payload.video_duration_seconds}:sample_rate=44100",
            "-filter:a",
            "volume=0.15",
            str(output_path),
        ],
    )
    return str(output_path)
