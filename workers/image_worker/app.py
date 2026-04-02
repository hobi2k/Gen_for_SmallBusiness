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
_CUTOUT_SESSION = None
_CUTOUT_SESSION_LOCK = Lock()

app = FastAPI(title="Lifestyle Shop Image Worker", version="0.2.0")


class ProductPayload(BaseModel):
    category: str
    category_label: str
    visual_summary: str
    material_notes: str
    color_hints: List[str] = Field(default_factory=list)
    material_hints: List[str] = Field(default_factory=list)
    surface_tone: str = "none"
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


def _make_blank_condition(size: tuple[int, int]):
    from PIL import Image

    return Image.new("RGB", size, (0, 0, 0))


def _make_style_only_reference(image, size: tuple[int, int]):
    from PIL import Image, ImageEnhance, ImageFilter

    source = image.convert("RGB")
    width, height = source.size
    tile_width = max(96, size[0] // 2)
    tile_height = max(96, size[1] // 2)
    patch_width = max(96, int(width * 0.42))
    patch_height = max(96, int(height * 0.42))

    crop_boxes = [
        (0, 0),
        (max(0, width - patch_width), 0),
        (0, max(0, height - patch_height)),
        (max(0, width - patch_width), max(0, height - patch_height)),
    ]

    card = Image.new("RGB", size, (236, 231, 223))

    for index, (left, top) in enumerate(crop_boxes):
        crop = source.crop((left, top, left + patch_width, top + patch_height))
        patch = crop.resize((tile_width, tile_height), Image.Resampling.LANCZOS)
        patch = patch.filter(ImageFilter.GaussianBlur(radius=max(12, int(min(size) * 0.016))))
        patch = patch.resize(
            (max(56, tile_width // 7), max(56, tile_height // 7)),
            Image.Resampling.BICUBIC,
        ).resize((tile_width, tile_height), Image.Resampling.BICUBIC)
        patch = ImageEnhance.Color(patch).enhance(1.05)
        patch = ImageEnhance.Contrast(patch).enhance(0.94)
        x = 0 if index % 2 == 0 else size[0] - tile_width
        y = 0 if index < 2 else size[1] - tile_height
        card.paste(patch, (x, y))

    card = card.filter(ImageFilter.GaussianBlur(radius=max(10, int(min(size) * 0.012))))
    card = ImageEnhance.Color(card).enhance(1.03)
    card = ImageEnhance.Contrast(card).enhance(0.97)
    return card


def _load_cutout_session():
    global _CUTOUT_SESSION

    if _CUTOUT_SESSION is not None:
        return _CUTOUT_SESSION

    with _CUTOUT_SESSION_LOCK:
        if _CUTOUT_SESSION is not None:
            return _CUTOUT_SESSION

        from rembg import new_session

        _CUTOUT_SESSION = new_session("u2net")
        return _CUTOUT_SESSION


def _extract_product_cutout_heuristic(image):
    import cv2
    import numpy as np
    from PIL import Image

    rgb = image.convert("RGB")
    array = np.array(rgb)
    max_channel = array.max(axis=2)
    min_channel = array.min(axis=2)
    mean_channel = array.mean(axis=2)

    # Treat bright, low-variance pixels connected to the image border as background.
    background_candidate = (
        ((mean_channel >= 242) & ((max_channel - min_channel) <= 18))
        | ((array[:, :, 0] >= 248) & (array[:, :, 1] >= 248) & (array[:, :, 2] >= 248))
    ).astype("uint8")

    _, labels = cv2.connectedComponents(background_candidate)
    border_labels = np.unique(
        np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
    )
    border_labels = border_labels[border_labels != 0]

    if border_labels.size == 0:
        foreground = background_candidate == 0
    else:
        background_mask = np.isin(labels, border_labels)
        foreground = ~background_mask

    # Remove bright enclosed "holes" like the white area inside a glass handle.
    enclosed_background_candidate = (
        ((mean_channel >= 238) & ((max_channel - min_channel) <= 24))
        | ((array[:, :, 0] >= 242) & (array[:, :, 1] >= 242) & (array[:, :, 2] >= 242))
    )
    enclosed_labels_count, enclosed_labels = cv2.connectedComponents(
        enclosed_background_candidate.astype("uint8")
    )
    if enclosed_labels_count > 1:
        total_area = float(array.shape[0] * array.shape[1])
        for label in range(1, enclosed_labels_count):
            component = enclosed_labels == label
            if not component.any():
                continue
            ys, xs = np.where(component)
            touches_border = (
                xs.min() == 0
                or ys.min() == 0
                or xs.max() == array.shape[1] - 1
                or ys.max() == array.shape[0] - 1
            )
            if touches_border:
                continue

            area_ratio = component.sum() / max(total_area, 1.0)
            if area_ratio > 0.08:
                continue

            foreground[component] = False

    alpha = (foreground.astype("uint8") * 255)
    alpha = cv2.GaussianBlur(alpha, (0, 0), sigmaX=1.4, sigmaY=1.4)

    ys, xs = np.where(alpha > 10)
    if xs.size == 0 or ys.size == 0:
        return rgb.convert("RGBA")

    pad = max(6, int(max(rgb.size) * 0.02))
    left = max(int(xs.min()) - pad, 0)
    top = max(int(ys.min()) - pad, 0)
    right = min(int(xs.max()) + pad + 1, rgb.size[0])
    bottom = min(int(ys.max()) + pad + 1, rgb.size[1])

    rgba = np.dstack([array, alpha])
    return Image.fromarray(rgba, mode="RGBA").crop((left, top, right, bottom))


def _extract_product_cutout_with_rembg(image):
    import io

    from PIL import Image
    from rembg import remove

    buffer = io.BytesIO()
    image.convert("RGBA").save(buffer, format="PNG")
    session = _load_cutout_session()
    removed = remove(buffer.getvalue(), session=session)
    cutout = Image.open(io.BytesIO(removed)).convert("RGBA")
    return _alpha_crop(cutout)


def _extract_product_cutout(image):
    try:
        cutout = _extract_product_cutout_with_rembg(image)
        alpha = cutout.getchannel("A")
        if alpha.getbbox() is not None:
            return cutout
    except Exception:
        pass

    return _extract_product_cutout_heuristic(image)


def _product_descriptor_text(product: ProductPayload) -> str:
    return " ".join(
        [
            product.category or "",
            product.category_label or "",
            product.visual_summary or "",
            product.material_notes or "",
            " ".join(product.color_hints or []),
            " ".join(product.material_hints or []),
            product.surface_tone or "",
        ]
    ).lower()


def _placement_profile(product: ProductPayload) -> Literal["flat", "upright", "linear", "generic"]:
    descriptor = _product_descriptor_text(product)

    if any(
        term in descriptor
        for term in ["tray", "쟁반", "트레이", "plate", "접시", "bowl", "볼", "platter"]
    ):
        return "flat"

    if any(
        term in descriptor
        for term in ["cutlery", "fork", "knife", "spoon", "커트러리", "수저", "포크", "나이프"]
    ):
        return "linear"

    if any(
        term in descriptor
        for term in ["cup", "glass", "glassware", "mug", "컵", "유리잔", "머그"]
    ):
        return "upright"

    return "generic"


def _dynamic_placement_width_ratio(
    kind: Literal["representative", "lifestyle"],
    product: ProductPayload,
    cutout_size: tuple[int, int],
) -> float:
    width, height = cutout_size
    aspect_ratio = width / max(height, 1)
    descriptor = _product_descriptor_text(product)
    profile = _placement_profile(product)

    ratio = 0.27 if kind == "representative" else 0.22

    if aspect_ratio >= 1.75:
        ratio += 0.08
    elif aspect_ratio >= 1.35:
        ratio += 0.05
    elif aspect_ratio >= 1.1:
        ratio += 0.03
    elif aspect_ratio <= 0.62:
        ratio -= 0.05
    elif aspect_ratio <= 0.82:
        ratio -= 0.02

    if any(term in descriptor for term in ["tray", "쟁반", "트레이", "plate", "접시", "rect", "square", "사각", "넓", "wide"]):
        ratio += 0.01

    if any(term in descriptor for term in ["glassware", "glass", "유리잔", "tall", "긴", "높"]):
        ratio -= 0.03

    if any(term in descriptor for term in ["cutlery", "fork", "knife", "spoon", "커트러리", "수저"]):
        ratio += 0.02

    if profile == "flat":
        ratio -= 0.01 if kind == "representative" else 0.0
    elif profile == "upright":
        ratio -= 0.02 if kind == "lifestyle" else 0.0
    elif profile == "linear":
        ratio += 0.03

    return max(0.2, min(0.54, ratio))


def _analyze_scene_context(scene_image, focus_box: tuple[int, int, int, int]) -> dict[str, float]:
    import cv2
    import numpy as np

    crop = scene_image.crop(focus_box).convert("RGB")
    array = np.array(crop)

    if array.size == 0:
        return {
            "brightness": 0.58,
            "warmth": 0.0,
            "light_x": 0.0,
            "light_y": -0.25,
            "angle": 0.0,
        }

    rgb_mean = array.mean(axis=(0, 1))
    brightness = float(rgb_mean.mean() / 255.0)
    warmth = float((rgb_mean[0] - rgb_mean[2]) / 255.0)

    left_brightness = float(array[:, : max(1, array.shape[1] // 2), :].mean() / 255.0)
    right_brightness = float(array[:, array.shape[1] // 2 :, :].mean() / 255.0)
    top_brightness = float(array[: max(1, array.shape[0] // 2), :, :].mean() / 255.0)
    bottom_brightness = float(array[array.shape[0] // 2 :, :, :].mean() / 255.0)

    gray = cv2.cvtColor(array, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 70, 180)
    min_line = max(40, int(min(gray.shape[:2]) * 0.18))
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=28,
        minLineLength=min_line,
        maxLineGap=18,
    )

    weighted_angles: list[tuple[float, float]] = []
    if lines is not None:
        for line in lines[:, 0]:
            x1, y1, x2, y2 = line
            angle = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
            if abs(angle) <= 18:
                length = float(np.hypot(x2 - x1, y2 - y1))
                weighted_angles.append((angle, length))

    if weighted_angles:
        total_weight = sum(weight for _, weight in weighted_angles)
        dominant_angle = sum(angle * weight for angle, weight in weighted_angles) / max(total_weight, 1e-6)
    else:
        dominant_angle = 0.0

    return {
        "brightness": brightness,
        "warmth": warmth,
        "light_x": right_brightness - left_brightness,
        "light_y": top_brightness - bottom_brightness,
        "angle": dominant_angle,
    }


def _find_table_anchor(
    scene_image,
    *,
    kind: Literal["representative", "lifestyle"],
    product: ProductPayload,
) -> dict[str, float]:
    import cv2
    import numpy as np

    rgb = scene_image.convert("RGB")
    array = np.array(rgb)
    height, width = array.shape[:2]
    profile = _placement_profile(product)

    search_top = int(
        height
        * (
            0.58
            if profile == "flat"
            else 0.54
            if kind == "representative"
            else 0.6
        )
    )
    region = array[search_top:, :, :]
    if region.size == 0:
        return {
            "x": width / 2,
            "y": height * (0.82 if profile == "flat" else 0.8 if kind == "representative" else 0.84),
            "confidence": 0.0,
        }

    gray = cv2.cvtColor(region, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 60, 150)
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=36,
        minLineLength=max(100, int(width * 0.18)),
        maxLineGap=22,
    )

    candidates: list[tuple[float, float, float]] = []
    if lines is not None:
        for line in lines[:, 0]:
            x1, y1, x2, y2 = line
            angle = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
            if abs(angle) > 12:
                continue

            line_y = search_top + (y1 + y2) / 2
            line_x = (x1 + x2) / 2
            length = float(np.hypot(x2 - x1, y2 - y1))
            center_bias = 1 - abs((line_x / max(width, 1)) - 0.5)
            lower_bias = min(1.0, max(0.0, (line_y / max(height, 1) - 0.56) / 0.32))
            score = length * (0.35 + center_bias * 0.25 + lower_bias * 0.4)
            candidates.append((score, line_x, line_y))

    if not candidates:
        return {
            "x": width / 2,
            "y": height * (0.82 if profile == "flat" else 0.8 if kind == "representative" else 0.84),
            "confidence": 0.0,
        }

    candidates.sort(key=lambda item: item[0], reverse=True)
    _, line_x, line_y = candidates[0]
    return {
        "x": line_x,
        "y": line_y,
        "confidence": 1.0,
    }


def _dedupe_surface_candidates(candidates: list[dict[str, float]]) -> list[dict[str, float]]:
    deduped: list[dict[str, float]] = []

    for candidate in candidates:
        duplicate = False
        for existing in deduped:
            y_gap = abs(candidate["y"] - existing["y"])
            left = max(candidate["left"], existing["left"])
            right = min(candidate["right"], existing["right"])
            overlap = max(0.0, right - left)
            min_width = max(1.0, min(candidate["width"], existing["width"]))
            if y_gap <= 26 and overlap / min_width >= 0.58:
                duplicate = True
                break

        if not duplicate:
            deduped.append(candidate)

    return deduped


def _find_tabletop_candidates(
    scene_image,
    *,
    kind: Literal["representative", "lifestyle"],
    product: ProductPayload,
) -> list[dict[str, float]]:
    import cv2
    import numpy as np

    rgb = scene_image.convert("RGB")
    array = np.array(rgb)
    height, width = array.shape[:2]
    profile = _placement_profile(product)

    search_top = int(
        height
        * (
            0.56
            if profile == "flat"
            else 0.52
            if kind == "representative"
            else 0.58
        )
    )
    region = array[search_top:, :, :]
    if region.size == 0:
        return []

    gray = cv2.cvtColor(region, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 55, 145)
    lines = cv2.HoughLinesP(
        edges,
        1,
        np.pi / 180,
        threshold=34,
        minLineLength=max(120, int(width * 0.16)),
        maxLineGap=28,
    )

    candidates: list[dict[str, float]] = []
    if lines is not None:
        for line in lines[:, 0]:
            x1, y1, x2, y2 = line
            angle = float(np.degrees(np.arctan2(y2 - y1, x2 - x1)))
            if abs(angle) > 14:
                continue

            left = float(min(x1, x2))
            right = float(max(x1, x2))
            line_width = right - left
            if line_width < width * 0.14:
                continue

            line_y = float(search_top + (y1 + y2) / 2)
            center_x = float((left + right) / 2)
            center_bias = 1 - abs(center_x / max(width, 1) - 0.5)
            lower_bias = min(1.0, max(0.0, (line_y / max(height, 1) - 0.52) / 0.32))
            width_bias = min(1.0, line_width / max(width * 0.42, 1))
            score = line_width * (0.34 + center_bias * 0.18 + lower_bias * 0.28 + width_bias * 0.2)

            padding_x = max(18, int(width * 0.03))
            placement_height = max(120, int(height * (0.2 if profile == "flat" else 0.17)))
            candidate = {
                "left": max(0.0, left - padding_x),
                "right": min(float(width), right + padding_x),
                "top": max(0.0, line_y - placement_height),
                "bottom": min(float(height), line_y + max(18, int(height * 0.03))),
                "x": center_x,
                "y": line_y,
                "width": min(float(width), right + padding_x) - max(0.0, left - padding_x),
                "height": placement_height + max(18, int(height * 0.03)),
                "line_width": line_width,
                "angle": angle,
                "score": score,
            }
            candidates.append(candidate)

    candidates.sort(key=lambda item: item["score"], reverse=True)
    return _dedupe_surface_candidates(candidates)[:8]


def _target_surface_width_factor(
    *,
    profile: Literal["flat", "upright", "linear", "generic"],
    kind: Literal["representative", "lifestyle"],
) -> float:
    if profile == "flat":
        return 0.4 if kind == "representative" else 0.34
    if profile == "upright":
        return 0.18 if kind == "representative" else 0.14
    if profile == "linear":
        return 0.44 if kind == "representative" else 0.36
    return 0.24 if kind == "representative" else 0.18


def _score_empty_surface(
    *,
    edge_map,
    luminance_map,
    rect: tuple[int, int, int, int],
) -> float:
    import numpy as np

    x0, y0, x1, y1 = rect
    x0 = max(0, x0)
    y0 = max(0, y0)
    x1 = min(edge_map.shape[1], x1)
    y1 = min(edge_map.shape[0], y1)

    if x1 - x0 < 24 or y1 - y0 < 24:
        return -1.0

    edge_region = edge_map[y0:y1, x0:x1]
    luminance_region = luminance_map[y0:y1, x0:x1]
    if edge_region.size == 0 or luminance_region.size == 0:
        return -1.0

    edge_density = float((edge_region > 0).mean())
    luminance_std = float(np.std(luminance_region) / 255.0)
    flatness = 1.0 - min(1.0, edge_density * 2.2 + luminance_std * 0.95)
    return flatness


def _fallback_placement_region(
    *,
    scene_image,
    kind: Literal["representative", "lifestyle"],
    product: ProductPayload,
    target_width: int,
    target_height: int,
) -> dict[str, float]:
    scene_width, scene_height = scene_image.size
    anchor = _find_table_anchor(scene_image, kind=kind, product=product)
    profile = _placement_profile(product)
    center_x = int(anchor["x"]) if anchor["confidence"] > 0 else scene_width // 2
    bottom_y = (
        int(anchor["y"])
        if anchor["confidence"] > 0
        else int(scene_height * (0.84 if profile == "flat" else 0.8 if kind == "representative" else 0.84))
    )
    return {
        "center_x": float(center_x),
        "bottom_y": float(bottom_y),
        "target_width": float(target_width),
        "target_height": float(target_height),
        "angle": 0.0,
        "confidence": float(anchor["confidence"]),
        "surface_left": 0.0,
        "surface_right": float(scene_width),
        "surface_top": max(0.0, float(bottom_y - target_height - 40)),
        "surface_bottom": min(float(scene_height), float(bottom_y + 24)),
    }


def _select_placement_region(
    *,
    scene_image,
    candidates: list[dict[str, float]],
    kind: Literal["representative", "lifestyle"],
    product: ProductPayload,
    cutout_size: tuple[int, int],
    base_target_width: int,
) -> dict[str, float]:
    import cv2
    import numpy as np

    scene_width, scene_height = scene_image.size
    if not candidates:
        cutout_width, cutout_height = cutout_size
        base_height = max(120, int(base_target_width * (cutout_height / max(cutout_width, 1))))
        return _fallback_placement_region(
            scene_image=scene_image,
            kind=kind,
            product=product,
            target_width=base_target_width,
            target_height=base_height,
        )

    profile = _placement_profile(product)
    surface_factor = _target_surface_width_factor(profile=profile, kind=kind)
    cutout_width, cutout_height = cutout_size
    cutout_aspect = cutout_height / max(cutout_width, 1)

    rgb = scene_image.convert("RGB")
    array = np.array(rgb)
    luminance = cv2.cvtColor(array, cv2.COLOR_RGB2GRAY)
    edge_map = cv2.Canny(cv2.GaussianBlur(luminance, (5, 5), 0), 55, 145)

    best_region: Optional[dict[str, float]] = None
    best_score = -10.0
    max_candidate_score = max(candidate["score"] for candidate in candidates)

    for candidate in candidates:
        candidate_width = int(candidate["right"] - candidate["left"])
        surface_target_width = max(120, int(candidate_width * surface_factor))
        lower_bias = min(1.0, max(0.0, (candidate["y"] / max(scene_height, 1) - 0.54) / 0.3))
        depth_scale = 0.74 + lower_bias * 0.24
        target_width = min(
            int(candidate_width * 0.72),
            int(max(base_target_width, surface_target_width) * depth_scale),
        )
        target_height = max(110, int(target_width * cutout_aspect))
        free_height = int(candidate["y"] - candidate["top"])
        if free_height > 0 and target_height > int(free_height * 0.86):
            shrink = int(free_height * 0.86)
            target_height = max(90, shrink)
            target_width = max(110, int(target_height / max(cutout_aspect, 1e-6)))

        contact_lift = max(1, int(target_height * (0.012 if profile == "flat" else 0.02)))
        start_x = int(candidate["left"] + target_width / 2)
        end_x = int(candidate["right"] - target_width / 2)
        if end_x < start_x:
            continue

        step = max(12, int(target_width * 0.18))
        for center_x in range(start_x, end_x + 1, step):
            product_x = center_x - target_width // 2
            product_y = int(candidate["y"] - target_height - contact_lift)
            scan_rect = (
                product_x - int(target_width * 0.08),
                product_y - int(target_height * 0.06),
                product_x + int(target_width * 1.08),
                product_y + int(target_height * 1.02),
            )
            empty_score = _score_empty_surface(
                edge_map=edge_map,
                luminance_map=luminance,
                rect=scan_rect,
            )
            if empty_score < 0:
                continue

            center_bias = 1 - abs((center_x / max(scene_width, 1)) - 0.5)
            candidate_strength = candidate["score"] / max(max_candidate_score, 1e-6)
            width_bias = min(1.0, candidate_width / max(scene_width * 0.42, 1))
            score = (
                empty_score * 0.42
                + candidate_strength * 0.26
                + lower_bias * 0.14
                + center_bias * 0.1
                + width_bias * 0.08
            )

            if profile == "upright":
                score += 0.05 * center_bias
            elif profile == "flat":
                score += 0.04 * width_bias

            if score > best_score:
                best_score = score
                best_region = {
                    "center_x": float(center_x),
                    "bottom_y": float(candidate["y"]),
                    "target_width": float(target_width),
                    "target_height": float(target_height),
                    "angle": float(candidate["angle"]),
                    "confidence": float(score),
                    "surface_left": float(candidate["left"]),
                    "surface_right": float(candidate["right"]),
                    "surface_top": float(candidate["top"]),
                    "surface_bottom": float(candidate["bottom"]),
                }

    if best_region is not None:
        return best_region

    base_height = max(120, int(base_target_width * cutout_aspect))
    return _fallback_placement_region(
        scene_image=scene_image,
        kind=kind,
        product=product,
        target_width=base_target_width,
        target_height=base_height,
    )


def _alpha_crop(image):
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    return image.crop(bbox) if bbox else image


def _apply_scene_geometry(
    cutout,
    *,
    kind: Literal["representative", "lifestyle"],
    angle: float,
    product: ProductPayload,
):
    from PIL import Image

    adjusted = cutout
    profile = _placement_profile(product)

    if kind == "lifestyle" and profile != "flat":
        shear_limit = 0.04 if profile == "upright" else 0.08
        shear = max(-shear_limit, min(shear_limit, angle / 180))
        width, height = adjusted.size
        output_width = int(width + abs(shear) * height)
        offset = max(0, int(-shear * height)) if shear < 0 else 0
        adjusted = adjusted.transform(
            (max(output_width, width), height),
            Image.Transform.AFFINE,
            (1, shear, offset, 0, 1, 0),
            resample=Image.Resampling.BICUBIC,
            fillcolor=(0, 0, 0, 0),
        )
        adjusted = _alpha_crop(adjusted)

    rotation_limit = 1.2 if profile == "flat" else 2.4 if profile == "upright" else 4.0
    rotation_factor = 0.08 if profile == "flat" else 0.14 if profile == "upright" else 0.22
    rotation = max(-rotation_limit, min(rotation_limit, angle * (rotation_factor if kind == "lifestyle" else 0.1)))
    if abs(rotation) >= 0.2:
        adjusted = adjusted.rotate(
            rotation,
            resample=Image.Resampling.BICUBIC,
            expand=True,
            fillcolor=(0, 0, 0, 0),
        )
        adjusted = _alpha_crop(adjusted)

    return adjusted


def _apply_scene_lighting(cutout, context: dict[str, float]):
    from PIL import Image, ImageChops, ImageEnhance

    rgba = cutout.convert("RGBA")
    alpha = rgba.getchannel("A")
    rgb = rgba.convert("RGB")

    brightness_factor = max(0.88, min(1.16, 0.9 + context["brightness"] * 0.34))
    contrast_factor = max(0.94, min(1.08, 0.96 + abs(context["light_x"]) * 0.22))
    saturation_factor = max(0.92, min(1.06, 0.98 + context["warmth"] * 0.06))

    rgb = ImageEnhance.Brightness(rgb).enhance(brightness_factor)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast_factor)
    rgb = ImageEnhance.Color(rgb).enhance(saturation_factor)

    warmth = context["warmth"]
    if abs(warmth) > 0.015:
        tint = (236, 181, 118) if warmth > 0 else (174, 196, 224)
        tint_strength = min(0.12, abs(warmth) * 0.45)
        rgb = Image.blend(rgb, Image.new("RGB", rgb.size, tint), tint_strength)

    lit = rgb.convert("RGBA")
    lit.putalpha(alpha)

    wrap_layer = Image.new("RGBA", lit.size, (0, 0, 0, 0))
    wrap_alpha = Image.new("L", lit.size, 0)
    wrap_pixels = wrap_alpha.load()
    width, height = lit.size
    light_x = context["light_x"]
    light_y = context["light_y"]
    from_left = light_x <= 0
    top_lit = light_y >= 0
    for x in range(width):
        horizontal = 1 - (x / max(width - 1, 1) if from_left else (width - 1 - x) / max(width - 1, 1))
        for y in range(height):
            vertical = 1 - (y / max(height - 1, 1) if top_lit else (height - 1 - y) / max(height - 1, 1))
            intensity = max(0.0, min(1.0, horizontal * 0.7 + vertical * 0.3))
            wrap_pixels[x, y] = int(intensity * 38)

    wrap_color = (255, 236, 214, 255) if warmth >= 0 else (225, 236, 248, 255)
    wrap_layer.paste(wrap_color, mask=ImageChops.multiply(alpha, wrap_alpha))
    return Image.alpha_composite(lit, wrap_layer)


def _refine_composited_roi(
    *,
    scene,
    original_scene,
    product_layer,
    product_x: int,
    product_y: int,
    context: dict[str, float],
):
    import cv2
    import numpy as np
    from PIL import Image, ImageChops, ImageFilter

    scene_rgba = scene.convert("RGBA")
    original_rgba = original_scene.convert("RGBA")
    alpha = product_layer.getchannel("A")
    if alpha.getbbox() is None:
        return scene_rgba

    pad_x = max(24, int(product_layer.size[0] * 0.2))
    pad_y = max(24, int(product_layer.size[1] * 0.18))
    roi_box = (
        max(0, product_x - pad_x),
        max(0, product_y - pad_y),
        min(scene_rgba.size[0], product_x + product_layer.size[0] + pad_x),
        min(scene_rgba.size[1], product_y + product_layer.size[1] + pad_y),
    )

    if roi_box[2] - roi_box[0] < 32 or roi_box[3] - roi_box[1] < 32:
        return scene_rgba

    product_roi = Image.new("RGBA", (roi_box[2] - roi_box[0], roi_box[3] - roi_box[1]), (0, 0, 0, 0))
    product_roi.alpha_composite(product_layer, (product_x - roi_box[0], product_y - roi_box[1]))
    product_alpha = product_roi.getchannel("A")
    if product_alpha.getbbox() is None:
        return scene_rgba

    base_roi = original_rgba.crop(roi_box).convert("RGBA")
    product_rgb = np.array(product_roi.convert("RGB")).astype(np.float32)
    background_rgb = np.array(base_roi.convert("RGB")).astype(np.float32)
    alpha_array = np.array(product_alpha).astype(np.float32) / 255.0

    blurred_alpha = product_alpha.filter(ImageFilter.GaussianBlur(radius=max(4, int(product_layer.size[0] * 0.012))))
    edge_mask_image = ImageChops.subtract(blurred_alpha, product_alpha)
    edge_mask = np.array(edge_mask_image).astype(np.float32) / 255.0

    alpha_mask = alpha_array > 0.04
    edge_mask_bool = edge_mask > 0.02
    if not alpha_mask.any():
        return scene_rgba

    edge_background = background_rgb[edge_mask_bool] if edge_mask_bool.any() else background_rgb[alpha_mask]
    edge_product = product_rgb[edge_mask_bool] if edge_mask_bool.any() else product_rgb[alpha_mask]
    bg_mean = edge_background.mean(axis=0)
    product_mean = edge_product.mean(axis=0)
    mean_shift = (bg_mean - product_mean) * 0.18

    product_rgb[alpha_mask] = np.clip(product_rgb[alpha_mask] + mean_shift, 0, 255)
    if edge_mask_bool.any():
        product_rgb[edge_mask_bool] = np.clip(product_rgb[edge_mask_bool] * 0.76 + bg_mean * 0.24, 0, 255)

    sharpness = cv2.Laplacian(cv2.cvtColor(background_rgb.astype(np.uint8), cv2.COLOR_RGB2GRAY), cv2.CV_32F).var()
    harmonized = Image.fromarray(product_rgb.astype(np.uint8), mode="RGB").convert("RGBA")
    harmonized.putalpha(product_alpha)
    if sharpness < 28:
        harmonized = harmonized.filter(ImageFilter.GaussianBlur(radius=0.8))
        harmonized.putalpha(product_alpha)

    noise_strength = max(0.03, min(0.08, (0.72 - context["brightness"]) * 0.08 + 0.04))
    noise = np.random.normal(0.0, 10.0, product_rgb.shape).astype(np.float32)
    noisy_rgb = np.array(harmonized.convert("RGB")).astype(np.float32)
    noisy_rgb[alpha_mask] = np.clip(noisy_rgb[alpha_mask] + noise[alpha_mask] * noise_strength, 0, 255)
    harmonized = Image.fromarray(noisy_rgb.astype(np.uint8), mode="RGB").convert("RGBA")
    harmonized.putalpha(product_alpha)

    refined_scene = scene_rgba.copy()
    refined_scene.paste(
        Image.new("RGBA", harmonized.size, (0, 0, 0, 0)),
        box=(product_x, product_y),
        mask=product_alpha,
    )
    refined_scene.alpha_composite(harmonized, (product_x, product_y))
    return refined_scene


def _compose_identity_locked_image(
    *,
    scene_image,
    product_image,
    kind: Literal["representative", "lifestyle"],
    product: ProductPayload,
):
    from PIL import Image, ImageChops, ImageDraw, ImageFilter

    scene = scene_image.convert("RGBA")
    original_scene = scene.copy()
    cutout = _extract_product_cutout(product_image)

    scene_width, scene_height = scene.size
    cutout_width, cutout_height = cutout.size
    width_ratio = _dynamic_placement_width_ratio(kind, product, cutout.size)
    target_width = max(160, int(scene_width * width_ratio))
    candidates = _find_tabletop_candidates(scene, kind=kind, product=product)
    placement = _select_placement_region(
        scene_image=scene,
        candidates=candidates,
        kind=kind,
        product=product,
        cutout_size=cutout.size,
        base_target_width=target_width,
    )
    target_width = int(placement["target_width"])
    target_height = int(placement["target_height"])

    max_height = int(scene_height * (0.42 if kind == "representative" else 0.34))
    if target_height > max_height:
        scale = max_height / max(target_height, 1)
        target_width = int(target_width * scale)
        target_height = max_height

    center_x = int(placement["center_x"])
    profile = _placement_profile(product)
    bottom_y = int(placement["bottom_y"])
    bottom_y = max(int(scene_height * 0.64), min(int(scene_height * 0.92), bottom_y))
    rough_x = center_x - target_width // 2
    rough_y = bottom_y - target_height

    context_box = (
        max(int(placement["surface_left"]) - int(target_width * 0.2), 0),
        max(int(placement["surface_top"]) - int(target_height * 0.08), 0),
        min(int(placement["surface_right"]) + int(target_width * 0.2), scene_width),
        min(int(placement["surface_bottom"]) + int(target_height * 0.08), scene_height),
    )
    scene_context = _analyze_scene_context(scene, context_box)
    adjusted_cutout = _apply_scene_geometry(
        cutout,
        kind=kind,
        angle=(scene_context["angle"] * 0.45) + (placement["angle"] * 0.55),
        product=product,
    )
    resized_cutout = adjusted_cutout.resize((target_width, target_height), Image.Resampling.LANCZOS)
    resized_cutout = _apply_scene_lighting(resized_cutout, scene_context)

    target_width, target_height = resized_cutout.size
    product_x = center_x - target_width // 2
    if profile == "flat":
        center_x = int(scene_width * 0.5 if placement["confidence"] <= 0 else center_x)
        product_x = center_x - target_width // 2

    contact_lift = max(1, int(target_height * (0.012 if profile == "flat" else 0.02)))
    product_y = bottom_y - target_height - contact_lift
    left_bound = max(4, int(placement["surface_left"]))
    right_bound = min(scene_width - 4, int(placement["surface_right"]))
    if target_width > max(80, right_bound - left_bound):
        shrink_scale = max(0.58, (right_bound - left_bound) / max(target_width, 1))
        target_width = max(96, int(target_width * shrink_scale))
        target_height = max(84, int(target_height * shrink_scale))
        resized_cutout = resized_cutout.resize((target_width, target_height), Image.Resampling.LANCZOS)
        resized_cutout = _apply_scene_lighting(resized_cutout, scene_context)

    target_width, target_height = resized_cutout.size
    product_x = center_x - target_width // 2
    if product_x < left_bound:
        product_x = left_bound
    if product_x + target_width > right_bound:
        product_x = max(left_bound, right_bound - target_width)

    product_y = max(8, min(scene_height - target_height - 8, product_y))

    duplicate_cleanup_layer = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    duplicate_cleanup_mask = Image.new("L", scene.size, 0)
    cleanup_alpha = resized_cutout.getchannel("A")
    cleanup_alpha = cleanup_alpha.filter(ImageFilter.GaussianBlur(radius=max(10, int(target_width * 0.03))))
    cleanup_alpha = cleanup_alpha.point(lambda p: 255 if p > 18 else 0)
    cleanup_alpha = cleanup_alpha.filter(ImageFilter.MaxFilter(size=17))
    cleanup_alpha = cleanup_alpha.filter(ImageFilter.GaussianBlur(radius=max(18, int(target_width * 0.06))))
    duplicate_cleanup_mask.paste(cleanup_alpha, (product_x, product_y))

    scene_rgb = scene.convert("RGB")
    blurred_scene = scene_rgb.filter(ImageFilter.GaussianBlur(radius=max(16, int(target_width * 0.06)))).convert("RGBA")
    duplicate_cleanup_layer.paste(blurred_scene, (0, 0), duplicate_cleanup_mask)
    scene = Image.alpha_composite(scene, duplicate_cleanup_layer)

    shadow_layer = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    alpha = resized_cutout.getchannel("A")
    shadow_color = (
        int(max(18, min(78, 44 + scene_context["warmth"] * 64))),
        int(max(14, min(64, 34 + scene_context["warmth"] * 38))),
        int(max(12, min(58, 26 + scene_context["warmth"] * 22))),
        255,
    )
    shadow_shape = Image.new("RGBA", resized_cutout.size, shadow_color)
    shadow_shape.putalpha(alpha)
    shadow_shape = shadow_shape.resize(
        (target_width, max(20, int(target_height * 0.26))),
        Image.Resampling.BICUBIC,
    )
    shadow_shape = shadow_shape.filter(
        ImageFilter.GaussianBlur(radius=max(10, int(target_width * 0.05)))
    )
    shadow_opacity = int(max(72, min(132, 84 + (0.62 - scene_context["brightness"]) * 120)))
    shadow_alpha = shadow_shape.getchannel("A").point(lambda p: min(255, int(p * shadow_opacity / 255)))
    shadow_shape.putalpha(shadow_alpha)

    shadow_dx = int(max(-target_width * 0.08, min(target_width * 0.08, -scene_context["light_x"] * target_width * 0.22)))
    shadow_dy = int(max(8, target_height * (0.03 + max(0.0, 0.08 - scene_context["light_y"] * 0.04))))
    shadow_x = product_x + int(target_width * 0.02) + shadow_dx
    shadow_y = product_y + target_height - int(shadow_shape.size[1] * 0.45) + shadow_dy
    shadow_layer.alpha_composite(shadow_shape, (shadow_x, shadow_y))

    occlusion_layer = Image.new("RGBA", scene.size, (0, 0, 0, 0))
    occlusion_draw = ImageDraw.Draw(occlusion_layer)
    occlusion_box = (
        product_x + int(target_width * 0.18),
        product_y + int(target_height * 0.83),
        product_x + int(target_width * 0.82),
        product_y + int(target_height * 0.96),
    )
    occlusion_draw.ellipse(occlusion_box, fill=(38, 26, 20, 92))
    occlusion_layer = occlusion_layer.filter(
        ImageFilter.GaussianBlur(radius=max(8, int(target_width * 0.035)))
    )

    scene = Image.alpha_composite(scene, shadow_layer)
    scene = Image.alpha_composite(scene, occlusion_layer)

    edge_soften = Image.new("L", resized_cutout.size, 0)
    edge_soften_draw = ImageDraw.Draw(edge_soften)
    edge_soften_draw.rounded_rectangle(
        (0, 0, resized_cutout.size[0], resized_cutout.size[1]),
        radius=max(12, int(min(resized_cutout.size) * 0.08)),
        fill=255,
    )
    feathered_alpha = ImageChops.multiply(resized_cutout.getchannel("A"), edge_soften.filter(ImageFilter.GaussianBlur(2)))
    softened = resized_cutout.copy()
    softened.putalpha(feathered_alpha)
    scene.alpha_composite(softened, (product_x, product_y))

    scene = _refine_composited_roi(
        scene=scene,
        original_scene=original_scene,
        product_layer=softened,
        product_x=product_x,
        product_y=product_y,
        context=scene_context,
    )

    return scene.convert("RGB")


def _product_negative_terms(product: ProductPayload) -> str:
    category_token = (product.category or "product").replace("glassware", "glass")
    category_label = product.category_label if product.category_label != "None" else "product"
    color_terms = [term for term in product.color_hints if term and term != "unknown"]
    material_terms = [term for term in product.material_hints if term and term != "none"]
    summary = (product.visual_summary or "").strip().lower()
    material_notes = (product.material_notes or "").strip().lower()

    terms = [
        "duplicate product",
        "second product",
        "extra object matching foreground product",
        f"second {category_token}",
        f"extra {category_token}",
        f"duplicate foreground {category_token}",
        f"same {category_token} as foreground",
        f"same {category_label}",
    ]

    if color_terms:
        terms.extend(f"{color} {category_token}" for color in color_terms[:2])

    if material_terms:
        terms.extend(f"{material} {category_token}" for material in material_terms[:2])

    if product.surface_tone and product.surface_tone != "none":
        terms.append(f"{product.surface_tone} toned {category_token}")

    if summary and summary != "none":
        terms.append(f"foreground summary: {summary}")

    if material_notes and material_notes != "none":
        terms.append(f"foreground material note: {material_notes}")

    deduped_terms: list[str] = []
    seen = set()
    for term in terms:
        normalized = term.strip().lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        deduped_terms.append(term)

    return ", ".join(deduped_terms)


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


def _effective_ip_adapter_scale() -> float:
    configured_scale = float(RUNTIME_CONFIG["ip_scale"])
    style_only_scale = configured_scale * 0.62
    return min(style_only_scale, 0.42) if EFFECTIVE_DEVICE == "cpu" else min(style_only_scale, 0.48)


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
                pipeline.set_ip_adapter_scale(_effective_ip_adapter_scale())

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
        control_image = _make_blank_condition((width, height))
        style_image = _make_style_only_reference(
            style_reference_images[(index + payload.regenerate_count) % len(style_reference_images)],
            (width, height),
        )
        background_only_prompt = ", ".join(
            [
                prompt_variant.prompt,
                "background scene only",
                "theme interior only",
                "leave the placement area empty",
                "do not render the product",
                "do not render any item matching the foreground product",
                "no hero object on the placement area",
                "no duplicate item",
            ]
        )
        background_negative_prompt = ", ".join(
            part
            for part in [negative_prompt, _product_negative_terms(payload.product)]
            if part
        )
        prompt_signature = _deterministic_seed(
            prompt_variant.prompt,
            background_negative_prompt,
            prompt_variant.aspect_ratio,
        )
        control_scale = 0.0
        seed = _deterministic_seed(
            payload.upload_token,
            payload.style_id,
            kind,
            index,
            payload.regenerate_count,
            RUNTIME_CONFIG["profile"],
            prompt_signature,
        ) % (2**31)
        generator = _build_generator(torch, seed)
        try:
            with _INFERENCE_LOCK:
                _reset_scheduler(pipeline)
                result = pipeline(
                    prompt=background_only_prompt,
                    negative_prompt=background_negative_prompt,
                    image=control_image,
                    controlnet_conditioning_scale=control_scale,
                    guidance_scale=_effective_guidance_scale(),
                    num_inference_steps=_effective_steps(),
                    width=width,
                    height=height,
                    generator=generator,
                    **({"ip_adapter_image": style_image} if IP_ADAPTER_ENABLED else {}),
                ).images[0]
                result = _compose_identity_locked_image(
                    scene_image=result,
                    product_image=product_image,
                    kind=kind,
                    product=payload.product,
                )
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
