"""최종 합성 도구 모듈"""

from __future__ import annotations

from backend.app.tools.runtime_support import ensure_project_root, run_ffmpeg


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

    # 영상 길이에 맞춰 음악을 잘라 붙이고, 결과 파일 하나만 열어도 바로 확인 가능하게 만든다.
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
            "-shortest",
            str(output_path),
        ],
    )
    return str(output_path)
