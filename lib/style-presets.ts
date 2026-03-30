import { StyleId, StylePreset } from "@/lib/types";

export const STYLE_PRESETS: Record<StyleId, StylePreset> = {
  "modern-minimal": {
    id: "modern-minimal",
    name: "모던 미니멀",
    summary: "정제된 여백과 단단한 구도로 상품을 또렷하게 보여주는 스타일",
    lightingDescription: "부드러운 확산광을 사용하고 그림자는 얕고 짧게 유지한다.",
    sceneSetup:
      "여백이 넓은 스튜디오형 식탁 또는 매트한 상판 위에 제품만 또렷하게 배치한다.",
    colorTone: "웜 그레이, 아이보리, 차콜 포인트",
    promptTemplate:
      "업로드된 {{product_category}}의 형태와 재질감을 유지한다. 모던 미니멀 무드의 상업용 감성 컷. 넓은 여백, 정돈된 구도, 군더더기 없는 소품, 매트한 표면, 절제된 레이어, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, photorealistic, premium ecommerce, no text, no watermark.",
    palette: ["#f4efe6", "#d7d1c7", "#5f5a54"],
    fitSignals: ["plate", "tray", "cutlery", "glassware"]
  },
  "natural-wood": {
    id: "natural-wood",
    name: "내추럴 우드",
    summary: "원목 질감과 따뜻한 자연광으로 생활감 있게 보여주는 스타일",
    lightingDescription: "오전 햇살 느낌의 따뜻한 자연광을 부드럽게 확산시킨다.",
    sceneSetup:
      "오크 또는 월넛 테이블 위에 린넨 천과 나무 질감 소품을 최소한으로 배치한다.",
    colorTone: "베이지, 허니 브라운, 세이지",
    promptTemplate:
      "업로드된 {{product_category}}를 중심으로 내추럴 우드 스타일의 생활감 있는 연출을 만든다. 원목 질감이 살아 있는 테이블, 린넨 패브릭, 과하지 않은 식물 포인트, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, realistic product photography, preserve product identity, no text, no watermark.",
    palette: ["#f4e3c8", "#c79663", "#7c8b62"],
    fitSignals: ["plate", "bowl", "tray", "cutlery"]
  },
  "nordic-light": {
    id: "nordic-light",
    name: "북유럽 라이트톤",
    summary: "맑은 공기감과 라이트 우드 톤으로 깨끗하게 정리된 스타일",
    lightingDescription: "창가에서 들어오는 밝고 맑은 확산광을 사용한다.",
    sceneSetup:
      "화이트 오크 가구와 밝은 패브릭이 있는 정갈한 다이닝 공간에 제품을 놓는다.",
    colorTone: "소프트 화이트, 라이트 우드, 페일 블루",
    promptTemplate:
      "업로드된 {{product_category}}를 북유럽 라이트톤 공간에 배치한다. 밝은 목재, 맑은 화이트 패브릭, 깨끗한 공기감, 담백한 소품 배치, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, premium lifestyle commerce shot, natural realism, no text, no watermark.",
    palette: ["#f8f7f3", "#dcc7aa", "#b8ced6"],
    fitSignals: ["glassware", "cup", "plate", "bowl"]
  },
  "french-vintage": {
    id: "french-vintage",
    name: "프렌치 빈티지",
    summary: "클래식한 패브릭과 앤티크 가구로 우아한 무드를 만드는 스타일",
    lightingDescription: "오후의 부드러운 측면광과 약간의 필름성 질감을 더한다.",
    sceneSetup:
      "빈티지 원목 가구와 클래식 패브릭이 있는 식탁에 앤티크 소품을 절제해 배치한다.",
    colorTone: "크림, 더스티 로즈, 앤티크 브라운",
    promptTemplate:
      "업로드된 {{product_category}}의 실제 제품 특징을 유지하면서 프렌치 빈티지 무드로 연출한다. 오래된 원목 가구, 부드러운 패브릭 주름, 우아한 앤티크 디테일, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, romantic but realistic product photography, no text, no watermark.",
    palette: ["#f3e7db", "#c39b98", "#8a6c57"],
    fitSignals: ["plate", "bowl", "cup", "tray"]
  },
  "cozy-home-cafe": {
    id: "cozy-home-cafe",
    name: "코지 홈카페",
    summary: "포근한 실내광과 커피 무드로 일상 사용 장면을 강조하는 스타일",
    lightingDescription: "따뜻하고 포근한 실내광을 사용하고 음영은 부드럽게 유지한다.",
    sceneSetup:
      "홈카페 테이블 위에 커피 도구와 베이커리 소품이 은근하게 보이도록 배치한다.",
    colorTone: "크림, 카라멜, 코코아 브라운",
    promptTemplate:
      "업로드된 {{product_category}}를 코지 홈카페 분위기의 감성 장면에 배치한다. 포근한 우드 테이블, 커피와 디저트가 암시되는 구성, 따뜻한 생활감, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, realistic lifestyle commerce image, preserve exact product identity, no text, no watermark.",
    palette: ["#f5eadc", "#cb9d6f", "#7a573b"],
    fitSignals: ["cup", "glassware", "tray", "plate"]
  },
  "japanese-simple-table": {
    id: "japanese-simple-table",
    name: "일본식 담백한 식탁",
    summary: "낮은 채도와 절제된 상차림으로 제품의 선을 살리는 스타일",
    lightingDescription: "잔잔하고 균일한 자연광을 사용하고 대비는 낮게 유지한다.",
    sceneSetup:
      "절제된 상차림의 단정한 식탁 위에 최소한의 소품만 두고 제품을 배치한다.",
    colorTone: "오프화이트, 애쉬 우드, 먹색",
    promptTemplate:
      "업로드된 {{product_category}}를 일본식 담백한 식탁 무드로 연출한다. 절제된 상차림, 낮은 채도, 정갈한 배치, 최소한의 소품, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, clean realistic tabletop photography, preserve product form exactly, no text, no watermark.",
    palette: ["#f1efe7", "#b8b2a3", "#494743"],
    fitSignals: ["bowl", "plate", "cup", "cutlery"]
  }
};

export const STYLE_LIST = Object.values(STYLE_PRESETS);
