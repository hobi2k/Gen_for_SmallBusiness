"""SQLAlchemy 기본 모델을 정의하는 모듈"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """
    모든 ORM 모델이 상속하는 기본 클래스다.
    """
