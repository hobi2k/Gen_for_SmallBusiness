# 아키텍처 문서

## 1. 전체 구조
- 프론트엔드: `frontend/`의 Next.js 앱
- 백엔드: `backend/app/`의 FastAPI 앱
- 저장소: `SQLite + storage/projects/`
- 생성 흐름: 오케스트레이터가 도구를 순서대로 호출

## 2. 도구 호출 흐름
1. `validate_input`
2. `generate_copy`
3. `generate_banner_images`
4. `generate_detail_images`
5. `generate_logo_drafts`
6. `select_key_visual`
7. `generate_short_video`
8. `generate_music`
9. `compose_final_video`
10. `save_project_assets`

## 3. 영상 경로 분기
- 이미지가 있으면 `Wan2.2-TI2V-5B`의 이미지 기반 경로 사용
- 이미지가 없으면 `Wan2.2-TI2V-5B`의 텍스트 기반 경로 사용
- 추후 대본 기반 영상은 `CosyVoice + S2V` 경로로 확장 가능

## 4. 실행 경로
- 백엔드: `uv run uvicorn backend.app.main:app --reload`
- 프론트엔드: `cd frontend && npm run dev`
