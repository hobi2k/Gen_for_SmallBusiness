"""이미지와 영상에 한글 문구를 오버레이하는 도구 모듈"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

from backend.app.schemas.project import ProjectCreateRequest
from backend.app.tools.runtime_support import get_korean_font_path, load_korean_font, run_ffmpeg


def _pick_overlay_texts(
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    asset_kind: str,
) -> tuple[str, str, str]:
    """
    자산 종류에 따라 제목, 보조 문구, 강조 문구를 고른다.

    Args:
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과
        asset_kind: banner, detail, video 중 하나

    Returns:
        제목, 보조 문구, 강조 문구
    """

    headline = str(copy_bundle.get("headline") or payload.product_name).strip()
    detail_headline = str(copy_bundle.get("detail_headline") or payload.summary).strip()
    subheads = [str(item).strip() for item in copy_bundle.get("subheads", []) if str(item).strip()]
    social_copies = [
        str(item).strip()
        for item in copy_bundle.get("short_social_copies", [])
        if str(item).strip()
    ]
    selling_point = payload.selling_points[0] if payload.selling_points else payload.summary

    if asset_kind == "detail":
        return (
            detail_headline or headline,
            subheads[0] if subheads else payload.summary,
            selling_point,
        )

    if asset_kind == "video":
        return (
            headline,
            subheads[0] if subheads else payload.summary,
            social_copies[0] if social_copies else payload.product_name,
        )

    return (
        headline,
        subheads[0] if subheads else payload.summary,
        social_copies[0] if social_copies else selling_point,
    )


def _wrap_text(text: str, max_chars: int) -> str:
    """
    한글 문장을 글자 수 기준으로 줄바꿈한다.

    Args:
        text: 원본 문장
        max_chars: 한 줄 최대 글자 수

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
            continue
        while len(word) > max_chars:
            lines.append(word[:max_chars])
            word = word[max_chars:]
        current = word
    if current:
        lines.append(current)
    return "\n".join(lines[:3])


def _draw_text_block(
    draw: ImageDraw.ImageDraw,
    *,
    x: int,
    y: int,
    text: str,
    font,
    fill: tuple[int, int, int],
    spacing: int,
) -> None:
    """
    그림자와 함께 텍스트 블록을 그린다.

    Args:
        draw: PIL 드로잉 객체
        x: 시작 x 좌표
        y: 시작 y 좌표
        text: 출력 문장
        font: 사용할 폰트
        fill: 글자 색
        spacing: 줄 간격
    """

    if not text.strip():
        return

    shadow_fill = (12, 12, 12)
    draw.multiline_text(
        (x + 2, y + 2),
        text,
        font=font,
        fill=shadow_fill,
        spacing=spacing,
    )
    draw.multiline_text(
        (x, y),
        text,
        font=font,
        fill=fill,
        spacing=spacing,
    )


def overlay_text_on_image(
    source_path: str,
    output_path: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
    *,
    asset_kind: str,
) -> str:
    """
    생성된 이미지 위에 한글 문구를 오버레이한다.

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
    width, height = source.size
    overlay = Image.new("RGBA", source.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    headline, subhead, badge = _pick_overlay_texts(
        payload,
        copy_bundle,
        asset_kind=asset_kind,
    )

    if asset_kind == "detail":
        headline_text = _wrap_text(headline, 16)
        subhead_text = _wrap_text(subhead, 24)
        title_font = load_korean_font(max(44, width // 22))
        subtitle_font = load_korean_font(max(26, width // 42))
        badge_font = load_korean_font(max(22, width // 52))
        panel_box = (54, height - 330, width - 54, height - 54)
    else:
        headline_text = _wrap_text(headline, 12)
        subhead_text = _wrap_text(subhead, 22)
        title_font = load_korean_font(max(54, width // 18))
        subtitle_font = load_korean_font(max(26, width // 40))
        badge_font = load_korean_font(max(22, width // 52))
        panel_box = (52, height - 280, width - 52, height - 48)

    draw.rounded_rectangle(panel_box, radius=30, fill=(14, 19, 30, 190))
    content_x = panel_box[0] + 30
    content_y = panel_box[1] + 26

    _draw_text_block(
        draw,
        x=content_x,
        y=content_y,
        text=headline_text,
        font=title_font,
        fill=(255, 255, 255),
        spacing=8,
    )

    title_bbox = draw.multiline_textbbox(
        (content_x, content_y),
        headline_text,
        font=title_font,
        spacing=8,
    )
    subtitle_y = title_bbox[3] + 20
    _draw_text_block(
        draw,
        x=content_x,
        y=subtitle_y,
        text=subhead_text,
        font=subtitle_font,
        fill=(236, 231, 224),
        spacing=10,
    )

    badge_text = _wrap_text(badge, 18)
    badge_bbox = draw.multiline_textbbox((0, 0), badge_text, font=badge_font, spacing=6)
    badge_width = badge_bbox[2] - badge_bbox[0] + 30
    badge_height = badge_bbox[3] - badge_bbox[1] + 22
    badge_x = panel_box[2] - badge_width - 28
    badge_y = panel_box[3] - badge_height - 24
    draw.rounded_rectangle(
        (badge_x, badge_y, badge_x + badge_width, badge_y + badge_height),
        radius=20,
        fill=(255, 184, 104, 230),
    )
    draw.multiline_text(
        (badge_x + 15, badge_y + 11),
        badge_text,
        font=badge_font,
        fill=(31, 23, 18),
        spacing=6,
    )

    result = Image.alpha_composite(source, overlay).convert("RGB")
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path)
    return output_path


def _escape_drawtext(value: str) -> str:
    """
    drawtext 필터에 안전하게 넣을 수 있도록 문자열을 이스케이프한다.

    Args:
        value: 원본 문자열

    Returns:
        이스케이프된 문자열
    """

    escaped = value.replace("\\", "\\\\")
    escaped = escaped.replace(":", "\\:")
    escaped = escaped.replace("'", "\\'")
    escaped = escaped.replace("%", "\\%")
    return escaped


def _build_drawtext_filters(
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
) -> str:
    """
    영상 오버레이용 drawtext 필터 문자열을 만든다.

    Args:
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과

    Returns:
        ffmpeg filter_complex 문자열
    """

    font_path = get_korean_font_path()
    if font_path is None:
        raise FileNotFoundError("한글 drawtext용 시스템 폰트를 찾지 못했습니다.")

    headline, subhead, cta = _pick_overlay_texts(payload, copy_bundle, asset_kind="video")
    headline_text = _escape_drawtext(_wrap_text(headline, 12))
    subhead_text = _escape_drawtext(_wrap_text(subhead, 20))
    cta_text = _escape_drawtext(_wrap_text(cta, 16))
    duration = float(payload.video_duration_seconds)

    return ",".join(
        [
            (
                "drawtext="
                f"fontfile='{font_path}':"
                f"text='{headline_text}':"
                "fontsize=58:"
                "fontcolor=white:"
                "line_spacing=10:"
                "x=64:y=h-252:"
                "box=1:boxcolor=black@0.34:boxborderw=24:"
                "shadowx=2:shadowy=2:shadowcolor=black@0.65:"
                "enable='between(t,0,2.1)'"
            ),
            (
                "drawtext="
                f"fontfile='{font_path}':"
                f"text='{subhead_text}':"
                "fontsize=30:"
                "fontcolor=white:"
                "line_spacing=8:"
                "x=64:y=h-128:"
                "box=1:boxcolor=black@0.28:boxborderw=18:"
                "shadowx=2:shadowy=2:shadowcolor=black@0.55:"
                f"enable='between(t,1.2,{max(duration - 1.4, 2.4):.2f})'"
            ),
            (
                "drawtext="
                f"fontfile='{font_path}':"
                f"text='{cta_text}':"
                "fontsize=28:"
                "fontcolor=white:"
                "x=64:y=72:"
                "box=1:boxcolor=#ffb868@0.92:boxborderw=18:"
                "shadowx=1:shadowy=1:shadowcolor=black@0.35:"
                f"enable='between(t,{max(duration - 1.8, 0.8):.2f},{duration:.2f})'"
            ),
        ]
    )


def overlay_text_on_video(
    project_id: str,
    source_path: str,
    payload: ProjectCreateRequest,
    copy_bundle: dict[str, str | list[str]],
) -> str:
    """
    생성된 영상 위에 한글 문구를 오버레이한다.

    Args:
        project_id: 프로젝트 식별자
        source_path: 원본 영상 경로
        payload: 프로젝트 생성 요청 데이터
        copy_bundle: 문구 생성 결과

    Returns:
        저장된 최종 영상 경로
    """

    output_path = Path(source_path).with_name("video_overlay.mp4")
    filter_chain = _build_drawtext_filters(payload, copy_bundle)
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-i",
            source_path,
            "-vf",
            filter_chain,
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-an",
            str(output_path),
        ],
    )
    return str(output_path)
