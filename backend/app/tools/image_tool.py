"""이미지 생성 오케스트레이션 모듈"""

from __future__ import annotations

import inspect
from functools import lru_cache
import gc
import logging
from os import environ
from pathlib import Path

from diffusers.utils import load_image

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.runtime_support import (
    can_use_cuda_models,
    ensure_project_root,
    get_model_dir,
    is_model_downloaded,
)

logger = logging.getLogger(__name__)


def _pick_safe_generation_size(width: int, height: int) -> tuple[int, int]:
    """
    출력 비율을 유지하면서 Nunchaku가 처리하기 쉬운 내부 생성 해상도를 고른다.

    Args:
        width: 최종 요청 너비
        height: 최종 요청 높이

    Returns:
        내부 생성에 사용할 안전 해상도
    """

    max_side = 1024
    scale = min(max_side / max(width, 1), max_side / max(height, 1), 1.0)
    scaled_width = max(256, int(round(width * scale)))
    scaled_height = max(256, int(round(height * scale)))

    def snap(value: int) -> int:
        return max(256, int(round(value / 32)) * 32)

    safe_width = snap(scaled_width)
    safe_height = snap(scaled_height)
    return safe_width, safe_height


def _build_prompt(
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    variant_label: str,
) -> str:
    """
    이미지 생성용 프롬프트를 한 문장으로 정리한다.

    Args:
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        variant_label: 생성 종류 설명

    Returns:
        정리된 프롬프트 문자열
    """

    headline = str(copy_bundle.get("headline", payload.product_name))
    return (
        f"{variant_label}, {payload.product_name}, {payload.tone}, "
        f"{headline}, {payload.prompt}, polished commercial visual, "
        "clean product photography, ad-ready composition, "
        "balanced composition with clear room for product naming and copy, "
        "avoid broken characters, avoid garbled text, "
        "simple english product label is allowed, clean english words on packaging are acceptable"
    )


def release_image_pipelines() -> None:
    """
    캐시된 이미지 파이프라인을 해제하고 VRAM을 비운다.
    영상·음악 모델을 로드하기 전에 호출한다.
    """

    _get_nunchaku_text_pipeline.cache_clear()
    _get_nunchaku_img2img_pipeline.cache_clear()
    _flush_cuda_memory()


def _flush_cuda_memory() -> None:
    """
    파이프라인 전환 전에 가비지 컬렉션과 CUDA 캐시 정리를 시도한다.
    """

    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


def _find_nunchaku_checkpoint(model_dir: Path, precision: str) -> Path:
    """
    Nunchaku 양자화 Z-Image 체크포인트 파일을 찾는다.

    Args:
        model_dir: Nunchaku 모델 디렉토리
        precision: 현재 GPU에 맞는 양자화 정밀도

    Returns:
        사용할 safetensors 파일 경로
    """

    precision_order = [precision]
    if precision != "int4":
        precision_order.append("int4")
    if precision != "fp4":
        precision_order.append("fp4")

    for preferred_precision in precision_order:
        preferred_patterns = [
            f"svdq-{preferred_precision}_r32-z-image-turbo.safetensors",
            f"svdq-{preferred_precision}_r128-z-image-turbo.safetensors",
            f"svdq-{preferred_precision}_r256-z-image-turbo.safetensors",
        ]
        for pattern in preferred_patterns:
            candidate = model_dir / pattern
            if candidate.exists():
                return candidate

        pattern = f"svdq-{preferred_precision}_r*-z-image-turbo.safetensors"
        candidates = sorted(model_dir.glob(pattern))
        if candidates:
            return candidates[0]

    raise FileNotFoundError(
        f"Nunchaku Z-Image 체크포인트를 찾지 못했습니다: {model_dir}",
    )


def _get_zimage_base_source() -> str:
    """
    Nunchaku가 조립할 base Z-Image 소스를 반환한다.

    Returns:
        base Z-Image 모델 소스 문자열
    """

    return environ.get("Z_IMAGE_BASE_MODEL_SOURCE", "Tongyi-MAI/Z-Image-Turbo")


def _get_nunchaku_precision_override() -> str | None:
    """
    Nunchaku precision 강제값을 반환한다.

    Returns:
        precision 강제값 또는 None
    """

    value = environ.get("NUNCHAKU_PRECISION_OVERRIDE")
    if value in {"int4", "fp4"}:
        return value
    return None


def _patch_nunchaku_runtime() -> None:
    """
    현재 diffusers 버전과 nunchaku 런타임의 시그니처 차이를 실행 시점에 보정한다.
    """

    from nunchaku import NunchakuZImageTransformer2DModel
    from nunchaku.models.transformers import transformer_zimage as transformer_module

    if not getattr(NunchakuZImageTransformer2DModel, "_genfor_precision_patch_applied", False):
        original_from_pretrained = NunchakuZImageTransformer2DModel.from_pretrained.__func__

        @classmethod
        def patched_from_pretrained(cls, pretrained_model_name_or_path, **kwargs):
            precision_override = kwargs.get("precision")
            if precision_override is None:
                return original_from_pretrained(cls, pretrained_model_name_or_path, **kwargs)

            original_get_precision = transformer_module.get_precision

            def patched_get_precision(*args, **inner_kwargs):
                return original_get_precision(
                    precision_override,
                    pretrained_model_name_or_path=pretrained_model_name_or_path,
                )

            transformer_module.get_precision = patched_get_precision
            try:
                return original_from_pretrained(cls, pretrained_model_name_or_path, **kwargs)
            finally:
                transformer_module.get_precision = original_get_precision

        NunchakuZImageTransformer2DModel.from_pretrained = patched_from_pretrained
        NunchakuZImageTransformer2DModel._genfor_precision_patch_applied = True

    current_signature = inspect.signature(NunchakuZImageTransformer2DModel.forward)
    if "controlnet_block_samples" in current_signature.parameters:
        return

    def patched_forward(
        self,
        x,
        t,
        cap_feats,
        return_dict: bool = True,
        controlnet_block_samples=None,
        siglip_feats=None,
        image_noise_mask=None,
        patch_size=2,
        f_patch_size=1,
    ):
        rope_hook = transformer_module.NunchakuZImageRopeHook()
        self.register_rope_hook(rope_hook)
        try:
            return super(NunchakuZImageTransformer2DModel, self).forward(
                x,
                t,
                cap_feats,
                return_dict=return_dict,
                controlnet_block_samples=controlnet_block_samples,
                siglip_feats=siglip_feats,
                image_noise_mask=image_noise_mask,
                patch_size=patch_size,
                f_patch_size=f_patch_size,
            )
        finally:
            self.unregister_rope_hook()
            del rope_hook

    NunchakuZImageTransformer2DModel.forward = patched_forward
    NunchakuZImageTransformer2DModel._genfor_forward_patch_applied = True


def _prepare_text_pipeline_load() -> None:
    """
    text-to-image 로드 전에 img2img 캐시를 비운다.
    """

    _get_nunchaku_img2img_pipeline.cache_clear()
    _flush_cuda_memory()


def _prepare_img2img_pipeline_load() -> None:
    """
    img2img 로드 전에 text-to-image 캐시를 비운다.
    """

    _get_nunchaku_text_pipeline.cache_clear()
    _flush_cuda_memory()


@lru_cache(maxsize=1)
def _get_nunchaku_text_pipeline():
    """
    Nunchaku Z-Image 텍스트 생성 파이프라인을 로드한다.

    Returns:
        텍스트 생성 파이프라인
    """

    import torch
    from diffusers import ZImagePipeline
    from nunchaku import NunchakuZImageTransformer2DModel
    from nunchaku.utils import get_precision, is_turing

    _patch_nunchaku_runtime()
    model_dir = get_model_dir("nunchaku_z_image_turbo")
    precision = get_precision()
    dtype = torch.float16 if is_turing() else torch.bfloat16
    checkpoint_path = _find_nunchaku_checkpoint(model_dir, precision)
    precision_override = _get_nunchaku_precision_override()
    transformer_kwargs = {"torch_dtype": dtype}
    if precision_override is not None:
        transformer_kwargs["precision"] = precision_override
    transformer = NunchakuZImageTransformer2DModel.from_pretrained(
        str(checkpoint_path),
        **transformer_kwargs,
    )
    pipe = ZImagePipeline.from_pretrained(
        _get_zimage_base_source(),
        transformer=transformer,
        torch_dtype=dtype,
        low_cpu_mem_usage=False,
    )
    pipe.enable_sequential_cpu_offload()
    pipe.enable_attention_slicing()
    return pipe


@lru_cache(maxsize=1)
def _get_nunchaku_img2img_pipeline():
    """
    Nunchaku Z-Image 이미지 편집 파이프라인을 로드한다.

    Returns:
        이미지 편집 파이프라인
    """

    import torch
    from diffusers import ZImageImg2ImgPipeline
    from nunchaku import NunchakuZImageTransformer2DModel
    from nunchaku.utils import get_precision, is_turing

    _patch_nunchaku_runtime()
    model_dir = get_model_dir("nunchaku_z_image_turbo")
    precision = get_precision()
    dtype = torch.float16 if is_turing() else torch.bfloat16
    checkpoint_path = _find_nunchaku_checkpoint(model_dir, precision)
    precision_override = _get_nunchaku_precision_override()
    transformer_kwargs = {"torch_dtype": dtype}
    if precision_override is not None:
        transformer_kwargs["precision"] = precision_override
    transformer = NunchakuZImageTransformer2DModel.from_pretrained(
        str(checkpoint_path),
        **transformer_kwargs,
    )
    pipe = ZImageImg2ImgPipeline.from_pretrained(
        _get_zimage_base_source(),
        transformer=transformer,
        torch_dtype=dtype,
        low_cpu_mem_usage=False,
    )
    pipe.enable_sequential_cpu_offload()
    pipe.enable_attention_slicing()
    return pipe


def _get_first_existing_input_image(payload: ProjectCreateRequest) -> Path | None:
    """
    사용자가 올린 이미지 중 실제로 존재하는 첫 파일을 찾는다.

    Args:
        payload: 프로젝트 생성 요청 데이터

    Returns:
        존재하는 첫 이미지 경로 또는 None
    """

    for image_path in payload.image_paths:
        candidate = Path(image_path)
        if candidate.exists():
            return candidate
    return None


def _try_generate_with_nunchaku_zimage(
    output_path: Path,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    variant_label: str,
    width: int,
    height: int,
) -> str:
    """
    Nunchaku Z-Image 로컬 모델이 준비된 경우 실제 이미지를 생성한다.

    Args:
        output_path: 저장할 이미지 경로
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        variant_label: 생성 종류 설명
        width: 목표 너비
        height: 목표 높이

    Returns:
        저장 경로 문자열
    """

    if not can_use_cuda_models():
        raise RuntimeError("CUDA 기반 이미지 생성 환경을 사용할 수 없습니다.")
    if not is_model_downloaded("nunchaku_z_image_turbo"):
        raise RuntimeError("Nunchaku Z-Image 모델이 다운로드되지 않았습니다.")

    try:
        prompt = _build_prompt(payload, copy_bundle, variant_label=variant_label)
        input_image = _get_first_existing_input_image(payload)
        safe_width, safe_height = _pick_safe_generation_size(width, height)
        logger.info(
            "이미지 생성 시작: variant=%s, 해상도=%sx%s, 입력이미지=%s",
            variant_label,
            width,
            height,
            bool(input_image),
        )
        if input_image is not None:
            _prepare_img2img_pipeline_load()
            pipe = _get_nunchaku_img2img_pipeline()
            logger.info(
                "이미지 생성 img2img 호출 시작: %s, 내부해상도=%sx%s",
                variant_label,
                safe_width,
                safe_height,
            )
            result = pipe(
                prompt=prompt,
                image=load_image(str(input_image)).resize((safe_width, safe_height)),
                strength=0.72,
                num_inference_steps=9,
                guidance_scale=0.0,
            )
        else:
            _prepare_text_pipeline_load()
            pipe = _get_nunchaku_text_pipeline()
            logger.info(
                "이미지 생성 text-to-image 호출 시작: %s, 내부해상도=%sx%s",
                variant_label,
                safe_width,
                safe_height,
            )
            result = pipe(
                prompt=prompt,
                width=safe_width,
                height=safe_height,
                num_inference_steps=9,
                guidance_scale=0.0,
            )

        image = result.images[0].convert("RGB")
        image = image.resize((width, height))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path)
        logger.info("이미지 저장 완료: %s", output_path)
        return str(output_path)
    except Exception as exc:
        raise RuntimeError("Nunchaku Z-Image 이미지 생성에 실패했습니다.") from exc


def _generate_image(
    output_path: Path,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    variant_label: str,
    width: int,
    height: int,
) -> str:
    """
    실제 이미지 모델로 결과 이미지를 만든다.

    Args:
        output_path: 저장할 이미지 경로
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        variant_label: 생성 종류 설명
        width: 이미지 너비
        height: 이미지 높이

    Returns:
        저장된 이미지 경로 문자열
    """

    return _try_generate_with_nunchaku_zimage(
        output_path=output_path,
        payload=payload,
        copy_bundle=copy_bundle,
        variant_label=variant_label,
        width=width,
        height=height,
    )


def generate_banner_images(
    project_id: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
) -> list[str]:
    """
    배너 이미지 결과물 경로를 생성한다.

    Args:
        project_id: 프로젝트 식별자
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과

    Returns:
        배너 결과물 경로 목록
    """

    root = ensure_project_root(project_id)
    return [
        _generate_image(
            root / f"banner_{index}.png",
            payload,
            copy_bundle,
            variant_label=f"배너 시안 {index}",
            width=payload.banner_width,
            height=payload.banner_height,
        )
        for index in range(1, 4)
    ]


def generate_detail_images(
    project_id: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    width: int | None = None,
    height: int | None = None,
) -> list[str]:
    """
    상세 페이지 대표 이미지 결과물 경로를 생성한다.

    Args:
        project_id: 프로젝트 식별자
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과

    Returns:
        상세 이미지 결과물 경로 목록
    """

    root = ensure_project_root(project_id)
    target_width = width or payload.detail_width
    target_height = height or payload.detail_height
    return [
        _generate_image(
            root / f"detail_{index}.png",
            payload,
            copy_bundle,
            variant_label=f"상세 대표 이미지 {index}",
            width=target_width,
            height=target_height,
        )
        for index in range(1, 3)
    ]


def generate_logo_drafts(project_id: str, payload: ProjectCreateRequest) -> list[str]:
    """
    로고 초안 결과물 경로를 생성한다.

    Args:
        project_id: 프로젝트 식별자
        payload: 프로젝트 생성 요청 데이터

    Returns:
        로고 초안 경로 목록
    """

    root = ensure_project_root(project_id)
    copy_bundle = {"headline": payload.product_name}
    return [
        _generate_image(
            root / f"logo_{index}.png",
            payload,
            copy_bundle,
            variant_label=f"로고 초안 {index}",
            width=1024,
            height=1024,
        )
        for index in range(1, 3)
    ]
