"""프로젝트 요청과 응답 스키마를 정의하는 모듈"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreateRequest(BaseModel):
    """
    프로젝트 생성 요청 데이터를 검증한다.
    """

    category: str = Field(..., description="업종")
    product_name: str = Field(..., description="상품명")
    summary: str = Field(..., description="한 줄 소개")
    description: str = Field(..., description="상세 설명")
    keywords: list[str] = Field(default_factory=list, description="핵심 키워드")
    selling_points: list[str] = Field(default_factory=list, description="강조할 판매 포인트")
    tone: str = Field(..., description="원하는 분위기")
    video_duration_seconds: int = Field(
        default=6,
        ge=3,
        le=10,
        description="광고 영상 길이(초)",
    )
    image_paths: list[str] = Field(default_factory=list, description="업로드된 이미지 경로")
    include_music: bool = Field(default=True, description="영상에 음악을 포함할지 여부")
    music_language: str = Field(default="ko", description="음악 가사 언어")
    music_lyrics: str = Field(default="", description="음악 가사")
    music_vocal_mode: str = Field(default="instrumental", description="음악 보컬 모드")


class ProjectResponse(BaseModel):
    """
    프로젝트 응답 데이터를 표현한다.
    """

    id: str
    product_name: str
    category: str
    tone: str
    status: str
    request_snapshot: str
    hero_asset_path: str | None
    failure_stage: str | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class HealthResponse(BaseModel):
    """
    헬스 체크 응답을 표현한다.
    """

    status: str
    app_name: str
