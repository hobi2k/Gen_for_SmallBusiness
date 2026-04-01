"""채팅 기반 생성 요청과 응답 스키마를 정의하는 모듈"""

from pydantic import BaseModel, Field


class ChatGenerateRequest(BaseModel):
    """
    채팅 기반 생성 요청 데이터를 검증한다.
    """

    message: str = Field(..., description="사용자 자연어 요청")
    category: str | None = Field(default=None, description="업종")
    product_name: str | None = Field(default=None, description="상품명")
    summary: str | None = Field(default=None, description="한 줄 소개")
    description: str | None = Field(default=None, description="상세 설명")
    keywords: list[str] = Field(default_factory=list, description="핵심 키워드")
    selling_points: list[str] = Field(default_factory=list, description="강조할 판매 포인트")
    tone: str = Field(default="깔끔한 판매형", description="원하는 분위기")
    video_duration_seconds: int = Field(default=6, ge=3, le=10, description="영상 길이")
    image_paths: list[str] = Field(default_factory=list, description="업로드 이미지 경로")
    include_music: bool = Field(default=True, description="영상에 음악을 포함할지 여부")
    music_language: str = Field(default="ko", description="음악 가사 언어")
    music_lyrics: str = Field(default="", description="음악 가사")
    music_vocal_mode: str = Field(default="instrumental", description="음악 보컬 모드")


class ChatGenerateResponse(BaseModel):
    """
    채팅 기반 생성 응답을 표현한다.
    """

    status: str = Field(default="completed", description="completed 또는 needs_input")
    intent: str
    assistant_message: str
    project_root: str = ""
    asset_paths: dict[str, str | list[str] | dict[str, str | list[str]]] = Field(default_factory=dict)
