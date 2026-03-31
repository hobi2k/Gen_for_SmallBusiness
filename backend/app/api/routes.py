"""애플리케이션 API 라우터를 묶는 모듈"""

from fastapi import APIRouter

from backend.app.api.chat import router as chat_router
from backend.app.api.generation import router as generation_router
from backend.app.api.health import router as health_router
from backend.app.api.projects import router as projects_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(generation_router, prefix="/generate", tags=["generate"])
api_router.include_router(projects_router, prefix="/projects", tags=["projects"])
