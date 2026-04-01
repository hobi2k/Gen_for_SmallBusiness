"""이미지 생성 도구 모듈"""

from __future__ import annotations

import inspect
from functools import lru_cache
from os import environ
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.runtime_support import (
    can_use_cuda_models,
    ensure_project_root,
    get_model_dir,
    is_model_downloaded,
    render_marketing_card,
    require_real_generation,
)


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

    keywords = ", ".join(payload.keywords[:5]) if payload.keywords else payload.category
    selling_points = (
        ", ".join(payload.selling_points[:3]) if payload.selling_points else payload.summary
    )
    headline = str(copy_bundle.get("headline", payload.product_name))
    return (
        f"{variant_label}, {payload.product_name}, {payload.category}, {payload.tone}, "
        f"{headline}, {selling_points}, {keywords}, polished commercial visual"
    )


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


def release_image_pipelines() -> None:
    """
    캐시된 이미지 파이프라인을 해제하고 VRAM을 비운다.
    영상·음악 모델을 로드하기 전에 호출한다.
    """

    import gc

    _get_nunchaku_text_pipeline.cache_clear()
    _get_nunchaku_img2img_pipeline.cache_clear()
    gc.collect()
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass


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
) -> str | None:
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
        성공 시 저장 경로, 실패 시 None
    """

    if not can_use_cuda_models():
        return None
    if not is_model_downloaded("nunchaku_z_image_turbo"):
        return None

    try:
        from diffusers.utils import load_image

        prompt = _build_prompt(payload, copy_bundle, variant_label=variant_label)
        input_image = _get_first_existing_input_image(payload)

        if input_image is not None:
            img2img_pipe = _get_nunchaku_img2img_pipeline()
            result = img2img_pipe(
                prompt=prompt,
                image=load_image(str(input_image)).resize((width, height)),
                strength=0.45,
                num_inference_steps=8,
                guidance_scale=0.0,
            )
        else:
            text_pipe = _get_nunchaku_text_pipeline()
            result = text_pipe(
                prompt=prompt,
                width=width,
                height=height,
                num_inference_steps=8,
                guidance_scale=0.0,
            )

        image = result.images[0]
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path)
        return str(output_path)
    except Exception as exc:
        if require_real_generation():
            raise RuntimeError("Nunchaku Z-Image 이미지 생성에 실패했습니다.") from exc
        return None


def _generate_fallback_image(
    output_path: Path,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    variant_label: str,
    width: int,
    height: int,
) -> str:
    """
    로컬 대형 모델이 없을 때도 바로 쓸 수 있는 폴백 광고 이미지를 만든다.

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

    input_image = _get_first_existing_input_image(payload)
    if input_image is not None:
        base = Image.open(input_image).convert("RGB")
        base = ImageOps.contain(base, (width, height))
        canvas = Image.new("RGB", (width, height), (250, 245, 239))
        offset_x = (width - base.width) // 2
        offset_y = (height - base.height) // 2
        canvas.paste(base, (offset_x, offset_y))
        canvas = ImageEnhance.Color(canvas).enhance(1.08)
        canvas = ImageEnhance.Sharpness(canvas).enhance(1.12)
        overlay_path = Path(
            render_marketing_card(
                output_path=output_path.with_name(f"{output_path.stem}_overlay.png"),
                title=payload.product_name,
                subtitle=f"{variant_label} | {payload.summary}",
                badges=payload.selling_points[:2] + payload.keywords[:2],
                width=width,
                height=height,
                tone=payload.tone,
            ),
        )
        overlay = Image.open(overlay_path).convert("RGBA")
        composed = Image.blend(canvas.convert("RGBA"), overlay, 0.26).convert("RGB")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        composed.save(output_path)
        overlay_path.unlink(missing_ok=True)
        return str(output_path)

    badges = payload.selling_points[:2] + payload.keywords[:2]
    if not badges:
        badges = [payload.summary, payload.category]

    return render_marketing_card(
        output_path=output_path,
        title=payload.product_name,
        subtitle=f"{variant_label} | {payload.summary}",
        badges=badges,
        width=width,
        height=height,
        tone=payload.tone,
    )


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
    실제 모델 생성과 폴백 생성 중 가능한 경로를 골라 이미지를 만든다.

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

    generated_path = _try_generate_with_nunchaku_zimage(
        output_path=output_path,
        payload=payload,
        copy_bundle=copy_bundle,
        variant_label=variant_label,
        width=width,
        height=height,
    )
    if generated_path is not None:
        return generated_path

    if require_real_generation():
        raise RuntimeError("실제 이미지 모델 생성이 되지 않아 폴백 없이 중단합니다.")

    return _generate_fallback_image(
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
            width=1280,
            height=720,
        )
        for index in range(1, 4)
    ]


def generate_detail_images(
    project_id: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
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
    return [
        _generate_image(
            root / f"detail_{index}.png",
            payload,
            copy_bundle,
            variant_label=f"상세 대표 이미지 {index}",
            width=1280,
            height=960,
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
