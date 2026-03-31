"""채팅 기반 생성 API 모듈"""

from fastapi import APIRouter, HTTPException

from backend.app.schemas.chat import ChatGenerateRequest, ChatGenerateResponse
from backend.app.services.chat_service import run_chat_generation

router = APIRouter()


@router.post("/generate", response_model=ChatGenerateResponse)
def generate_from_chat(payload: ChatGenerateRequest) -> ChatGenerateResponse:
    """
    채팅 메시지를 바탕으로 공용 생성 도구를 호출한다.

    Args:
        payload: 채팅 기반 생성 요청

    Returns:
        생성 결과 응답
    """

    try:
        return run_chat_generation(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
