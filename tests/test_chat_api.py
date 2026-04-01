"""채팅 기반 생성 API 테스트 모듈"""

from backend.app.api import chat as chat_api
from backend.app.schemas.chat import ChatGenerateRequest, ChatGenerateResponse


def test_chat_generate_image_returns_assets(monkeypatch) -> None:
    """
    채팅 요청으로 이미지 생성 자산이 반환되는지 확인한다.
    """

    monkeypatch.setattr(
        chat_api,
        'run_chat_generation',
        lambda payload: ChatGenerateResponse(
            intent='image',
            assistant_message='이미지를 만들었습니다.',
            project_root='/tmp/image-project',
            asset_paths={
                'project_root': '/tmp/image-project',
                'banners': ['/tmp/banner.png'],
                'details': ['/tmp/detail.png'],
                'logos': ['/tmp/logo.png'],
            },
        ),
    )

    response = chat_api.generate_from_chat(ChatGenerateRequest(message='수제 딸기잼 배너 이미지 만들어줘'))

    assert response.intent == 'image'
    assert 'banners' in response.asset_paths


def test_chat_generate_music_returns_music_asset(monkeypatch) -> None:
    """
    채팅 요청으로 음악 생성 자산이 반환되는지 확인한다.
    """

    monkeypatch.setattr(
        chat_api,
        'run_chat_generation',
        lambda payload: ChatGenerateResponse(
            intent='music',
            assistant_message='음악을 만들었습니다.',
            project_root='/tmp/music-project',
            asset_paths={
                'project_root': '/tmp/music-project',
                'music': '/tmp/music.wav',
            },
        ),
    )

    response = chat_api.generate_from_chat(ChatGenerateRequest(message='카페 광고용 배경 음악 만들어줘'))

    assert response.intent == 'music'
    assert 'music' in response.asset_paths


def test_chat_generate_uses_llm_plan_shape(monkeypatch) -> None:
    """
    채팅 생성 응답이 영상 생성 구조를 그대로 내려주는지 확인한다.
    """

    monkeypatch.setattr(
        chat_api,
        'run_chat_generation',
        lambda payload: ChatGenerateResponse(
            intent='video',
            assistant_message='영상으로 만들겠습니다.',
            project_root='/tmp/video-project',
            asset_paths={
                'project_root': '/tmp/video-project',
                'video': '/tmp/video.mp4',
                'music': '/tmp/music.wav',
                'final_video': '/tmp/final.mp4',
            },
        ),
    )

    response = chat_api.generate_from_chat(ChatGenerateRequest(message='이건 그냥 만들어줘'))

    assert response.intent == 'video'
    assert 'final_video' in response.asset_paths
