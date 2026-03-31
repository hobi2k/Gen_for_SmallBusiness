"""전용 생성 API 응답 스키마를 정의하는 모듈"""

from pydantic import BaseModel


class GenerationResponse(BaseModel):
    """
    전용 생성 API 응답을 표현한다.
    """

    mode: str
    message: str
    project_root: str
    asset_paths: dict[str, str | list[str] | dict[str, str | list[str]]]
