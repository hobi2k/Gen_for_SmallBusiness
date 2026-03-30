"""프로젝트 API 테스트 모듈"""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import app


def test_create_project_returns_completed_status() -> None:
    """
    프로젝트 생성 API가 완료 상태 응답을 반환하는지 확인한다.
    """

    payload = {
        'category': '식품',
        'product_name': '수제 딸기잼',
        'summary': '빵과 잘 어울리는 수제 잼',
        'description': '딸기를 오래 졸여 만든 수제 잼입니다.',
        'keywords': ['수제', '딸기', '잼'],
        'selling_points': ['달지 않고 과육이 살아 있습니다.'],
        'tone': '깔끔한 판매형',
        'video_duration_seconds': 6,
        'image_paths': [],
    }

    with TestClient(app) as client:
        response = client.post('/projects', json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'completed'
    assert data['hero_asset_path'] is not None

    asset_file = Path(data['hero_asset_path']).parent / 'assets.json'
    assert asset_file.exists()
    saved = json.loads(asset_file.read_text(encoding='utf-8'))
    assert 'final_video' in saved
    assert saved['request']['product_name'] == '수제 딸기잼'
    assert saved['request']['video_duration_seconds'] == 6
    assert 'music_prompt' in saved['copy']


def test_create_project_rejects_invalid_tone() -> None:
    """
    허용되지 않은 분위기 값이 들어오면 실패하는지 확인한다.
    """

    payload = {
        'category': '식품',
        'product_name': '수제 딸기잼',
        'summary': '빵과 잘 어울리는 수제 잼',
        'description': '딸기를 오래 졸여 만든 수제 잼입니다.',
        'keywords': ['수제', '딸기', '잼'],
        'selling_points': ['달지 않고 과육이 살아 있습니다.'],
        'tone': '자유형',
        'video_duration_seconds': 6,
        'image_paths': [],
    }

    with TestClient(app) as client:
        response = client.post('/projects', json=payload)
    assert response.status_code == 400
