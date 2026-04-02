"""ACE-Step 음악 생성 전용 서브프로세스 진입점"""

from __future__ import annotations

import argparse
from pathlib import Path

import soundfile as sf
import torchaudio
from acestep.pipeline_ace_step import ACEStepPipeline


def _save_with_soundfile(
    uri,
    src,
    sample_rate,
    *,
    channels_first=True,
    format=None,
    encoding=None,
    bits_per_sample=None,
    buffer_size=4096,
    backend=None,
    compression=None,
):
    """
    TorchCodec 의존성 없이 soundfile로 wav를 저장한다.

    Args:
        uri: 저장 경로
        src: 오디오 텐서
        sample_rate: 샘플레이트
        channels_first: 채널 우선 텐서 여부
        format: 저장 포맷
        encoding: 인코딩
        bits_per_sample: 비트 수
        buffer_size: 버퍼 크기
        backend: 백엔드 이름
        compression: 압축 설정
    """

    waveform = src.detach().cpu().numpy()
    if channels_first and waveform.ndim == 2:
        waveform = waveform.T
    sf.write(str(uri), waveform, sample_rate)


def main() -> int:
    """
    ACE-Step 추론을 별도 프로세스에서 실행한다.

    Returns:
        프로세스 종료 코드
    """

    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint-dir", required=True)
    parser.add_argument("--duration", required=True, type=float)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--lyrics", default="")
    parser.add_argument("--output-path", required=True)
    args = parser.parse_args()

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    has_lyrics = bool(args.lyrics.strip())
    infer_step = 16 if has_lyrics else 10
    guidance_scale = 5.5 if has_lyrics else 6.5
    omega_scale = 8.0 if has_lyrics else 9.0

    original_torchaudio_save = torchaudio.save
    torchaudio.save = _save_with_soundfile
    try:
        pipeline = ACEStepPipeline(
            checkpoint_dir=args.checkpoint_dir,
            dtype="bfloat16",
            torch_compile=False,
            cpu_offload=True,
        )
        pipeline(
            "wav",
            args.duration,
            args.prompt,
            args.lyrics,
            infer_step,
            guidance_scale,
            "euler",
            "apg",
            omega_scale,
            [42],
            0.0,
            0.0,
            5.0,
            True,
            has_lyrics,
            False,
            "",
            0.0,
            0.0,
            save_path=str(output_path),
        )
    finally:
        torchaudio.save = original_torchaudio_save

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
