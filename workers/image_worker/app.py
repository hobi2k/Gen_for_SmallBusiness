from __future__ import annotations

import os
import io
import base64
from hashlib import sha256
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Literal, Optional

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field


APP_ROOT = Path(__file__).resolve().parents[2]
REFERENCES_ROOT = APP_ROOT / "references"
STORAGE_ROOT = APP_ROOT / "storage"
GENERATED_ROOT = STORAGE_ROOT / "generated"
MODEL_CACHE_ROOT = APP_ROOT / ".cache" / "huggingface"

os.environ.setdefault("HF_HOME", str(MODEL_CACHE_ROOT))
os.environ.setdefault("HF_HUB_CACHE", str(MODEL_CACHE_ROOT / "hub"))
os.environ.setdefault("TRANSFORMERS_CACHE", str(MODEL_CACHE_ROOT / "transformers"))

IMAGE_WORKER_TOKEN = os.getenv("IMAGE_WORKER_TOKEN", "").strip()
IMAGE_WORKER_PROFILE = os.getenv("IMAGE_WORKER_PROFILE", "full").strip().lower() or "full"

PROFILE_DEFAULTS = {
    "full": {
        "base_model": "stabilityai/stable-diffusion-xl-base-1.0",
        "controlnet_model": "diffusers/controlnet-canny-sdxl-1.0",
        "ip_adapter_repo": "h94/IP-Adapter",
        "ip_adapter_weight": "ip-adapter_sdxl.bin",
        "pipeline_kind": "sdxl",
        "default_device": "cuda",
        "default_steps": 28,
        "default_guidance": 5.8,
        "default_control_scale": 0.62,
        "default_ip_scale": 0.72,
        "engine": "sdxl-controlnet-ipadapter-worker",
        "target_sizes": {
            "1:1": (1024, 1024),
            "4:5": (1024, 1280),
            "9:16": (896, 1592),
        },
    },
    "lite-mps": {
        "base_model": "stable-diffusion-v1-5/stable-diffusion-v1-5",
        "controlnet_model": "lllyasviel/control_v11p_sd15_canny",
        "ip_adapter_repo": "h94/IP-Adapter",
        "ip_adapter_weight": "ip-adapter_sd15.bin",
        "pipeline_kind": "sd15",
        "default_device": "mps",
        "default_steps": 14,
        "default_guidance": 4.5,
        "default_control_scale": 0.55,
        "default_ip_scale": 0.62,
        "engine": "sd15-controlnet-ipadapter-mps-worker",
        "target_sizes": {
            "1:1": (640, 640),
            "4:5": (640, 800),
            "9:16": (576, 1024),
        },
    },
}

CPU_FALLBACK_TARGET_SIZES = {
    "1:1": (320, 320),
    "4:5": (320, 400),
    "9:16": (320, 568),
}


def _profile_key() -> str:
    return IMAGE_WORKER_PROFILE if IMAGE_WORKER_PROFILE in PROFILE_DEFAULTS else "full"


def _env_or_default(name: str, default: str) -> str:
    value = os.getenv(name, "").strip()
    return value or default


def _resolve_runtime_config() -> dict[str, Any]:
    profile = PROFILE_DEFAULTS[_profile_key()]
    return {
        "profile": _profile_key(),
        "base_model": _env_or_default("IMAGE_MODEL_BASE", profile["base_model"]),
        "controlnet_model": _env_or_default("IMAGE_MODEL_CONTROLNET", profile["controlnet_model"]),
        "ip_adapter_repo": _env_or_default("IMAGE_MODEL_IP_ADAPTER_REPO", profile["ip_adapter_repo"]),
        "ip_adapter_weight": _env_or_default("IMAGE_MODEL_IP_ADAPTER_WEIGHT", profile["ip_adapter_weight"]),
        "pipeline_kind": profile["pipeline_kind"],
        "device": _env_or_default("IMAGE_WORKER_DEVICE", profile["default_device"]),
        "steps": int(_env_or_default("IMAGE_NUM_INFERENCE_STEPS", str(profile["default_steps"]))),
        "guidance_scale": float(
            _env_or_default("IMAGE_GUIDANCE_SCALE", str(profile["default_guidance"]))
        ),
        "control_scale": float(
            _env_or_default("IMAGE_CONTROLNET_SCALE", str(profile["default_control_scale"]))
        ),
        "ip_scale": float(_env_or_default("IMAGE_IP_ADAPTER_SCALE", str(profile["default_ip_scale"]))),
        "engine": profile["engine"],
        "target_sizes": profile["target_sizes"],
    }


RUNTIME_CONFIG = _resolve_runtime_config()
EFFECTIVE_DEVICE = str(RUNTIME_CONFIG["device"])
DEVICE_FALLBACK_REASON: Optional[str] = None

if str(RUNTIME_CONFIG["device"]) == "mps":
    os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")


def _resolve_effective_device() -> str:
    global DEVICE_FALLBACK_REASON
    requested_device = str(RUNTIME_CONFIG["device"])

    if requested_device != "mps":
      return requested_device

    try:
        import torch
    except Exception:
        DEVICE_FALLBACK_REASON = "torch_import_failed"
        return "cpu"

    mps_backend = getattr(torch.backends, "mps", None)
    is_built = bool(mps_backend and getattr(mps_backend, "is_built", lambda: False)())
    is_available = bool(mps_backend and getattr(mps_backend, "is_available", lambda: False)())

    if is_built and is_available:
        return "mps"

    DEVICE_FALLBACK_REASON = "mps_unavailable"
    return "cpu"


EFFECTIVE_DEVICE = _resolve_effective_device()
IP_ADAPTER_ENABLED = EFFECTIVE_DEVICE != "cpu"


_PIPELINE = None
_PIPELINE_LOCK = Lock()
_INFERENCE_LOCK = Lock()
_PIPELINE_LOAD_ERROR: Optional[str] = None
_LAST_RUNTIME_ERROR: Optional[str] = None

app = FastAPI(title="Lifestyle Shop Image Worker", version="0.2.0")


class ProductPayload(BaseModel):
    category: str
    category_label: str
    visual_summary: str
    source_image_source: Literal["storage", "references"]
    source_image_relative_path: str
    source_image_data_url: Optional[str] = None


class PromptVariantPayload(BaseModel):
    aspect_ratio: Literal["1:1", "4:5", "9:16"]
    prompt: str


class StyleReferencePayload(BaseModel):
    relative_path: str
    data_url: Optional[str] = None


class GenerateRequest(BaseModel):
    upload_token: str
    style_id: str
    regenerate_count: int = 0
    product: ProductPayload
    prompts: Dict[str, Any]
    style_references: List[StyleReferencePayload] = Field(default_factory=list)


class GeneratedImagePayload(BaseModel):
    relative_path: str
    aspect_ratio: Literal["1:1", "4:5", "9:16"]
    seed: int


class GenerateResponse(BaseModel):
    engine: str
    representative_images: List[GeneratedImagePayload]
    lifestyle_images: List[GeneratedImagePayload]


def _require_auth(authorization: Optional[str]) -> None:
    if not IMAGE_WORKER_TOKEN:
        return

    expected = f"Bearer {IMAGE_WORKER_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="invalid_worker_token")


def _resolve_relative_path(source: Literal["storage", "references"], relative_path: str) -> Path:
    relative = relative_path.lstrip("/").replace("\\", "/")
    root = STORAGE_ROOT if source == "storage" else REFERENCES_ROOT
    absolute = (root / relative).resolve()

    if root not in absolute.parents and absolute != root:
        raise HTTPException(status_code=400, detail="invalid_image_path")

    if not absolute.exists():
        raise HTTPException(status_code=404, detail="source_image_not_found")

    return absolute


def _infer_asset_mime_type(file_name: str) -> str:
    suffix = Path(file_name).suffix.lower()

    if suffix in {".jpg", ".jpeg"}:
        return "image/jpeg"
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"

    return "application/octet-stream"


def _read_image_from_data_url(data_url: str):
    try:
        from PIL import Image
    except Exception as error:  # pragma: no cover - runtime path
        raise HTTPException(status_code=503, detail=f"python_deps_missing: {error}") from error

    if not data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="invalid_image_data_url")

    try:
        _, encoded = data_url.split(",", 1)
    except ValueError as error:
        raise HTTPException(status_code=400, detail="malformed_image_data_url") from error

    try:
        buffer = base64.b64decode(encoded)
    except Exception as error:
        raise HTTPException(status_code=400, detail="invalid_image_data_base64") from error

    return Image.open(io.BytesIO(buffer)).convert("RGB")


def _load_payload_image(
    *,
    data_url: Optional[str],
    source: Literal["storage", "references"],
    relative_path: str,
):
    if data_url:
        return _read_image_from_data_url(data_url)

    path = _resolve_relative_path(source, relative_path)

    try:
        from PIL import Image
    except Exception as error:  # pragma: no cover - runtime path
        raise HTTPException(status_code=503, detail=f"python_deps_missing: {error}") from error

    return Image.open(path).convert("RGB")


def _target_size(aspect_ratio: Literal["1:1", "4:5", "9:16"]) -> tuple[int, int]:
    target_sizes = (
        CPU_FALLBACK_TARGET_SIZES if EFFECTIVE_DEVICE == "cpu" else RUNTIME_CONFIG["target_sizes"]
    )
    return target_sizes[aspect_ratio]


def _make_canny_condition(image, size: tuple[int, int]):
    import cv2
    import numpy as np
    from PIL import Image, ImageOps

    fitted = ImageOps.fit(image.convert("RGB"), size, method=Image.Resampling.LANCZOS)
    array = np.array(fitted)
    edges = cv2.Canny(array, 100, 200)
    edges = edges[:, :, None]
    edges = np.concatenate([edges, edges, edges], axis=2)
    return Image.fromarray(edges)


def _torch_dtype(torch_module, device: str):
    if device in {"cuda", "mps"}:
        return torch_module.float16
    return torch_module.float32


def _effective_steps() -> int:
    configured_steps = int(RUNTIME_CONFIG["steps"])
    return min(configured_steps, 4) if EFFECTIVE_DEVICE == "cpu" else configured_steps


def _effective_guidance_scale() -> float:
    configured_scale = float(RUNTIME_CONFIG["guidance_scale"])
    return min(configured_scale, 4.0) if EFFECTIVE_DEVICE == "cpu" else configured_scale


def _engine_name() -> str:
    if EFFECTIVE_DEVICE == "cpu":
        return "sd15-controlnet-cpu-lite-worker"

    return str(RUNTIME_CONFIG["engine"])


def _load_pipeline():
    global _PIPELINE
    global _PIPELINE_LOAD_ERROR

    if _PIPELINE is not None:
        return _PIPELINE

    with _PIPELINE_LOCK:
        if _PIPELINE is not None:
            return _PIPELINE

        try:
            import torch
            from diffusers import (
                ControlNetModel,
                StableDiffusionControlNetPipeline,
                StableDiffusionXLControlNetPipeline,
            )

            device = EFFECTIVE_DEVICE
            pipeline_kind = str(RUNTIME_CONFIG["pipeline_kind"])
            torch_dtype = _torch_dtype(torch, device)

            controlnet = ControlNetModel.from_pretrained(
                str(RUNTIME_CONFIG["controlnet_model"]),
                torch_dtype=torch_dtype,
            )

            pipeline_kwargs: dict[str, Any] = {
                "controlnet": controlnet,
                "torch_dtype": torch_dtype,
            }

            if pipeline_kind == "sdxl":
                pipeline_cls = StableDiffusionXLControlNetPipeline
                pipeline_kwargs["use_safetensors"] = True
                ip_adapter_subfolder = "sdxl_models"
            else:
                pipeline_cls = StableDiffusionControlNetPipeline
                ip_adapter_subfolder = "models"

            pipeline = pipeline_cls.from_pretrained(
                str(RUNTIME_CONFIG["base_model"]),
                **pipeline_kwargs,
            )

            if IP_ADAPTER_ENABLED:
                pipeline.load_ip_adapter(
                    str(RUNTIME_CONFIG["ip_adapter_repo"]),
                    subfolder=ip_adapter_subfolder,
                    weight_name=str(RUNTIME_CONFIG["ip_adapter_weight"]),
                )
                pipeline.set_ip_adapter_scale(float(RUNTIME_CONFIG["ip_scale"]))

            if hasattr(pipeline, "enable_vae_slicing"):
                pipeline.enable_vae_slicing()

            if device == "cuda":
                pipeline = pipeline.to("cuda")
            elif device == "mps":
                pipeline = pipeline.to("mps")
            else:
                pipeline = pipeline.to("cpu")

            _PIPELINE = pipeline
            _PIPELINE_LOAD_ERROR = None
            return pipeline
        except Exception as error:  # pragma: no cover - runtime path
            _PIPELINE_LOAD_ERROR = str(error)
            raise HTTPException(status_code=503, detail=f"pipeline_init_failed: {_PIPELINE_LOAD_ERROR}") from error


def _reset_scheduler(pipeline) -> None:
    scheduler = getattr(pipeline, "scheduler", None)
    if scheduler is None or not hasattr(scheduler, "config") or not hasattr(scheduler, "from_config"):
        return

    pipeline.scheduler = scheduler.from_config(scheduler.config)


def _deterministic_seed(*parts: object) -> int:
    raw = ":".join(str(part) for part in parts).encode("utf-8")
    return int(sha256(raw).hexdigest()[:8], 16)


def _build_generator(torch_module, seed: int):
    generator_device = "cuda" if EFFECTIVE_DEVICE == "cuda" else "cpu"
    return torch_module.Generator(device=generator_device).manual_seed(seed)


def _clear_device_cache(torch_module) -> None:
    device = EFFECTIVE_DEVICE

    if device == "cuda" and torch_module.cuda.is_available():
        torch_module.cuda.empty_cache()
        return

    if device == "mps" and hasattr(torch_module, "mps") and hasattr(torch_module.mps, "empty_cache"):
        torch_module.mps.empty_cache()


@app.get("/health")
def health():
    return {
        "ok": _PIPELINE_LOAD_ERROR is None and _LAST_RUNTIME_ERROR is None,
        "loaded": _PIPELINE is not None,
        "profile": RUNTIME_CONFIG["profile"],
        "requested_device": RUNTIME_CONFIG["device"],
        "effective_device": EFFECTIVE_DEVICE,
        "pipeline_kind": RUNTIME_CONFIG["pipeline_kind"],
        "engine": _engine_name(),
        "base_model": RUNTIME_CONFIG["base_model"],
        "controlnet_model": RUNTIME_CONFIG["controlnet_model"],
        "ip_adapter_repo": RUNTIME_CONFIG["ip_adapter_repo"],
        "ip_adapter_weight": RUNTIME_CONFIG["ip_adapter_weight"],
        "steps": RUNTIME_CONFIG["steps"],
        "guidance_scale": RUNTIME_CONFIG["guidance_scale"],
        "control_scale": RUNTIME_CONFIG["control_scale"],
        "ip_scale": RUNTIME_CONFIG["ip_scale"],
        "ip_adapter_enabled": IP_ADAPTER_ENABLED,
        "device_fallback_reason": DEVICE_FALLBACK_REASON,
        "last_error": _LAST_RUNTIME_ERROR or _PIPELINE_LOAD_ERROR,
    }


@app.get("/asset")
def asset(path: str, authorization: Optional[str] = Header(default=None)):
    _require_auth(authorization)

    absolute_path = _resolve_relative_path("storage", path)

    return FileResponse(
        absolute_path,
        media_type=_infer_asset_mime_type(absolute_path.name),
        headers={"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"},
    )


@app.post("/generate", response_model=GenerateResponse)
def generate(payload: GenerateRequest, authorization: Optional[str] = Header(default=None)):
    global _LAST_RUNTIME_ERROR

    _require_auth(authorization)

    try:
        import torch
        from PIL import Image, ImageOps
    except Exception as error:  # pragma: no cover - runtime path
        raise HTTPException(status_code=503, detail=f"python_deps_missing: {error}") from error

    pipeline = _load_pipeline()

    product_image = _load_payload_image(
        data_url=payload.product.source_image_data_url,
        source=payload.product.source_image_source,
        relative_path=payload.product.source_image_relative_path,
    )

    style_reference_images = []
    for reference in payload.style_references:
        style_reference_images.append(
            _load_payload_image(
                data_url=reference.data_url,
                source="references",
                relative_path=reference.relative_path,
            )
        )

    if not style_reference_images:
        raise HTTPException(status_code=400, detail="style_reference_missing")

    output_directory = GENERATED_ROOT / payload.upload_token / payload.style_id
    output_directory.mkdir(parents=True, exist_ok=True)

    negative_prompt = str(payload.prompts.get("negative_prompt", ""))
    representative_prompts = [
        PromptVariantPayload.model_validate(item) for item in payload.prompts.get("representative", [])
    ]
    lifestyle_prompts = [
        PromptVariantPayload.model_validate(item) for item in payload.prompts.get("lifestyle", [])
    ]

    if EFFECTIVE_DEVICE == "cpu":
        representative_prompts = representative_prompts[:1]
        lifestyle_prompts = lifestyle_prompts[:1]

    def run_variant(kind: Literal["representative", "lifestyle"], index: int, prompt_variant: PromptVariantPayload):
        width, height = _target_size(prompt_variant.aspect_ratio)
        control_image = _make_canny_condition(product_image, (width, height))
        style_image = ImageOps.fit(
            style_reference_images[(index + payload.regenerate_count) % len(style_reference_images)],
            (width, height),
            method=Image.Resampling.LANCZOS,
        )
        seed = _deterministic_seed(
            payload.upload_token,
            payload.style_id,
            kind,
            index,
            payload.regenerate_count,
            RUNTIME_CONFIG["profile"],
        ) % (2**31)
        generator = _build_generator(torch, seed)

        try:
            with _INFERENCE_LOCK:
                _reset_scheduler(pipeline)
                result = pipeline(
                    prompt=prompt_variant.prompt,
                    negative_prompt=negative_prompt,
                    image=control_image,
                    controlnet_conditioning_scale=float(RUNTIME_CONFIG["control_scale"]),
                    guidance_scale=_effective_guidance_scale(),
                    num_inference_steps=_effective_steps(),
                    width=width,
                    height=height,
                    generator=generator,
                    **({"ip_adapter_image": style_image} if IP_ADAPTER_ENABLED else {}),
                ).images[0]
        except Exception as error:  # pragma: no cover - runtime path
            _LAST_RUNTIME_ERROR = str(error)
            _clear_device_cache(torch)
            raise HTTPException(status_code=503, detail=f"generation_failed: {error}") from error

        file_name = f"{kind}_{index + 1}_{prompt_variant.aspect_ratio.replace(':', 'x')}_{seed}.png"
        absolute_output_path = output_directory / file_name
        result.save(absolute_output_path)
        _clear_device_cache(torch)
        _LAST_RUNTIME_ERROR = None

        return GeneratedImagePayload(
            relative_path=str(absolute_output_path.relative_to(STORAGE_ROOT)).replace("\\", "/"),
            aspect_ratio=prompt_variant.aspect_ratio,
            seed=seed,
        )

    representative_images = [
        run_variant("representative", index, prompt_variant)
        for index, prompt_variant in enumerate(representative_prompts)
    ]
    lifestyle_images = [
        run_variant("lifestyle", index, prompt_variant)
        for index, prompt_variant in enumerate(lifestyle_prompts)
    ]

    return GenerateResponse(
        engine=_engine_name(),
        representative_images=representative_images,
        lifestyle_images=lifestyle_images,
    )
