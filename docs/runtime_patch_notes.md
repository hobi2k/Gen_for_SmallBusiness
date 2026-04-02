# 런타임 패치 정리

## 1. `nunchaku` + `diffusers` 시그니처 보정
- 위치: [backend/app/tools/image_tool.py](../backend/app/tools/image_tool.py)
- 함수: `_patch_nunchaku_runtime`
- 이유:
  - 현재 설치된 `diffusers`의 `ZImageTransformer2DModel.forward` 시그니처와
  - `nunchaku`의 `NunchakuZImageTransformer2DModel.forward` 시그니처가 달라서
  - 실제 이미지 생성 시 `controlnet_block_samples` 인자 처리에서 실패했다.
- 조치:
  - 런타임에서 `forward`를 현재 `diffusers` 시그니처에 맞게 보정한다.

## 2. `nunchaku` precision 강제값 보정
- 위치: [backend/app/tools/image_tool.py](../backend/app/tools/image_tool.py)
- 함수: `_patch_nunchaku_runtime`
- 이유:
  - `from_pretrained(..., precision=...)`를 넘겨도
  - 내부에서 강제값을 무시하는 경우가 있었다.
- 조치:
  - `NUNCHAKU_PRECISION_OVERRIDE`를 사용할 때
  - 내부 `get_precision` 호출이 강제값을 반영하도록 런타임에서 보정한다.

## 3. `ACE-Step` 체크포인트 경로 보정
- 위치: [backend/app/tools/music_tool.py](../backend/app/tools/music_tool.py)
- 이유:
  - 프로젝트 모델 디렉토리 바로 아래가 아니라
  - Hugging Face snapshot 하위 경로를 실제 체크포인트 루트로 찾아야 했다.
- 조치:
  - snapshot 내부 실제 체크포인트 경로를 찾아 워커에 넘긴다.

## 4. `ACE-Step` 저장 백엔드 보정
- 위치: [backend/app/tools/music_tool.py](../backend/app/tools/music_tool.py)
- 이유:
  - 기본 저장 경로에서 `torchcodec` 로딩 문제로 저장이 실패했다.
- 조치:
  - 후처리 단계에서 실제 `wav` 저장이 끝까지 가도록 저장 경로를 정리했다.

## 5. `Wan TI2V` 실행 의존성 보정
- 위치: [pyproject.toml](../pyproject.toml)
- 이유:
  - `WanImageToVideoPipeline` 실행에 `ftfy`가 필요했고
  - 영상 내보내기에 `imageio`, `imageio-ffmpeg`가 필요했다.
- 조치:
  - AI 의존성 목록에 필요한 패키지를 추가했다.

## 6. 채팅 폼 reset 오류 보정
- 위치: [frontend/components/chat-panel.tsx](../frontend/components/chat-panel.tsx)
- 이유:
  - `await` 이후 `event.currentTarget.reset()`를 직접 호출하면서
  - 브라우저에서 `null` 참조 오류가 났다.
- 조치:
  - 폼 참조를 먼저 저장하고 `form.reset()`으로 바꿨다.
