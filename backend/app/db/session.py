"""데이터베이스 엔진과 세션을 관리하는 모듈"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import get_settings
from backend.app.db.base import Base

settings = get_settings()
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def init_db() -> None:
    """
    애플리케이션 시작 시 필요한 테이블을 생성한다.
    """

    from backend.app.models.project import Project  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    요청 단위 데이터베이스 세션을 제공한다.
    """

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
