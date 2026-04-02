"""이미지와 영상에 자연스럽게 섞이는 한글 오버레이를 그리는 도구 모듈"""

from __future__ import annotations

import logging
from pathlib import Path

from PIL import Image, ImageDraw

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.runtime_support import get_video_dimensions, load_korean_font, run_ffmpeg

logger = logging.getLogger(__name__)


def _pick_overlay_texts(
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    asset_kind: str,
) -> tuple[str, str, str]:
    """
    자산 종류에 따라 제목, 보조 문구, 행동 문구를 고른다.

    Args:
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        asset_kind: banner, detail, video 중 하나

    Returns:
        제목, 보조 문구, 행동 문구
    """

    headline = str(copy_bundle.get("headline") or payload.product_name).strip()
    detail_headline = str(copy_bundle.get("detail_headline") or payload.prompt).strip()
    subheads = [str(item).strip() for item in copy_bundle.get("subheads", []) if str(item).strip()]
    social_copies = [
        str(item).strip()
        for item in copy_bundle.get("short_social_copies", [])
        if str(item).strip()
    ]
    if asset_kind == "detail":
        return (
            detail_headline or headline,
            subheads[0] if subheads else payload.prompt,
            payload.prompt,
        )
    if asset_kind == "video":
        return (
            headline,
            subheads[0] if subheads else payload.prompt,
            social_copies[0] if social_copies else "지금 확인하기",
        )
    return (
        headline,
        subheads[0] if subheads else payload.prompt,
        social_copies[0] if social_copies else payload.prompt,
    )


def _wrap_text(text: str, max_chars: int, max_lines: int) -> str:
    """
    문장을 줄 수 제한과 글자 수 기준으로 줄바꿈한다.

    Args:
        text: 원본 문장
        max_chars: 한 줄 최대 글자 수
        max_lines: 최대 줄 수

    Returns:
        줄바꿈된 문장
    """

    cleaned = " ".join(text.split())
    if not cleaned:
        return ""

    words = cleaned.split(" ")
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word
        if len(lines) >= max_lines:
            break
    if current and len(lines) < max_lines:
        lines.append(current)
    return "\n".join(lines[:max_lines])


def _draw_soft_shadow_text(
    draw: ImageDraw.ImageDraw,
    *,
    x: int,
    y: int,
    text: str,
    font,
    fill: tuple[int, int, int],
    spacing: int,
    shadow_alpha: int,
) -> None:
    """
    부드러운 그림자를 가진 텍스트를 그린다.

    Args:
        draw: 드로잉 객체
        x: 시작 x 좌표
        y: 시작 y 좌표
        text: 출력 문장
        font: 폰트
        fill: 글자 색
        spacing: 줄 간격
        shadow_alpha: 그림자 알파값
    """

    if not text.strip():
        return

    for offset_x, offset_y in ((0, 3), (2, 2), (3, 0)):
        draw.multiline_text(
            (x + offset_x, y + offset_y),
            text,
            font=font,
            fill=(0, 0, 0, shadow_alpha),
            spacing=spacing,
        )

    draw.multiline_text(
        (x, y),
        text,
        font=font,
        fill=fill,
        spacing=spacing,
    )


def _draw_bottom_gradient(
    draw: ImageDraw.ImageDraw,
    width: int,
    height: int,
    *,
    start_ratio: float,
    color: tuple[int, int, int],
    max_alpha: int,
) -> None:
    """
    하단에 자연스럽게 녹아드는 그라데이션을 그린다.

    Args:
        draw: 드로잉 객체
        width: 전체 너비
        height: 전체 높이
        start_ratio: 그라데이션 시작 비율
        color: 그라데이션 색
        max_alpha: 최대 알파값
    """

    start_y = int(height * start_ratio)
    total_height = max(height - start_y, 1)
    for index, y in enumerate(range(start_y, height)):
        alpha = int(max_alpha * ((index + 1) / total_height))
        draw.line([(0, y), (width, y)], fill=(*color, alpha), width=1)


def _draw_pill(
    draw: ImageDraw.ImageDraw,
    *,
    x: int,
    y: int,
    text: str,
    font,
    fill: tuple[int, int, int, int],
    text_fill: tuple[int, int, int, int],
    padding_x: int,
    padding_y: int,
    radius: int,
) -> tuple[int, int, int, int]:
    """
    둥근 정보 태그를 그린다.

    Args:
        draw: 드로잉 객체
        x: 시작 x 좌표
        y: 시작 y 좌표
        text: 태그 문구
        font: 폰트
        fill: 배경 색
        text_fill: 글자 색
        padding_x: 가로 패딩
        padding_y: 세로 패딩
        radius: 모서리 반경

    Returns:
        그려진 박스 좌표
    """

    text_bbox = draw.textbbox((0, 0), text, font=font)
    pill_box = (
        x,
        y,
        x + (text_bbox[2] - text_bbox[0]) + padding_x * 2,
        y + (text_bbox[3] - text_bbox[1]) + padding_y * 2,
    )
    draw.rounded_rectangle(pill_box, radius=radius, fill=fill)
    draw.text(
        (pill_box[0] + padding_x, pill_box[1] + padding_y - 1),
        text,
        font=font,
        fill=text_fill,
    )
    return pill_box


def _build_overlay_layer(
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    asset_kind: str,
    width: int,
    height: int,
) -> Image.Image:
    """
    이미지와 영상에 공통으로 쓸 투명 오버레이 레이어를 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        asset_kind: banner, detail, video 중 하나
        width: 자산 너비
        height: 자산 높이

    Returns:
        투명 RGBA 오버레이 이미지
    """

    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    headline, subhead, cta = _pick_overlay_texts(payload, copy_bundle, asset_kind=asset_kind)

    title_font_size = max(38, width // 18) if asset_kind == "banner" else max(34, width // 20)
    subtitle_font_size = max(22, width // 42)
    tag_font_size = max(20, width // 54)
    cta_font_size = max(20, width // 50)

    if asset_kind == "video":
        title_font_size = max(34, width // 19)
        subtitle_font_size = max(22, width // 45)
        tag_font_size = max(18, width // 56)
        cta_font_size = max(20, width // 54)

    title_font = load_korean_font(title_font_size)
    subtitle_font = load_korean_font(subtitle_font_size)
    tag_font = load_korean_font(tag_font_size)
    cta_font = load_korean_font(cta_font_size)

    eyebrow = payload.product_name
    wrapped_headline = _wrap_text(headline, 12 if asset_kind != "detail" else 16, 2)
    wrapped_subhead = _wrap_text(subhead, 22 if asset_kind != "detail" else 24, 2)
    wrapped_cta = _wrap_text(cta, 12, 1)

    _draw_bottom_gradient(
        draw,
        width,
        height,
        start_ratio=0.52 if asset_kind == "banner" else 0.56,
        color=(10, 16, 27),
        max_alpha=192,
    )

    tag_x = 36 if asset_kind != "video" else 28
    tag_y = 34 if asset_kind != "video" else 26
    _draw_pill(
        draw,
        x=tag_x,
        y=tag_y,
        text=eyebrow,
        font=tag_font,
        fill=(250, 244, 235, 228),
        text_fill=(33, 26, 20, 255),
        padding_x=16,
        padding_y=10,
        radius=999,
    )

    left_margin = 48 if asset_kind != "video" else 34
    title_y = int(height * 0.62) if asset_kind == "banner" else int(height * 0.66)
    if asset_kind == "video":
        title_y = int(height * 0.58)

    _draw_soft_shadow_text(
        draw,
        x=left_margin,
        y=title_y,
        text=wrapped_headline,
        font=title_font,
        fill=(255, 250, 244, 255),
        spacing=6,
        shadow_alpha=160,
    )

    title_bbox = draw.multiline_textbbox(
        (left_margin, title_y),
        wrapped_headline,
        font=title_font,
        spacing=6,
    )
    subhead_y = title_bbox[3] + 12
    _draw_soft_shadow_text(
        draw,
        x=left_margin,
        y=subhead_y,
        text=wrapped_subhead,
        font=subtitle_font,
        fill=(240, 232, 223, 244),
        spacing=8,
        shadow_alpha=110,
    )

    cta_bbox = draw.textbbox((0, 0), wrapped_cta, font=cta_font)
    cta_width = (cta_bbox[2] - cta_bbox[0]) + 36
    cta_height = (cta_bbox[3] - cta_bbox[1]) + 20
    adjusted_box = (
        width - cta_width - 34,
        height - cta_height - 28,
        width - 34,
        height - 28,
    )
    draw.rounded_rectangle(adjusted_box, radius=999, fill=(255, 186, 111, 238))
    draw.text(
        (adjusted_box[0] + 18, adjusted_box[1] + 10 - 1),
        wrapped_cta,
        font=cta_font,
        fill=(36, 28, 20, 255),
    )

    return overlay


def overlay_text_on_image(
    source_path: str,
    output_path: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    asset_kind: str,
) -> str:
    """
    생성된 이미지 위에 자연스럽게 섞이는 한글 문구를 오버레이한다.

    Args:
        source_path: 원본 이미지 경로
        output_path: 저장할 최종 이미지 경로
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        asset_kind: banner 또는 detail

    Returns:
        저장된 최종 이미지 경로
    """

    source = Image.open(source_path).convert("RGBA")
    overlay = _build_overlay_layer(
        payload,
        copy_bundle,
        asset_kind=asset_kind,
        width=source.width,
        height=source.height,
    )
    result = Image.alpha_composite(source, overlay).convert("RGB")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    logger.info("이미지 오버레이 저장 시작: 원본=%s, 결과=%s", source_path, output_path)
    result.save(output_path, quality=95)
    logger.info("이미지 오버레이 저장 완료: %s", output_path)
    return output_path


def _render_video_overlay_layer(
    output_path: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    width: int,
    height: int,
) -> str:
    """
    영상용 투명 오버레이 이미지를 생성한다.

    Args:
        output_path: 저장할 png 경로
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        width: 영상 너비
        height: 영상 높이

    Returns:
        저장된 png 경로
    """

    overlay = _build_overlay_layer(
        payload,
        copy_bundle,
        asset_kind="video",
        width=width,
        height=height,
    )
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    logger.info("영상 오버레이 레이어 저장 시작: %s", output_path)
    overlay.save(output_path)
    logger.info("영상 오버레이 레이어 저장 완료: %s", output_path)
    return output_path


def overlay_text_on_video(
    project_id: str,
    source_path: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
) -> str:
    """
    생성된 영상 위에 한국어 레이어를 합성한다.

    Args:
        project_id: 프로젝트 식별자
        source_path: 원본 영상 경로
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과

    Returns:
        저장된 최종 영상 경로
    """

    del project_id
    source = Path(source_path)
    overlay_path = source.with_name("video_overlay_layer.png")
    output_path = source.with_name("video_overlay.mp4")
    width, height = get_video_dimensions(source_path)
    _render_video_overlay_layer(
        str(overlay_path),
        payload,
        copy_bundle,
        width=width,
        height=height,
    )
    logger.info(
        "영상 오버레이 합성 시작: 원본=%s, 레이어=%s, 결과=%s",
        source_path,
        overlay_path,
        output_path,
    )
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-i",
            source_path,
            "-i",
            str(overlay_path),
            "-filter_complex",
            "[0:v][1:v]overlay=0:0",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            "-an",
            str(output_path),
        ],
    )
    logger.info("영상 오버레이 합성 완료: %s", output_path)
    return str(output_path)
