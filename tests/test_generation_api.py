"""전용 생성 API 테스트 모듈"""

from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image

from backend.app.main import app


def _build_payload() -> dict[str, str]:
    """
    테스트에 공통으로 쓰는 생성 요청 데이터를 만든다.

    Returns:
        생성 요청 데이터
    """

    return {
        "category": "식품",
        "product_name": "수제 딸기잼",
        "summary": "빵과 잘 어울리는 수제 잼",
        "description": "딸기를 오래 졸여 만든 수제 잼입니다.",
        "keywords": "수제, 선물",
        "selling_points": "과육이 살아 있습니다.",
        "tone": "깔끔한 판매형",
        "video_duration_seconds": "6",
        "include_music": "true",
        "music_language": "ko",
        "music_lyrics": "",
        "music_vocal_mode": "instrumental",
    }


def _build_upload_file() -> tuple[str, BytesIO, str]:
    """
    테스트용 업로드 파일을 만든다.

    Returns:
        업로드 파일 튜플
    """

    buffer = BytesIO()
    Image.new("RGB", (32, 32), (220, 120, 80)).save(buffer, format="PNG")
    buffer.seek(0)
    return ("sample.png", buffer, "image/png")


def test_generate_image_returns_image_assets() -> None:
    """
    이미지 전용 생성 API가 자산 경로를 반환하는지 확인한다.
    """

    with TestClient(app) as client:
        response = client.post(
            "/generate/image",
            data=_build_payload(),
            files={"images": _build_upload_file()},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "image"
    assert "banners" in data["asset_paths"]
    assert "details" in data["asset_paths"]
    assert "logos" in data["asset_paths"]
    assert data["asset_paths"]["copy"]["music_vocal_mode"] == "instrumental"


def test_generate_video_returns_video_assets() -> None:
    """
    영상 전용 생성 API가 영상과 음악 자산을 반환하는지 확인한다.
    """

    with TestClient(app) as client:
        payload = _build_payload()
        payload["include_music"] = "false"
        response = client.post(
            "/generate/video",
            data=payload,
            files={"images": _build_upload_file()},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "video"
    assert "video" in data["asset_paths"]
    assert "music" not in data["asset_paths"]
    assert "final_video" not in data["asset_paths"]


def test_generate_video_includes_music_assets_when_enabled() -> None:
    """
    영상 전용 생성 API가 음악 포함 상태에서 합성 결과까지 반환하는지 확인한다.
    """

    with TestClient(app) as client:
        response = client.post(
            "/generate/video",
            data=_build_payload(),
            files={"images": _build_upload_file()},
        )

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "video"
    assert "video" in data["asset_paths"]
    assert "music" in data["asset_paths"]
    assert "final_video" in data["asset_paths"]


def test_generate_music_returns_music_asset() -> None:
    """
    음악 전용 생성 API가 음악 자산을 반환하는지 확인한다.
    """

    with TestClient(app) as client:
        payload = _build_payload()
        payload["music_vocal_mode"] = "vocal"
        payload["music_language"] = "ko"
        payload["music_lyrics"] = "[chorus]\n한 잔이면 충분해"
        response = client.post("/generate/music", data=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "music"
    assert "music" in data["asset_paths"]
    assert data["asset_paths"]["copy"]["music_vocal_mode"] == "vocal"
