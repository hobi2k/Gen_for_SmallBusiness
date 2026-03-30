"""헬스 체크 API 테스트 모듈"""

from fastapi.testclient import TestClient

from backend.app.main import app


def test_read_health_returns_ok() -> None:
    """
    헬스 체크 API가 정상 상태를 반환하는지 확인한다.
    """

    with TestClient(app) as client:
        response = client.get('/health')
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'
