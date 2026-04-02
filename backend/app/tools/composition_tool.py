"""최종 합성 도구 모듈"""

from __future__ import annotations

import logging

from backend.app.tools.runtime_support import ensure_project_root, run_ffmpeg

logger = logging.getLogger(__name__)


def compose_final_video(project_id: str, video_path: str, music_path: str) -> str:
    """
    영상과 음악을 합쳐 최종 결과물을 만든다.

    Args:
        project_id: 프로젝트 식별자
        video_path: 원본 영상 경로
        music_path: 배경 음악 경로

    Returns:
        최종 합성 파일 경로
    """

    root = ensure_project_root(project_id)
    output_path = root / "final_ad.mp4"

    # 음악 길이는 생성 단계에서 영상 길이에 맞춰 맞춘다.
    # 여기서는 자르지 않고 그대로 합쳐서 최종 파일만 만든다.
    logger.info(
        "최종 영상 합성 시작: 영상=%s, 음악=%s, 결과=%s",
        video_path,
        music_path,
        output_path,
    )
    run_ffmpeg(
        [
            "ffmpeg",
            "-y",
            "-i",
            video_path,
            "-i",
            music_path,
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            "-c:v",
            "copy",
            "-c:a",
            "aac",
            str(output_path),
        ],
    )
    logger.info("최종 영상 합성 완료: %s", output_path)
    return str(output_path)
