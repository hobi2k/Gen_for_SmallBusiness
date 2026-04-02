"""ACE-Step 음악 생성 전용 서브프로세스 진입점"""

from __future__ import annotations

import argparse
from pathlib import Path
import shutil

from acestep.handler import AceStepHandler
from acestep.inference import GenerationConfig, GenerationParams, generate_music
from acestep.llm_inference import LLMHandler


def main() -> int:
    """
    ACE-Step 추론을 별도 프로세스에서 실행한다.

    Returns:
        프로세스 종료 코드
    """

    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", required=True)
    parser.add_argument("--checkpoint-dir", required=True)
    parser.add_argument("--dit-model", required=True)
    parser.add_argument("--lm-model", required=True)
    parser.add_argument("--caption", required=True)
    parser.add_argument("--lyrics", default="")
    parser.add_argument("--instrumental", default="false")
    parser.add_argument("--language", default="ko")
    parser.add_argument("--bpm", default="")
    parser.add_argument("--keyscale", default="")
    parser.add_argument("--time-signature", default="4")
    parser.add_argument("--duration", required=True, type=float)
    parser.add_argument("--output-path", required=True)
    args = parser.parse_args()

    output_path = Path(args.output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpm = int(args.bpm) if args.bpm.strip() else None
    instrumental = args.instrumental.lower() == "true"

    dit_handler = AceStepHandler()
    dit_handler.initialize_service(
        project_root=args.project_root,
        config_path=args.dit_model,
        device="cuda",
        use_flash_attention=False,
        compile_model=False,
        offload_to_cpu=True,
        offload_dit_to_cpu=False,
    )

    llm_handler = LLMHandler()
    llm_handler.initialize(
        checkpoint_dir=args.checkpoint_dir,
        lm_model_path=args.lm_model,
        backend="pt",
        device="cuda",
        offload_to_cpu=True,
        dtype=None,
    )

    params = GenerationParams(
        task_type="text2music",
        caption=args.caption,
        lyrics=args.lyrics,
        instrumental=instrumental,
        vocal_language=args.language or "unknown",
        bpm=bpm,
        keyscale=args.keyscale,
        timesignature=args.time_signature,
        duration=args.duration,
        inference_steps=8,
        seed=31,
        guidance_scale=7.0,
        use_adg=False,
        sampler_mode="euler",
        thinking=True,
        use_cot_metas=True,
        use_cot_caption=True,
        use_cot_lyrics=False,
        use_cot_language=True,
    )
    config = GenerationConfig(
        batch_size=1,
        allow_lm_batch=False,
        use_random_seed=False,
        seeds=[31],
        audio_format="wav",
    )
    result = generate_music(
        dit_handler=dit_handler,
        llm_handler=llm_handler,
        params=params,
        config=config,
        save_dir=str(output_path.parent),
    )
    if not result.success:
        raise RuntimeError(result.error or result.status_message or "ACE-Step 음악 생성 실패")

    generated_audio_path = None
    for audio_info in getattr(result, "audios", []) or []:
        candidate = audio_info.get("path") or audio_info.get("audio_path")
        if candidate:
            generated_audio_path = Path(candidate)
            break

    if generated_audio_path is None or not generated_audio_path.exists():
        raise RuntimeError("ACE-Step 생성 결과에서 실제 오디오 파일 경로를 찾지 못했습니다.")

    if generated_audio_path.resolve() != output_path.resolve():
        shutil.move(str(generated_audio_path), str(output_path))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
