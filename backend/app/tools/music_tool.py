"""음악 생성 도구 모듈"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.runtime_support import (
    can_use_cuda_models,
    ensure_project_root,
    get_media_duration,
    get_model_dir,
    get_model_repo_id,
    is_model_downloaded,
)


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


@lru_cache(maxsize=1)
def _get_ace_step_pipeline():
    """
    ACE-Step 파이프라인을 한 번만 로드한다.

    Returns:
        로드된 ACE-Step 파이프라인
    """

    from acestep.pipeline_ace_step import ACEStepPipeline

    model_dir = get_model_dir("ace_step")
    checkpoint_dir = _find_ace_step_checkpoint_dir(model_dir)
    return ACEStepPipeline(
        checkpoint_dir=str(checkpoint_dir),
        dtype="bfloat16",
        torch_compile=False,
        cpu_offload=True,
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
        import soundfile as sf
        import torchaudio

        output_path = project_root / "music.wav"
        model_demo = _get_ace_step_pipeline()
        prompt = music_prompt or _build_music_prompt(payload)
        original_torchaudio_save = torchaudio.save

        def _save_with_soundfile(
            uri,
            src,
            sample_rate,
            *,
            channels_first=True,
            format=None,
            encoding=None,
            bits_per_sample=None,
            buffer_size=4096,
            backend=None,
            compression=None,
        ):
            """
            TorchCodec 의존성 없이 soundfile로 wav를 저장한다.

            Args:
                uri: 저장 경로
                src: 오디오 텐서
                sample_rate: 샘플레이트
                channels_first: 채널 우선 텐서 여부
                format: 저장 포맷
                encoding: 인코딩
                bits_per_sample: 비트 수
                buffer_size: 버퍼 크기
                backend: 백엔드 이름
                compression: 압축 설정
            """

            waveform = src.detach().cpu().numpy()
            if channels_first and waveform.ndim == 2:
                waveform = waveform.T
            sf.write(str(uri), waveform, sample_rate)

        torchaudio.save = _save_with_soundfile
        try:
            # 공식 infer-api 예시의 호출 인자 순서를 그대로 따른다.
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
        finally:
            torchaudio.save = original_torchaudio_save
        _validate_music_duration(str(output_path), payload.video_duration_seconds)
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
