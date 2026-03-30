"""
프로젝트에서 사용할 모델 디렉토리와 다운로드를 초기화하는 스크립트
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = PROJECT_ROOT / "models" / "model_manifest.json"
MODEL_ROOT = PROJECT_ROOT / "models"
META_ROOT = MODEL_ROOT / "meta"


def load_manifest() -> dict[str, Any]:
    """
    모델 매니페스트 파일을 읽어 파이썬 딕셔너리로 반환한다.

    Returns:
        모델 메타데이터가 담긴 딕셔너리
    """

    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def ensure_directories(manifest: dict[str, Any]) -> list[dict[str, str]]:
    """
    매니페스트에 정의된 모델 디렉토리를 모두 생성한다.

    Args:
        manifest: 모델 매니페스트 데이터

    Returns:
        생성한 디렉토리 요약 목록
    """

    META_ROOT.mkdir(parents=True, exist_ok=True)
    created_items: list[dict[str, str]] = []

    for model in manifest["models"]:
        target_dir = PROJECT_ROOT / model["target_dir"]
        target_dir.mkdir(parents=True, exist_ok=True)
        created_items.append(
            {
                "name": model["name"],
                "target_dir": str(target_dir.relative_to(PROJECT_ROOT)),
            },
        )

    return created_items


def write_lock_file(records: list[dict[str, str]], mode: str) -> Path:
    """
    초기화 결과를 모델 잠금 파일로 기록한다.

    Args:
        records: 생성 또는 다운로드 결과 목록
        mode: 현재 초기화 모드

    Returns:
        생성된 잠금 파일 경로
    """

    output_path = META_ROOT / "model_init_lock.json"
    output_path.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "mode": mode,
                "records": records,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return output_path


def download_models(manifest: dict[str, Any]) -> list[dict[str, str]]:
    """
    매니페스트에 정의된 모델을 Hugging Face에서 내려받는다.

    Args:
        manifest: 모델 매니페스트 데이터

    Returns:
        다운로드 결과 목록
    """

    from huggingface_hub import snapshot_download

    downloaded_items: list[dict[str, str]] = []

    for model in manifest["models"]:
        target_dir = PROJECT_ROOT / model["target_dir"]
        try:
            # 이미 모델 디렉토리가 채워져 있으면 다시 전체 다운로드하지 않도록 유지한다.
            # 실제 운영 환경에서는 버전 잠금이나 강제 갱신 옵션을 따로 둘 수 있다.
            snapshot_download(
                repo_id=model["repo_id"],
                local_dir=target_dir,
                local_dir_use_symlinks=False,
                resume_download=True,
            )
            downloaded_items.append(
                {
                    "name": model["name"],
                    "repo_id": model["repo_id"],
                    "target_dir": str(target_dir.relative_to(PROJECT_ROOT)),
                    "status": "downloaded",
                },
            )
        except Exception as exc:
            downloaded_items.append(
                {
                    "name": model["name"],
                    "repo_id": model["repo_id"],
                    "target_dir": str(target_dir.relative_to(PROJECT_ROOT)),
                    "status": "failed",
                    "error": str(exc),
                },
            )
            if model.get("required", False):
                raise RuntimeError(
                    f"필수 모델 다운로드 실패: {model['name']} ({model['repo_id']})",
                ) from exc

    return downloaded_items


def parse_args() -> argparse.Namespace:
    """
    초기화 스크립트 인자를 파싱한다.

    Returns:
        파싱된 인자 네임스페이스
    """

    parser = argparse.ArgumentParser(description="모델 디렉토리와 다운로드 초기화")
    parser.add_argument(
        "--create-only",
        action="store_true",
        help="디렉토리와 잠금 파일만 만들고 실제 모델은 내려받지 않는다.",
    )
    return parser.parse_args()


def main() -> None:
    """
    모델 초기화 전체 흐름을 실행한다.
    """

    args = parse_args()
    manifest = load_manifest()
    created_items = ensure_directories(manifest)

    if args.create_only:
        lock_path = write_lock_file(created_items, mode="create_only")
        print(f"모델 디렉토리 초기화 완료: {lock_path}")
        return

    downloaded_items = download_models(manifest)
    lock_path = write_lock_file(downloaded_items, mode="download")
    print(f"모델 다운로드 초기화 완료: {lock_path}")


if __name__ == "__main__":
    main()
