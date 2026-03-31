"""채팅 기반 생성 API 테스트 모듈"""

from fastapi.testclient import TestClient

from backend.app.main import app


def test_chat_generate_image_returns_assets() -> None:
    """
    채팅 요청으로 이미지 생성 자산이 반환되는지 확인한다.
    """

    payload = {
        'message': '수제 딸기잼 배너 이미지 만들어줘',
        'product_name': '수제 딸기잼',
        'category': '식품',
        'summary': '빵과 잘 어울리는 수제 잼',
        'description': '딸기를 오래 졸여 만든 수제 잼입니다.',
        'video_duration_seconds': 6,
    }

    with TestClient(app) as client:
        response = client.post('/chat/generate', json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data['intent'] == 'image'
    assert 'banners' in data['asset_paths']


def test_chat_generate_music_returns_music_asset() -> None:
    """
    채팅 요청으로 음악 생성 자산이 반환되는지 확인한다.
    """

    payload = {
        'message': '카페 광고용 배경 음악 만들어줘',
        'product_name': '바닐라 라떼',
        'category': '카페',
        'summary': '부드럽고 달콤한 라떼',
        'description': '바닐라 향이 살아 있는 수제 라떼입니다.',
        'video_duration_seconds': 5,
    }

    with TestClient(app) as client:
        response = client.post('/chat/generate', json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data['intent'] == 'music'
    assert 'music' in data['asset_paths']
