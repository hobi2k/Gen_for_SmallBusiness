"""생성 도구에서 공통으로 쓰는 런타임 보조 함수 모음"""

from __future__ import annotations

import json
import shutil
import subprocess
from functools import lru_cache
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from backend.app.core.config import get_settings

settings = get_settings()
PROJECT_ROOT = Path(__file__).resolve().parents[3]
MANIFEST_PATH = PROJECT_ROOT / "models" / "model_manifest.json"


@lru_cache(maxsize=1)
def load_model_manifest() -> dict[str, Any]:
    """
    모델 매니페스트 파일을 읽어 캐시한다.

    Returns:
        모델 매니페스트 딕셔너리
    """

    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def get_model_dir(model_name: str) -> Path:
    """
    매니페스트에 등록된 모델 이름으로 실제 로컬 디렉토리를 찾는다.

    Args:
        model_name: 매니페스트에 적힌 모델 이름

    Returns:
        모델 디렉토리 경로
    """

    manifest = load_model_manifest()
    for model in manifest["models"]:
        if model["name"] == model_name:
            return PROJECT_ROOT / model["target_dir"]
    raise KeyError(f"등록되지 않은 모델 이름입니다: {model_name}")


def get_model_repo_id(model_name: str) -> str:
    """
    매니페스트에 등록된 모델 이름으로 repo_id를 찾는다.

    Args:
        model_name: 매니페스트에 적힌 모델 이름

    Returns:
        모델 repo_id 문자열
    """

    manifest = load_model_manifest()
    for model in manifest["models"]:
        if model["name"] == model_name:
            return str(model["repo_id"])
    raise KeyError(f"등록되지 않은 모델 이름입니다: {model_name}")


def is_model_downloaded(model_name: str) -> bool:
    """
    모델 디렉토리가 실제 다운로드된 상태인지 간단히 확인한다.

    Args:
        model_name: 확인할 모델 이름

    Returns:
        다운로드 여부
    """

    model_dir = get_model_dir(model_name)
    if not model_dir.exists():
        return False

    # 디렉토리만 비어 있으면 create-only 초기화일 수 있으므로 파일 존재 여부까지 본다.
    return any(model_dir.iterdir())


def can_use_cuda_models() -> bool:
    """
    현재 환경에서 CUDA 기반 대형 모델을 실제로 구동할 수 있는지 확인한다.

    Returns:
        CUDA 기반 모델 사용 가능 여부
    """

    if not settings.use_local_ai_models:
        return False

    try:
        import torch
    except Exception:
        return False

    return bool(torch.cuda.is_available())


def require_real_generation() -> bool:
    """
    실제 로컬 모델 생성만 허용할지 여부를 반환한다.

    Returns:
        실제 로컬 모델 생성 강제 여부
    """

    return settings.use_local_ai_models


def ensure_project_root(project_id: str) -> Path:
    """
    프로젝트별 저장 루트를 만들고 반환한다.

    Args:
        project_id: 프로젝트 식별자

    Returns:
        프로젝트 저장 루트 경로
    """

    root = get_project_root(project_id)
    root.mkdir(parents=True, exist_ok=True)
    return root


def get_project_root(project_id: str) -> Path:
    """
    프로젝트 저장 루트 경로만 계산해 반환한다.

    Args:
        project_id: 프로젝트 식별자

    Returns:
        프로젝트 저장 루트 경로
    """

    return Path(settings.storage_root) / project_id


def save_uploaded_files(project_id: str, uploads: list[tuple[str, bytes]]) -> list[str]:
    """
    업로드된 파일 바이트를 프로젝트 전용 업로드 디렉토리에 저장한다.

    Args:
        project_id: 프로젝트 식별자
        uploads: 파일 이름과 바이트 목록

    Returns:
        저장된 파일 경로 문자열 목록
    """

    upload_root = Path(settings.storage_root).parent / "uploads" / project_id
    if upload_root.exists():
        shutil.rmtree(upload_root)
    upload_root.mkdir(parents=True, exist_ok=True)

    saved_paths: list[str] = []
    for index, (filename, content) in enumerate(uploads, start=1):
        safe_name = filename or f"upload_{index}.bin"
        target_path = upload_root / f"{index:02d}_{Path(safe_name).name}"
        target_path.write_bytes(content)
        saved_paths.append(str(target_path))

    return saved_paths


def get_media_duration(file_path: str) -> float:
    """
    ffprobe로 미디어 길이를 초 단위로 읽는다.

    Args:
        file_path: 길이를 읽을 파일 경로

    Returns:
        초 단위 길이
    """

    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            file_path,
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return float(result.stdout.strip())


def pick_tone_colors(tone: str) -> tuple[tuple[int, int, int], tuple[int, int, int]]:
    """
    분위기 값에 따라 카드용 배경 색 조합을 반환한다.

    Args:
        tone: 사용자가 고른 분위기

    Returns:
        시작색과 끝색 튜플
    """

    palette = {
        "깔끔한 판매형": ((247, 238, 226), (214, 176, 125)),
        "따뜻한 공감형": ((245, 228, 232), (208, 144, 160)),
        "밝은 행사형": ((255, 242, 197), (240, 170, 83)),
        "고급스러운 브랜드형": ((233, 241, 247), (119, 157, 188)),
    }
    return palette.get(tone, ((238, 238, 238), (148, 148, 148)))


def get_korean_font_path() -> Path | None:
    """
    한글 렌더링에 사용할 시스템 폰트 경로를 찾는다.

    Returns:
        찾은 폰트 경로 또는 None
    """

    project_font_candidates = [
        PROJECT_ROOT
        / "frontend"
        / "node_modules"
        / "@fontsource"
        / "noto-sans-kr"
        / "files"
        / "noto-sans-kr-korean-700-normal.woff2",
        PROJECT_ROOT
        / "frontend"
        / "node_modules"
        / "@fontsource"
        / "noto-sans-kr"
        / "files"
        / "noto-sans-kr-korean-400-normal.woff2",
        PROJECT_ROOT
        / "frontend"
        / "node_modules"
        / "@fontsource"
        / "noto-sans-kr"
        / "files"
        / "noto-sans-kr-korean-700-normal.woff",
        PROJECT_ROOT
        / "frontend"
        / "node_modules"
        / "@fontsource"
        / "noto-sans-kr"
        / "files"
        / "noto-sans-kr-korean-400-normal.woff",
    ]
    for candidate in project_font_candidates:
        if candidate.exists():
            return candidate

    candidate_paths = [
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]

    for candidate in candidate_paths:
        font_path = Path(candidate)
        if font_path.exists():
            return font_path

    return None


def load_korean_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """
    한글이 깨지지 않도록 시스템 폰트를 우선 탐색해 로드한다.

    Args:
        size: 원하는 폰트 크기

    Returns:
        로드된 폰트 객체
    """

    font_path = get_korean_font_path()
    if font_path is not None:
        return ImageFont.truetype(str(font_path), size=size)

    return ImageFont.load_default()


def render_marketing_card(
    output_path: Path,
    title: str,
    subtitle: str,
    badges: list[str],
    *,
    width: int,
    height: int,
    tone: str,
) -> str:
    """
    폴백 모드에서 바로 쓸 수 있는 광고 카드 이미지를 생성한다.

    Args:
        output_path: 생성할 이미지 경로
        title: 메인 제목
        subtitle: 보조 설명
        badges: 강조 키워드 목록
        width: 이미지 너비
        height: 이미지 높이
        tone: 분위기 값

    Returns:
        저장된 이미지 경로 문자열
    """

    output_path.parent.mkdir(parents=True, exist_ok=True)
    start_color, end_color = pick_tone_colors(tone)
    image = Image.new("RGB", (width, height), start_color)
    draw = ImageDraw.Draw(image)

    # 단색 배경만 두면 너무 밋밋하므로 간단한 세로 그라데이션을 입힌다.
    for y in range(height):
        ratio = y / max(height - 1, 1)
        red = int(start_color[0] * (1 - ratio) + end_color[0] * ratio)
        green = int(start_color[1] * (1 - ratio) + end_color[1] * ratio)
        blue = int(start_color[2] * (1 - ratio) + end_color[2] * ratio)
        draw.line((0, y, width, y), fill=(red, green, blue))

    # 카드 내부의 큰 반투명 패널로 텍스트 대비를 확보한다.
    panel_margin = 44
    panel_box = (panel_margin, panel_margin, width - panel_margin, height - panel_margin)
    draw.rounded_rectangle(panel_box, radius=28, fill=(255, 255, 255))

    title_font = load_korean_font(34)
    subtitle_font = load_korean_font(22)

    text_x = panel_margin + 34
    text_y = panel_margin + 34
    draw.text((text_x, text_y), title, fill=(40, 33, 28), font=title_font)
    draw.text((text_x, text_y + 38), subtitle, fill=(86, 72, 61), font=subtitle_font)

    badge_y = text_y + 92
    for badge in badges[:4]:
        badge_width = min(width - panel_margin * 2 - 68, max(140, len(badge) * 12 + 36))
        badge_box = (text_x, badge_y, text_x + badge_width, badge_y + 34)
        draw.rounded_rectangle(badge_box, radius=16, fill=(246, 238, 229), outline=(215, 194, 170))
        draw.text((text_x + 14, badge_y + 9), badge, fill=(87, 61, 43), font=subtitle_font)
        badge_y += 42

    # 오른쪽 아래에는 상품 카드 같은 강조 박스를 넣어 실제 광고 시안을 보는 느낌을 준다.
    accent_box = (width - 260, height - 220, width - 80, height - 80)
    draw.rounded_rectangle(accent_box, radius=24, fill=(255, 247, 241))
    draw.rounded_rectangle(
        (accent_box[0] + 18, accent_box[1] + 18, accent_box[2] - 18, accent_box[3] - 18),
        radius=18,
        outline=(208, 144, 120),
        width=3,
    )
    draw.text((accent_box[0] + 28, accent_box[1] + 28), "광고 시안", fill=(110, 73, 54))
    draw.text((accent_box[0] + 28, accent_box[1] + 62), "즉시 사용 가능", fill=(82, 55, 39))

    image = image.filter(ImageFilter.SMOOTH)
    image.save(output_path)
    return str(output_path)


def run_ffmpeg(command: list[str]) -> None:
    """
    ffmpeg 명령을 실행하고 실패 시 예외를 올린다.

    Args:
        command: ffmpeg 전체 명령 인자 목록
    """

    subprocess.run(command, check=True, capture_output=True, text=True)
