"""영상 생성 도구 모듈"""

from __future__ import annotations

from functools import lru_cache
import logging
from pathlib import Path

from PIL import Image, ImageOps

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

logger = logging.getLogger(__name__)


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


def _pick_target_fps(payload: ProjectCreateRequest) -> int:
    """
    요청에 맞는 목표 프레임 수를 고른다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        사용할 fps
    """

    return payload.video_fps


def _pick_segment_seconds(payload: ProjectCreateRequest) -> int:
    """
    요청 크기에 맞는 세그먼트 길이를 정한다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        세그먼트 길이(초)
    """

    request_cost = (
        payload.video_width
        * payload.video_height
        * payload.video_fps
        * payload.video_inference_steps
    )
    if request_cost >= 350_000_000:
        return 2
    if request_cost >= 220_000_000:
        return 3
    if request_cost >= 120_000_000:
        return 4
    return 5


def _build_segment_durations(payload: ProjectCreateRequest) -> list[int]:
    """
    긴 영상을 여러 구간으로 나눌 길이 목록을 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        구간 길이 목록
    """

    durations: list[int] = []
    remaining = payload.video_duration_seconds
    segment_seconds = _pick_segment_seconds(payload)
    while remaining > 0:
        current = min(segment_seconds, remaining)
        durations.append(current)
        remaining -= current
    return durations


def _prepare_video_key_visual(key_visual_path: str, width: int, height: int) -> Image.Image:
    """
    요청된 영상 해상도에 맞는 대표 이미지를 만든다.

    Args:
        key_visual_path: 대표 이미지 경로

    Returns:
        요청 해상도에 맞춘 이미지
    """

    source = Image.open(key_visual_path).convert("RGB")
    return ImageOps.fit(
        source,
        (width, height),
        method=Image.Resampling.LANCZOS,
    )


def _export_segment_videos(segment_paths: list[Path], output_path: Path) -> str:
    """
    구간 영상을 하나의 최종 영상으로 합친다.

    Args:
        segment_paths: 구간 영상 경로 목록
        output_path: 최종 저장 경로

    Returns:
        합쳐진 영상 경로
    """

    if len(segment_paths) == 1:
        logger.info("영상 세그먼트가 1개라 바로 최종 파일로 이동합니다: %s", segment_paths[0].name)
        segment_paths[0].replace(output_path)
        logger.info("최종 영상 파일 이동 완료: %s", output_path)
        return str(output_path)

    concat_file = output_path.with_name("video_segments.txt")
    logger.info("영상 세그먼트 %s개를 하나로 합칩니다.", len(segment_paths))
    concat_file.write_text(
        "\n".join(f"file '{path}'" for path in segment_paths),
        encoding="utf-8",
    )
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ],
    )
    logger.info("영상 세그먼트 합치기 완료: %s", output_path)
    return str(output_path)


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
        from diffusers.utils import export_to_video

        logger.info(
            "Wan 영상 생성을 시작합니다. 길이=%s초, 해상도=%sx%s, fps=%s, steps=%s",
            payload.video_duration_seconds,
            payload.video_width,
            payload.video_height,
            payload.video_fps,
            payload.video_inference_steps,
        )
        if key_visual_path:
            logger.info("입력 이미지를 사용한 i2v 경로로 진행합니다: %s", key_visual_path)
            pipe = _get_wan_i2v_pipeline()
            source_image = _prepare_video_key_visual(
                key_visual_path,
                payload.video_width,
                payload.video_height,
            )
        else:
            logger.info("입력 이미지 없이 t2v 경로로 진행합니다.")
            pipe = _get_wan_t2v_pipeline()
            source_image = None
        prompt = str(copy_bundle["video_script"])
        negative_prompt = (
            "overexposed, static, blurry details, subtitle, low quality, jpeg artifacts, "
            "ugly, deformed hands, deformed face, fused fingers, crowded background"
        )
        target_fps = _pick_target_fps(payload)
        segment_paths: list[Path] = []
        segment_durations = _build_segment_durations(payload)
        total_segments = len(segment_durations)
        logger.info(
            "총 %s개 세그먼트로 나눠 생성합니다: %s (세그먼트 기준 %s초)",
            total_segments,
            segment_durations,
            _pick_segment_seconds(payload),
        )

        for index, segment_duration in enumerate(segment_durations, start=1):
            progress_start = int(((index - 1) / total_segments) * 100)
            progress_end = int((index / total_segments) * 100)
            logger.info(
                "영상 세그먼트 %s/%s 생성 시작 (%s%% -> %s%%), 길이=%s초",
                index,
                total_segments,
                progress_start,
                progress_end,
                segment_duration,
            )
            call_kwargs = {
                "prompt": (
                    f"{prompt}\n"
                    f"segment {index}/{total_segments}, maintain the same product and style, "
                    "vertical short-form ad, no subtitles burned into image."
                ),
                "negative_prompt": negative_prompt,
                "height": payload.video_height,
                "width": payload.video_width,
                "num_frames": segment_duration * target_fps + 1,
                "guidance_scale": 6.0,
                "num_inference_steps": payload.video_inference_steps,
            }
            if source_image is not None:
                call_kwargs["image"] = source_image

            logger.info(
                "영상 세그먼트 %s/%s Wan 호출 시작: 해상도=%sx%s, fps=%s, frames=%s, steps=%s",
                index,
                total_segments,
                payload.video_width,
                payload.video_height,
                target_fps,
                call_kwargs["num_frames"],
                payload.video_inference_steps,
            )
            output = pipe(**call_kwargs).frames[0]
            logger.info(
                "영상 세그먼트 %s/%s Wan 호출 반환: 프레임 수=%s",
                index,
                total_segments,
                len(output),
            )
            segment_path = output_path.with_name(f"{output_path.stem}_part_{index}.mp4")
            logger.info(
                "영상 세그먼트 %s/%s mp4 저장 시작: %s",
                index,
                total_segments,
                segment_path.name,
            )
            export_to_video(output, str(segment_path), fps=target_fps)
            logger.info(
                "영상 세그먼트 %s/%s mp4 저장 완료: %s",
                index,
                total_segments,
                segment_path.name,
            )
            segment_paths.append(segment_path)
            logger.info(
                "영상 세그먼트 %s/%s 생성 완료: %s",
                index,
                total_segments,
                segment_path.name,
            )

        final_path = _export_segment_videos(segment_paths, output_path)
        logger.info("Wan 영상 생성 완료: %s", final_path)
        return final_path
    except Exception as exc:
        logger.exception("Wan 영상 생성 중 오류가 발생했습니다.")
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
            badges=[payload.prompt],
            width=payload.video_width,
            height=payload.video_height,
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
    logger.info("프로젝트 %s 영상 생성을 시작합니다. 출력 경로=%s", project_id, output_path)

    generated_path = _try_generate_with_wan(output_path, payload, key_visual_path, copy_bundle)
    if generated_path is not None:
        logger.info("프로젝트 %s 영상 생성이 실제 모델 경로로 완료됐습니다.", project_id)
        return generated_path

    if require_real_generation():
        raise RuntimeError("실제 영상 모델 생성이 되지 않아 폴백 없이 중단합니다.")

    visual_source = _ensure_visual_source(root, payload, key_visual_path, copy_bundle)

    target_fps = _pick_target_fps(payload)
    logger.info("실제 모델 경로를 쓰지 못해 ffmpeg 기반 정적 영상 경로로 전환합니다.")
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
            (
                f"scale={payload.video_width}:{payload.video_height}:"
                "force_original_aspect_ratio=increase,"
                f"crop={payload.video_width}:{payload.video_height},"
                "zoompan="
                f"z='min(zoom+0.0007,1.08)':"
                f"d={payload.video_duration_seconds * target_fps}:"
                f"s={payload.video_width}x{payload.video_height}"
            ),
            "-r",
            str(target_fps),
            "-pix_fmt",
            "yuv420p",
            str(output_path),
        ],
    )
    logger.info("프로젝트 %s 정적 영상 생성이 완료됐습니다: %s", project_id, output_path)
    return str(output_path)
