"""애플리케이션 설정을 관리하는 모듈"""

from functools import lru_cache
from os import environ
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


def _default_download_root() -> Path:
    """
    생성 결과를 저장할 기본 다운로드 경로를 만든다.

    Returns:
        기본 다운로드 경로
    """

    xdg_download_dir = environ.get("XDG_DOWNLOAD_DIR")
    if xdg_download_dir:
        return Path(xdg_download_dir).expanduser() / "장사한컷"
    return Path.home() / "Downloads" / "장사한컷"


class Settings(BaseSettings):
    """
    애플리케이션 전역 설정을 보관한다.
    """

    app_name: str = "장사한컷"
    app_env: str = "development"
    database_url: str = f"sqlite:///{Path(__file__).resolve().parents[3] / 'app.db'}"
    storage_root: str = str(_default_download_root())
    model_root: str = str(Path(__file__).resolve().parents[3] / "models")
    openai_api_key: str | None = None
    use_local_ai_models: bool = False

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    설정 객체를 한 번만 생성해 재사용한다.

    Returns:
        캐시된 설정 객체
    """

    return Settings()
