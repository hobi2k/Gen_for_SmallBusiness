"""데이터베이스 엔진과 세션을 관리하는 모듈"""

from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session, sessionmaker

from backend.app.core.config import get_settings
from backend.app.db.base import Base

settings = get_settings()
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def _apply_lightweight_migrations() -> None:
    """
    개발 단계에서 필요한 최소 스키마 보정을 적용한다.
    """

    inspector = inspect(engine)
    if "projects" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("projects")}
    with engine.begin() as connection:
        # 초기 스캐폴드 뒤에 추가된 요청 스냅샷 컬럼이 없으면 가벼운 ALTER로 맞춘다.
        if "request_snapshot" not in columns:
            connection.execute(
                text("ALTER TABLE projects ADD COLUMN request_snapshot TEXT NOT NULL DEFAULT '{}'"),
            )


def init_db() -> None:
    """
    애플리케이션 시작 시 필요한 테이블을 생성한다.
    """

    from backend.app.models.project import Project  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()


def get_db() -> Generator[Session, None, None]:
    """
    요청 단위 데이터베이스 세션을 제공한다.
    """

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
