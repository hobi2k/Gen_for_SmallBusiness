"""채팅 에이전트 흐름을 LangGraph와 도구 호출로 실행하는 서비스 모듈"""

from __future__ import annotations

from functools import lru_cache
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from backend.app.schemas.chat import ChatGenerateRequest, ChatGenerateResponse
from backend.app.schemas.project import ProjectCreateRequest
from backend.app.services import llm_agent_service
from backend.app.services.generation_service import (
    create_validated_request,
    generate_image_asset_bundle,
    generate_music_asset_bundle,
    generate_video_asset_bundle,
)


class ChatAgentState(TypedDict, total=False):
    """
    채팅 에이전트 그래프에서 공유하는 상태 값이다.
    """

    payload: ChatGenerateRequest
    tool_decision: llm_agent_service.ChatToolDecision
    request: ProjectCreateRequest
    response: ChatGenerateResponse
def _build_project_request(
    payload: ChatGenerateRequest,
    tool_decision: llm_agent_service.ChatToolDecision,
) -> ProjectCreateRequest:
    """
    모델이 호출한 도구 인자를 실제 생성 요청 객체로 변환한다.

    Args:
        payload: 원본 채팅 요청
        tool_decision: 모델이 선택한 도구와 인자

    Returns:
        검증된 프로젝트 요청 객체
    """

    arguments = tool_decision.arguments
    product_name = str(
        payload.product_name or arguments.get("product_name") or "채팅 생성 요청"
    ).strip()
    prompt = str(payload.prompt or arguments.get("prompt") or payload.message).strip()
    banner_width = int(arguments.get("banner_width", payload.banner_width))
    banner_height = int(arguments.get("banner_height", payload.banner_height))
    detail_width = int(arguments.get("detail_width", payload.detail_width))
    detail_height = int(arguments.get("detail_height", payload.detail_height))
    video_width = int(arguments.get("video_width", payload.video_width))
    video_height = int(arguments.get("video_height", payload.video_height))
    video_duration_seconds = int(
        arguments.get("video_duration_seconds", payload.video_duration_seconds)
    )
    music_language = str(
        payload.music_language or arguments.get("music_language") or "ko"
    ).strip()
    music_vocal_mode = str(
        payload.music_vocal_mode or arguments.get("music_vocal_mode") or "instrumental"
    ).strip()
    request = ProjectCreateRequest(
        product_name=product_name,
        prompt=prompt,
        tone=str(payload.tone or arguments.get("tone") or "깔끔한 판매형").strip(),
        banner_width=banner_width,
        banner_height=banner_height,
        detail_width=detail_width,
        detail_height=detail_height,
        video_width=video_width,
        video_height=video_height,
        video_duration_seconds=video_duration_seconds,
        image_paths=payload.image_paths,
        include_music=bool(arguments.get("include_music", payload.include_music)),
        music_language=music_language,
        music_lyrics=str(payload.music_lyrics or arguments.get("music_lyrics") or "").strip(),
        music_vocal_mode=music_vocal_mode,
    )
    return create_validated_request(request)


def _assistant_message(
    tool_decision: llm_agent_service.ChatToolDecision,
    default_message: str,
) -> str:
    """
    도구 인자 안의 사용자용 문구를 읽고 없으면 기본 문구를 돌려준다.

    Args:
        tool_decision: 모델이 선택한 도구 호출
        default_message: 기본 응답 문구

    Returns:
        사용자에게 보여줄 응답 문구
    """

    message = str(tool_decision.arguments.get("assistant_message") or "").strip()
    return message or default_message


def _model_step(state: ChatAgentState) -> ChatAgentState:
    """
    LLM에게 현재 채팅 요청을 넘겨 도구 호출 하나를 받는다.

    Args:
        state: 현재 그래프 상태

    Returns:
        도구 호출 결과가 포함된 상태
    """

    payload = state["payload"]
    tool_decision = llm_agent_service.choose_chat_tool_call(payload)
    return {"tool_decision": tool_decision}


def _route_tool(state: ChatAgentState) -> str:
    """
    모델이 호출한 도구 이름으로 다음 노드를 결정한다.

    Args:
        state: 현재 그래프 상태

    Returns:
        다음 노드 이름
    """

    tool_name = state["tool_decision"].tool_name
    if tool_name == "ask_for_more_info":
        return "ask_for_more_info"
    if tool_name == "generate_video":
        return "run_video_generation"
    if tool_name == "generate_music":
        return "run_music_generation"
    return "run_image_generation"


def _ask_for_more_info_node(state: ChatAgentState) -> ChatAgentState:
    """
    모델이 추가 질문 도구를 호출했을 때 응답을 만든다.

    Args:
        state: 현재 그래프 상태

    Returns:
        추가 질문 응답이 포함된 상태
    """

    question = str(state["tool_decision"].arguments.get("question") or "").strip()
    response = ChatGenerateResponse(
        status="needs_input",
        intent="needs_input",
        assistant_message=question or "어떤 결과를 원하시는지 조금만 더 알려주세요.",
        project_root="",
        asset_paths={},
    )
    return {"response": response}


def _run_image_generation_node(state: ChatAgentState) -> ChatAgentState:
    """
    이미지 생성 도구를 실행하고 응답을 만든다.

    Args:
        state: 현재 그래프 상태

    Returns:
        생성 응답이 포함된 상태
    """

    payload = state["payload"]
    tool_decision = state["tool_decision"]
    request = _build_project_request(payload, tool_decision)
    asset_paths = generate_image_asset_bundle(request)
    response = ChatGenerateResponse(
        status="completed",
        intent="image",
        assistant_message=_assistant_message(tool_decision, "이미지를 만들었습니다."),
        project_root=str(asset_paths["project_root"]),
        asset_paths=asset_paths,
    )
    return {"request": request, "response": response}


def _run_video_generation_node(state: ChatAgentState) -> ChatAgentState:
    """
    영상 생성 도구를 실행하고 응답을 만든다.

    Args:
        state: 현재 그래프 상태

    Returns:
        생성 응답이 포함된 상태
    """

    payload = state["payload"]
    tool_decision = state["tool_decision"]
    request = _build_project_request(payload, tool_decision)
    asset_paths = generate_video_asset_bundle(request)
    response = ChatGenerateResponse(
        status="completed",
        intent="video",
        assistant_message=_assistant_message(tool_decision, "영상을 만들었습니다."),
        project_root=str(asset_paths["project_root"]),
        asset_paths=asset_paths,
    )
    return {"request": request, "response": response}


def _run_music_generation_node(state: ChatAgentState) -> ChatAgentState:
    """
    음악 생성 도구를 실행하고 응답을 만든다.

    Args:
        state: 현재 그래프 상태

    Returns:
        생성 응답이 포함된 상태
    """

    payload = state["payload"]
    tool_decision = state["tool_decision"]
    request = _build_project_request(payload, tool_decision)
    asset_paths = generate_music_asset_bundle(request)
    response = ChatGenerateResponse(
        status="completed",
        intent="music",
        assistant_message=_assistant_message(tool_decision, "음악을 만들었습니다."),
        project_root=str(asset_paths["project_root"]),
        asset_paths=asset_paths,
    )
    return {"request": request, "response": response}


@lru_cache(maxsize=1)
def _build_chat_agent_graph():
    """
    채팅 에이전트용 LangGraph를 한 번만 구성한다.

    Returns:
        컴파일된 LangGraph 객체
    """

    graph = StateGraph(ChatAgentState)
    graph.add_node("model_step", _model_step)
    graph.add_node("ask_for_more_info", _ask_for_more_info_node)
    graph.add_node("run_image_generation", _run_image_generation_node)
    graph.add_node("run_video_generation", _run_video_generation_node)
    graph.add_node("run_music_generation", _run_music_generation_node)

    graph.add_edge(START, "model_step")
    graph.add_conditional_edges(
        "model_step",
        _route_tool,
        {
            "ask_for_more_info": "ask_for_more_info",
            "run_image_generation": "run_image_generation",
            "run_video_generation": "run_video_generation",
            "run_music_generation": "run_music_generation",
        },
    )
    graph.add_edge("ask_for_more_info", END)
    graph.add_edge("run_image_generation", END)
    graph.add_edge("run_video_generation", END)
    graph.add_edge("run_music_generation", END)
    return graph.compile()


def run_chat_generation(payload: ChatGenerateRequest) -> ChatGenerateResponse:
    """
    채팅 요청을 LangGraph 기반 도구 호출 에이전트로 실행한다.

    Args:
        payload: 채팅 기반 생성 요청

    Returns:
        생성 결과 응답
    """

    graph = _build_chat_agent_graph()
    result_state = graph.invoke({"payload": payload})
    response = result_state.get("response")
    if response is None:
        raise ValueError("채팅 에이전트 응답을 만들지 못했습니다.")
    return response
