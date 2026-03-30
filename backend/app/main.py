"""FastAPI 애플리케이션 진입점"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.routes import api_router
from backend.app.core.config import get_settings
from backend.app.db.session import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """
    애플리케이션 시작 시 필요한 자원을 초기화한다.

    Args:
        _: FastAPI 애플리케이션 인스턴스

    Returns:
        애플리케이션 생명주기 제너레이터
    """

    # 테스트와 실제 실행 모두에서 같은 초기화 흐름을 타게 해야 테이블 생성 누락을 막을 수 있다.
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
