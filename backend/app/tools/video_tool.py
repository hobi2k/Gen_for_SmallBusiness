"""영상 생성 도구 모듈"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.runtime_support import (
    can_use_cuda_models,
    ensure_project_root,
    get_model_dir,
    is_model_downloaded,
    render_marketing_card,
    require_real_generation,
    run_ffmpeg,
)


def select_key_visual(
    detail_paths: list[str],
    banner_paths: list[str],
    image_paths: list[str],
) -> str | None:
    """
    영상 생성에 사용할 대표 이미지를 선택한다.

    Args:
        detail_paths: 상세 이미지 경로 목록
        banner_paths: 배너 경로 목록
        image_paths: 사용자가 업로드한 이미지 경로 목록

    Returns:
        선택된 대표 자산 경로
    """

    if image_paths:
        return image_paths[0]
    if detail_paths:
        return detail_paths[0]
    if banner_paths:
        return banner_paths[0]
    return None


@lru_cache(maxsize=1)
def _get_wan_t2v_pipeline():
    """
    Wan 텍스트 기반 영상 파이프라인을 한 번만 로드한다.

    Returns:
        로드된 Wan 파이프라인
    """

    import torch
    from diffusers import AutoencoderKLWan, WanPipeline

    model_dir = get_model_dir("wan_ti2v")
    vae = AutoencoderKLWan.from_pretrained(
        str(model_dir),
        subfolder="vae",
        torch_dtype=torch.float32,
    )
    pipe = WanPipeline.from_pretrained(
        str(model_dir),
        vae=vae,
        torch_dtype=torch.bfloat16,
    )
    pipe.enable_sequential_cpu_offload()
    return pipe


@lru_cache(maxsize=1)
def _get_wan_i2v_pipeline():
    """
    Wan 이미지 기반 영상 파이프라인을 한 번만 로드한다.

    Returns:
        로드된 Wan 이미지 기반 파이프라인
    """

    import torch
    from diffusers import AutoencoderKLWan, WanImageToVideoPipeline

    model_dir = get_model_dir("wan_ti2v")
    vae = AutoencoderKLWan.from_pretrained(
        str(model_dir),
        subfolder="vae",
        torch_dtype=torch.float32,
    )
    pipe = WanImageToVideoPipeline.from_pretrained(
        str(model_dir),
        vae=vae,
        torch_dtype=torch.bfloat16,
    )
    pipe.enable_sequential_cpu_offload()
    return pipe


def release_video_pipelines() -> None:
    """
    캐시된 영상 파이프라인을 해제하고 VRAM을 비운다.
    음악 모델을 로드하기 전에 호출한다.
    """

    import gc

    _get_wan_t2v_pipeline.cache_clear()
    _get_wan_i2v_pipeline.cache_clear()
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


def _try_generate_with_wan(
    output_path: Path,
    payload: ProjectCreateRequest,
    key_visual_path: str | None,
    copy_bundle: dict[str, str | list[str]],
) -> str | None:
    """
    로컬 Wan 모델이 준비된 경우 실제 영상 생성을 시도한다.

    Args:
        output_path: 저장할 영상 경로
        payload: 프로젝트 생성 요청 데이터
        key_visual_path: 대표 이미지 경로
        copy_bundle: 문구 생성 결과

    Returns:
        성공 시 저장 경로, 실패 시 None
    """

    if not can_use_cuda_models():
        return None
    if not is_model_downloaded("wan_ti2v"):
        return None

    try:
        from diffusers.utils import export_to_video, load_image

        if key_visual_path:
            pipe = _get_wan_i2v_pipeline()
            source_image = load_image(key_visual_path).resize((832, 480))
        else:
            pipe = _get_wan_t2v_pipeline()
            source_image = None
        prompt = str(copy_bundle["video_script"])
        negative_prompt = (
            "overexposed, static, blurry details, subtitle, low quality, jpeg artifacts, "
            "ugly, deformed hands, deformed face, fused fingers, crowded background"
        )
        call_kwargs = {
            "prompt": prompt,
            "negative_prompt": negative_prompt,
            "height": 480,
            "width": 832,
            "num_frames": payload.video_duration_seconds * 8 + 1,
            "guidance_scale": 5.0,
            "num_inference_steps": 8,
        }
        if source_image is not None:
            call_kwargs["image"] = source_image

        output = pipe(**call_kwargs).frames[0]
        export_to_video(output, str(output_path), fps=8)
        return str(output_path)
    except Exception as exc:
        if require_real_generation():
            raise RuntimeError("Wan 영상 생성에 실패했습니다.") from exc
        return None


def _ensure_visual_source(
    project_root: Path,
    payload: ProjectCreateRequest,
    key_visual_path: str | None,
    copy_bundle: dict[str, str | list[str]],
) -> Path:
    """
    영상용 대표 비주얼 파일을 보장한다.

    Args:
        project_root: 프로젝트 저장 루트
        payload: 프로젝트 생성 요청 데이터
        key_visual_path: 기존 대표 이미지 경로
        copy_bundle: 문구 생성 결과

    Returns:
        실제로 존재하는 대표 이미지 파일 경로
    """

    if key_visual_path and Path(key_visual_path).exists():
        return Path(key_visual_path)

    fallback_path = project_root / "video_cover.png"
    return Path(
        render_marketing_card(
            output_path=fallback_path,
            title=payload.product_name,
            subtitle=str(copy_bundle["video_script"]),
            badges=payload.selling_points[:2] or [payload.summary],
            width=1280,
            height=720,
            tone=payload.tone,
        ),
    )


def generate_short_video(
    project_id: str,
    payload: ProjectCreateRequest,
    key_visual_path: str | None,
    copy_bundle: dict[str, str | list[str]],
) -> str:
    """
    광고 영상 결과물 경로를 생성한다.

    Args:
        project_id: 프로젝트 식별자
        payload: 프로젝트 생성 요청 데이터
        key_visual_path: 대표 이미지 경로
        copy_bundle: 문구 생성 결과

    Returns:
        생성된 영상 파일 경로
    """

    root = ensure_project_root(project_id)
    output_path = root / "video_raw.mp4"

    generated_path = _try_generate_with_wan(output_path, payload, key_visual_path, copy_bundle)
    if generated_path is not None:
        return generated_path

    if require_real_generation():
        raise RuntimeError("실제 영상 모델 생성이 되지 않아 폴백 없이 중단합니다.")

    visual_source = _ensure_visual_source(root, payload, key_visual_path, copy_bundle)

    # 로컬 모델이 없더라도 바로 시연 가능한 결과물을 만들기 위해
    # 대표 이미지를 6초짜리 간단한 광고 컷으로 변환한다.
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(visual_source),
            "-t",
            str(payload.video_duration_seconds),
            "-vf",
            "scale=1280:720:force_original_aspect_ratio=decrease,"
            "pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=white,"
            f"zoompan=z='min(zoom+0.0008,1.08)':d={payload.video_duration_seconds * 24}:s=1280x720",
            "-r",
            "24",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ],
    )
    return str(output_path)
