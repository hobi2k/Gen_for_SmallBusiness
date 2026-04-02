"""LLM 도구 호출과 광고 문구 생성을 담당하는 서비스 모듈"""

from __future__ import annotations

import json

from openai import OpenAI
from pydantic import BaseModel, Field

from backend.app.core.config import get_settings
from backend.app.schemas.chat import ChatGenerateRequest
from backend.app.schemas.project import ProjectCreateRequest

settings = get_settings()


class ChatToolDecision(BaseModel):
    """
    채팅 요청에 대해 모델이 선택한 도구 호출 결과를 표현한다.
    """

    tool_name: str = Field(
        ...,
        description="ask_for_more_info, generate_image, generate_video, generate_music 중 하나",
    )
    arguments: dict[str, object] = Field(default_factory=dict, description="도구 호출 인자")


def _get_client() -> OpenAI:
    """
    설정에서 API 키를 읽어 OpenAI 클라이언트를 만든다.

    Returns:
        OpenAI 클라이언트
    """

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY가 설정되어 있지 않습니다.")
    return OpenAI(api_key=settings.openai_api_key)


def _request_json(system_prompt: str, user_prompt: str) -> dict:
    """
    모델에게 JSON만 반환하도록 요청한다.

    Args:
        system_prompt: 시스템 지시문
        user_prompt: 사용자 입력

    Returns:
        모델이 반환한 JSON 객체
    """

    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-5-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


def _chat_tool_schemas() -> list[dict[str, object]]:
    """
    채팅 에이전트가 사용할 도구 스키마 목록을 만든다.

    Returns:
        OpenAI 도구 호출 스키마 목록
    """

    shared_properties: dict[str, object] = {
        "product_name": {"type": "string", "description": "상품명"},
        "prompt": {"type": "string", "description": "생성 프롬프트"},
        "tone": {
            "type": "string",
            "enum": ["깔끔한 판매형", "따뜻한 공감형", "밝은 행사형", "고급스러운 브랜드형"],
            "description": "광고 톤",
        },
        "assistant_message": {
            "type": "string",
            "description": "실행 전 사용자에게 보여줄 짧은 안내",
        },
    }
    image_size_properties: dict[str, object] = {
        "banner_width": {
            "type": "integer",
            "minimum": 256,
            "maximum": 2048,
            "description": "가로 배너 너비",
        },
        "banner_height": {
            "type": "integer",
            "minimum": 256,
            "maximum": 2048,
            "description": "가로 배너 높이",
        },
        "detail_width": {
            "type": "integer",
            "minimum": 256,
            "maximum": 2048,
            "description": "세로 상세 이미지 너비",
        },
        "detail_height": {
            "type": "integer",
            "minimum": 256,
            "maximum": 2048,
            "description": "세로 상세 이미지 높이",
        },
    }
    video_properties: dict[str, object] = {
        **shared_properties,
        **image_size_properties,
        "video_width": {
            "type": "integer",
            "minimum": 256,
            "maximum": 2048,
            "description": "영상 너비",
        },
        "video_height": {
            "type": "integer",
            "minimum": 256,
            "maximum": 2048,
            "description": "영상 높이",
        },
        "video_duration_seconds": {
            "type": "integer",
            "minimum": 1,
            "maximum": 40,
            "description": "영상 길이",
        },
        "include_music": {
            "type": "boolean",
            "description": "영상에 음악을 넣을지 여부",
        },
        "music_language": {"type": "string", "description": "가사 언어"},
        "music_lyrics": {"type": "string", "description": "가사"},
        "music_vocal_mode": {
            "type": "string",
            "enum": ["instrumental", "vocal"],
            "description": "보컬 방식",
        },
    }
    music_properties: dict[str, object] = {
        **shared_properties,
        "video_duration_seconds": {
            "type": "integer",
            "minimum": 1,
            "maximum": 40,
            "description": "음악 길이",
        },
        "music_language": {"type": "string", "description": "가사 언어"},
        "music_lyrics": {"type": "string", "description": "가사"},
        "music_vocal_mode": {
            "type": "string",
            "enum": ["instrumental", "vocal"],
            "description": "보컬 방식",
        },
    }
    return [
        {
            "type": "function",
            "function": {
                "name": "ask_for_more_info",
                "description": (
                    "입력이 부족해 바로 생성할 수 없을 때 "
                    "한 문장으로 추가 정보를 요청한다."
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "question": {
                            "type": "string",
                            "description": "사용자에게 돌려줄 추가 질문 한 문장",
                        }
                    },
                    "required": ["question"],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "generate_image",
                "description": "이미지 생성이 적절할 때 호출한다.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        **shared_properties,
                        **image_size_properties,
                    },
                    "required": [
                        "product_name",
                        "prompt",
                        "tone",
                        "assistant_message",
                    ],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "generate_video",
                "description": "영상 생성이 적절할 때 호출한다. 음악 포함 여부도 함께 결정한다.",
                "parameters": {
                    "type": "object",
                    "properties": video_properties,
                    "required": [
                        "product_name",
                        "prompt",
                        "tone",
                        "video_duration_seconds",
                        "include_music",
                        "assistant_message",
                    ],
                    "additionalProperties": False,
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "generate_music",
                "description": "음악 생성이 적절할 때 호출한다.",
                "parameters": {
                    "type": "object",
                    "properties": music_properties,
                    "required": [
                        "product_name",
                        "prompt",
                        "tone",
                        "video_duration_seconds",
                        "music_language",
                        "music_vocal_mode",
                        "assistant_message",
                    ],
                    "additionalProperties": False,
                },
            },
        },
    ]


def choose_chat_tool_call(payload: ChatGenerateRequest) -> ChatToolDecision:
    """
    채팅 요청을 읽고 모델이 직접 도구 하나를 고르게 한다.

    Args:
        payload: 사용자 채팅 요청

    Returns:
        모델이 선택한 도구와 인자
    """

    client = _get_client()
    response = client.chat.completions.create(
        model="gpt-5-mini",
        tool_choice="required",
        tools=_chat_tool_schemas(),
        messages=[
            {
                "role": "system",
                "content": """
너는 장사한컷의 채팅 에이전트다.
사용자 요청을 읽고 반드시 도구 하나만 호출해야 한다.
규칙표처럼 단순 분기하지 말고 요청의 목적을 읽고 판단한다.
가능하면 바로 생성하고, 정말 정보가 부족할 때만 ask_for_more_info를 호출한다.
이미지면 generate_image, 영상이면 generate_video, 음악이면 generate_music를 고른다.
사용자가 명시하지 않은 값은 문맥에 맞게 자연스럽게 보완한다.
어려운 영어 표현은 쓰지 말고 한국어 중심으로 채운다.
영상 길이는 1초 이상 40초 이하 정수만 사용한다.
보컬 방식은 instrumental 또는 vocal만 사용한다.
해상도도 사용자가 말하면 도구 인자로 채운다.
채팅에서 해상도를 말하지 않으면 기본값을 유지한다.
기본값은 배너 1280x720, 상세 이미지 720x1280, 영상 832x480 이다.
사용자가 쇼츠, 세로, 9:16, 1080x1920 같은 표현을 쓰면 영상 해상도에 반영한다.
사용자가 배너 크기나 상세 이미지 크기를 따로 말하면 해당 값도 반영한다.
""".strip(),
            },
            {
                "role": "user",
                "content": f"""
사용자 메시지:
{payload.message}

이미 채워진 보조 입력값:
{json.dumps(payload.model_dump(), ensure_ascii=False, indent=2)}
""".strip(),
            },
        ],
    )
    message = response.choices[0].message
    if not message.tool_calls:
        raise ValueError("채팅 에이전트가 도구를 선택하지 못했습니다.")
    tool_call = message.tool_calls[0]
    arguments = json.loads(tool_call.function.arguments or "{}")
    return ChatToolDecision(tool_name=tool_call.function.name, arguments=arguments)


def generate_copy_with_llm(payload: ProjectCreateRequest) -> dict[str, str | list[str]]:
    """
    실제 생성 도구에 넣을 광고 문구 묶음을 LLM으로 만든다.

    Args:
        payload: 생성 요청 데이터

    Returns:
        광고 문구와 음악/영상 설명이 담긴 딕셔너리
    """

    system_prompt = """
너는 소상공인 광고 생성 툴의 카피 에이전트다.
사용자 요청을 바탕으로 광고 문구 묶음을 만든다.
어려운 영어를 남발하지 말고, 실제 배너/영상/음악 생성에 바로 쓸 수 있게 분명하게 쓴다.
반드시 JSON만 출력한다.
image_prompt, detail_image_prompt, logo_image_prompt, video_prompt는 모델 생성용 프롬프트다.
이 네 값은 한국어 설명을 그대로 복사하지 말고, 이미지/영상 생성 모델이 잘 알아듣는 짧고 구체적인 영어 프롬프트로 작성한다.
즉 사용자 입력이 한국어여도 생성용 프롬프트는 영어 중심으로 번역해서 써라.
반대로 headline, subheads, detail_headline, short_social_copies는 사람이 보는 한국어 카피다.
music_prompt는 ACE-Step 1.5에 넘길 음악 질의문이다.
사용자 입력을 그대로 복붙하지 말고, 음악 스타일이 잘 드러나는 짧은 한국어 설명으로 정리하라.
보컬 모드에서 사용자가 직접 가사를 쓰지 않았으면, music_lyrics를 반드시 생성하라.
가사는 사용자가 지정한 언어를 따르고, 짧은 구조 태그([Verse], [Hook])를 붙여라.
가사는 발음하기 쉬운 짧은 문장 위주로 쓰고, 광고용 짧은 음악 길이에 맞게 과도하게 길게 쓰지 마라.
사용자가 직접 가사를 썼다면 그 가사를 최대한 유지하고, 새로 쓰지 마라.
ACE-Step 5Hz LM은 BPM, 조성, 박자, 언어 보정과 conditioning 보조를 맡는다.
music_vocal_mode는 결정하지 마라. 사용자가 고른 값을 백엔드가 그대로 유지한다.

반환 형식:
{
  "headline": "...",
  "subheads": ["...", "..."],
  "detail_headline": "...",
  "short_social_copies": ["...", "..."],
  "image_prompt": "english generation prompt ...",
  "detail_image_prompt": "english generation prompt ...",
  "logo_image_prompt": "english generation prompt ...",
  "video_prompt": "english generation prompt ...",
  "music_prompt": "음악 생성 질의문",
  "music_lyrics": "...",
  "video_script": "..."
}
"""

    user_prompt = f"""
다음 입력값을 바탕으로 광고 카피를 만들어라.

{json.dumps(payload.model_dump(), ensure_ascii=False, indent=2)}
"""

    copy_data = _request_json(system_prompt, user_prompt)
    return {
        "headline": str(copy_data.get("headline", "")).strip(),
        "subheads": [
            str(item).strip()
            for item in copy_data.get("subheads", [])
            if str(item).strip()
        ],
        "detail_headline": str(copy_data.get("detail_headline", "")).strip(),
        "short_social_copies": [
            str(item).strip()
            for item in copy_data.get("short_social_copies", [])
            if str(item).strip()
        ],
        "image_prompt": str(copy_data.get("image_prompt", "")).strip(),
        "detail_image_prompt": str(copy_data.get("detail_image_prompt", "")).strip(),
        "logo_image_prompt": str(copy_data.get("logo_image_prompt", "")).strip(),
        "video_prompt": str(copy_data.get("video_prompt", "")).strip(),
        "music_prompt": str(copy_data.get("music_prompt", "")).strip(),
        "music_lyrics": str(copy_data.get("music_lyrics", "")).strip(),
        "music_vocal_mode": payload.music_vocal_mode,
        "video_script": str(copy_data.get("video_script", "")).strip(),
    }
