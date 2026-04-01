"""
현재 프로젝트 실행 환경이 실제 생성 파이프라인을 돌릴 준비가 됐는지 점검한다.
"""

from __future__ import annotations

import json
import shutil

from backend.app.tools.runtime_support import get_model_dir


def _check_import(name: str, module_path: str, symbol: str | None = None) -> dict[str, str]:
    """
    지정한 모듈 또는 심볼이 현재 환경에서 import 되는지 확인한다.

    Args:
        name: 결과 표시에 사용할 이름
        module_path: import 대상 모듈 경로
        symbol: 모듈 안에서 확인할 심볼 이름

    Returns:
        점검 결과 딕셔너리
    """

    try:
        module = __import__(module_path, fromlist=[symbol] if symbol else [])
        if symbol is not None:
            getattr(module, symbol)
        result = {"name": name, "status": "ok"}
        if name == "nunchaku":
            module_file = getattr(module, "__file__", "") or ""
            result["path"] = module_file
            if "/tmp/" in module_file:
                result["status"] = "failed"
                result["error"] = "/tmp 경로에서 nunchaku를 불러오고 있습니다."
        return result
    except Exception as exc:
        return {"name": name, "status": "failed", "error": str(exc)}


def _check_model_dir(name: str) -> dict[str, str]:
    """
    모델 디렉토리가 실제 파일을 포함하는지 확인한다.

    Args:
        name: 매니페스트 모델 이름

    Returns:
        점검 결과 딕셔너리
    """

    model_dir = get_model_dir(name)
    exists = model_dir.exists() and any(model_dir.iterdir())
    return {
        "name": name,
        "status": "ok" if exists else "missing",
        "path": str(model_dir),
    }


def _check_ffmpeg() -> dict[str, str]:
    """
    ffmpeg 실행 파일이 현재 환경에서 보이는지 확인한다.

    Returns:
        점검 결과 딕셔너리
    """

    executable = shutil.which("ffmpeg")
    return {
        "name": "ffmpeg",
        "status": "ok" if executable else "missing",
        "path": executable or "",
    }


def _check_node() -> dict[str, str]:
    """
    프론트 빌드에 필요한 node 실행 파일이 현재 환경에서 보이는지 확인한다.

    Returns:
        점검 결과 딕셔너리
    """

    executable = shutil.which("node")
    return {
        "name": "node",
        "status": "ok" if executable else "missing",
        "path": executable or "",
    }


def _check_cuda() -> dict[str, str]:
    """
    torch 기준 CUDA 사용 가능 여부를 확인한다.

    Returns:
        점검 결과 딕셔너리
    """

    try:
        import torch

        if not torch.cuda.is_available():
            return {"name": "cuda", "status": "missing"}
        device_name = torch.cuda.get_device_name(0)
        return {"name": "cuda", "status": "ok", "device": device_name}
    except Exception as exc:
        return {"name": "cuda", "status": "failed", "error": str(exc)}


def _collect_report() -> list[dict[str, str]]:
    """
    현재 환경 점검 결과를 한 번에 수집한다.

    Returns:
        점검 결과 목록
    """

    return [
        _check_import("torch", "torch"),
        _check_import("diffusers.zimage", "diffusers", "ZImagePipeline"),
        _check_import("diffusers.wan_i2v", "diffusers", "WanImageToVideoPipeline"),
        _check_import("nunchaku", "nunchaku", "NunchakuZImageTransformer2DModel"),
        _check_import("ace_step", "acestep.pipeline_ace_step", "ACEStepPipeline"),
        _check_ffmpeg(),
        _check_node(),
        _check_cuda(),
        _check_model_dir("nunchaku_z_image_turbo"),
        _check_model_dir("wan_ti2v"),
        _check_model_dir("ace_step"),
    ]


def main() -> None:
    """
    환경 점검을 실행하고 JSON으로 출력한다.
    """

    report = _collect_report()
    print(json.dumps(report, ensure_ascii=False, indent=2))

    failed = [item for item in report if item["status"] not in {"ok"}]
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
