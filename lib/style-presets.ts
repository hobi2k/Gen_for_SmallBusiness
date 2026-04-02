import { StyleId, StylePreset } from "@/lib/types";

export const STYLE_PRESETS: Record<StyleId, StylePreset> = {
  "modern-minimal": {
    id: "modern-minimal",
    name: "모던 미니멀",
    summary: "베이지와 아이보리 톤의 정돈된 모던 다이닝 공간에서 절제된 여백을 강조하는 스타일",
    lightingDescription: "큰 창에서 들어오는 부드러운 자연광과 매립 간접조명을 함께 사용하고 그림자는 얕게 유지한다.",
    sceneSetup:
      "밝은 베이지 벽과 붙박이 수납이 있는 모던 키친 다이닝에서 매트한 상판을 전면에 두고 제품을 간결하게 배치한다.",
    colorTone: "아이보리, 웜 베이지, 소프트 그레이",
    promptTemplate:
      "업로드된 {{product_category}}의 형태와 재질감을 유지한다. 모던 미니멀 무드의 상업용 감성 컷. 넓은 여백, 정돈된 구도, 군더더기 없는 소품, 매트한 표면, 절제된 레이어, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, photorealistic, premium ecommerce, no text, no watermark.",
    promptKeywords: [
      "clean composition",
      "white background",
      "soft shadow",
      "minimal objects",
      "product centered"
    ],
    copyTone: "절제되고 선명한 어조. 짧고 정돈된 문장으로 제품의 윤곽을 또렷하게 드러낸다.",
    palette: ["#f4efe6", "#d7d1c7", "#5f5a54"],
    fitSignals: ["plate", "tray", "cutlery", "glassware"],
    sceneProfile: {
      spaceType: "beige-toned modern kitchen dining room with clean built-in cabinetry and wide windows",
      tableSurface: "matte stone or pale wood dining tabletop with generous empty surface",
      requiredElements: ["visible dining table", "clear tabletop in the foreground", "empty placement zone on the tabletop"],
      backgroundElements: "subtle built-in cabinets, recessed linear lighting, soft curtains, minimal chairs",
      accentProps: ["single vase", "one understated pendant light", "minimal dining chair"],
      composition: "front-facing or gentle three-quarter view where the tabletop dominates the lower half and the room stays secondary",
      prohibitedElements: ["sofa lounge area", "tv wall", "living room coffee table", "bedroom furniture", "outdoor scenery as main focus"]
    }
  },
  "natural-wood": {
    id: "natural-wood",
    name: "내추럴 우드",
    summary: "원목 천장과 오크 가구, 부드러운 자연광으로 편안한 주방 생활감을 살리는 스타일",
    lightingDescription: "아침 햇살 같은 따뜻한 자연광을 목재 표면에 부드럽게 퍼뜨리고 명암은 완만하게 유지한다.",
    sceneSetup:
      "오크 또는 월넛 상판이 넓게 보이는 키친 다이닝에서 린넨과 라탄 소품을 절제해 배치한다.",
    colorTone: "허니 브라운, 오트밀, 세이지 그린",
    promptTemplate:
      "업로드된 {{product_category}}를 중심으로 내추럴 우드 스타일의 생활감 있는 연출을 만든다. 원목 질감이 살아 있는 테이블, 린넨 패브릭, 과하지 않은 식물 포인트, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, realistic product photography, preserve product identity, no text, no watermark.",
    promptKeywords: ["wooden table", "linen fabric", "warm natural light", "earthy tone"],
    copyTone: "따뜻하고 편안한 자연주의 어조. 손에 닿는 감촉과 일상적인 사용감을 떠올리게 한다.",
    palette: ["#f4e3c8", "#c79663", "#7c8b62"],
    fitSignals: ["plate", "bowl", "tray", "cutlery"],
    sceneProfile: {
      spaceType: "warm wooden kitchen-dining interior with oak millwork, slatted walls, beams, and calm daylight",
      tableSurface: "broad oak or walnut dining tabletop with visible grain and a stable flat placement zone",
      requiredElements: ["visible wooden dining table", "wide tabletop plane in the lower foreground", "empty tabletop placement zone"],
      backgroundElements: "wood shelving, woven pendant lights, light linen curtains, restrained greenery",
      accentProps: ["folded linen cloth", "woven placemat", "small ceramic vase", "rattan pendant"],
      composition: "tabletop anchored in the foreground with the kitchen shelves softly receding behind it",
      prohibitedElements: ["formal salon seating", "marble luxury lobby", "dark bar interior", "window-view lounge", "bedroom scene"]
    }
  },
  "nordic-light": {
    id: "nordic-light",
    name: "북유럽 라이트톤",
    summary: "화이트와 라이트 우드 중심의 밝은 북유럽 다이닝 공간에서 공기감과 단정함을 강조하는 스타일",
    lightingDescription: "밝은 창가 확산광을 사용하고 전체 대비를 낮춰 맑고 차분한 분위기를 만든다.",
    sceneSetup:
      "화이트 오크 테이블과 밝은 석고 벽이 있는 북유럽 다이닝에 제품을 담백하게 놓는다.",
    colorTone: "소프트 화이트, 라이트 우드, 페일 그레이 블루",
    promptTemplate:
      "업로드된 {{product_category}}를 북유럽 라이트톤 공간에 배치한다. 밝은 목재, 맑은 화이트 패브릭, 깨끗한 공기감, 담백한 소품 배치, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, premium lifestyle commerce shot, natural realism, no text, no watermark.",
    promptKeywords: [
      "bright lighting",
      "white + gray palette",
      "simple and functional",
      "airy feeling"
    ],
    copyTone: "맑고 산뜻한 어조. 깨끗함, 기능성, 밝은 분위기를 전면에 둔다.",
    palette: ["#f8f7f3", "#dcc7aa", "#b8ced6"],
    fitSignals: ["glassware", "cup", "plate", "bowl"],
    sceneProfile: {
      spaceType: "airy nordic kitchen-dining space with white walls, pale wood furniture, and crisp daylight",
      tableSurface: "light oak dining tabletop or pale stone surface with a clean uncluttered foreground",
      requiredElements: ["visible nordic dining table", "clear tabletop surface in the foreground", "empty center-front placement zone on the table"],
      backgroundElements: "white brick or plaster walls, simple pendant lights, slim chairs, sparse plants",
      accentProps: ["single white vase", "light fabric runner", "simple pendant lamp"],
      composition: "bright open framing with the tabletop clearly leading the scene and background decor kept minimal",
      prohibitedElements: ["dark lounge seating", "ornate chandeliers", "heavy drapery", "hotel lobby", "living room sofa composition"]
    }
  },
  "french-vintage": {
    id: "french-vintage",
    name: "프렌치 빈티지",
    summary: "몰딩, 앤티크 거울, 크림 톤 목가구가 있는 우아한 클래식 다이닝 무드를 살리는 스타일",
    lightingDescription: "부드러운 주간광에 약한 필름성 질감을 더하고 하이라이트는 부드럽게 유지한다.",
    sceneSetup:
      "크림색 패널 벽과 클래식 체어가 있는 프렌치 다이닝 테이블 위에 제품을 우아하게 놓는다.",
    colorTone: "크림, 그레이지, 더스티 로즈",
    promptTemplate:
      "업로드된 {{product_category}}의 실제 제품 특징을 유지하면서 프렌치 빈티지 무드로 연출한다. 오래된 원목 가구, 부드러운 패브릭 주름, 우아한 앤티크 디테일, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, romantic but realistic product photography, no text, no watermark.",
    promptKeywords: [
      "soft pastel tones",
      "antique texture",
      "elegant table setting",
      "classic props"
    ],
    copyTone: "우아하고 은은한 어조. 로맨틱하지만 과하지 않게 클래식 무드를 전달한다.",
    palette: ["#f3e7db", "#c39b98", "#8a6c57"],
    fitSignals: ["plate", "bowl", "cup", "tray"],
    sceneProfile: {
      spaceType: "french vintage dining room with cream mouldings, antique mirrors, and elegant classic table setting",
      tableSurface: "light painted wood or antique dining tabletop with refined empty placement space",
      requiredElements: ["visible classic dining table", "clear tabletop plane with empty placement zone", "tabletop occupying the lower foreground"],
      backgroundElements: "ornate wall mouldings, chandelier glow, vintage chairs, muted floral arrangement",
      accentProps: ["small floral bouquet", "classic candlestick", "linen napkin", "antique mirror"],
      composition: "elegant dining-table perspective with the tabletop foreground clear and the ornamented room softened behind it",
      prohibitedElements: ["modern sectional sofa", "tv lounge", "plain office interior", "outdoor terrace", "bedroom vanity scene"]
    }
  },
  "cozy-home-cafe": {
    id: "cozy-home-cafe",
    name: "코지 홈카페",
    summary: "호박빛 조명과 카페 선반, 우드 테이블로 포근한 홈카페 무드를 만드는 스타일",
    lightingDescription: "텅스텐 계열의 따뜻한 실내광을 사용하고 그림자는 부드럽고 짙지 않게 유지한다.",
    sceneSetup:
      "우드 테이블이 전면에 보이는 홈카페 코너에 커피 도구와 디저트 흔적을 은근하게 남긴다.",
    colorTone: "카라멜 브라운, 크림, 다크 초콜릿",
    promptTemplate:
      "업로드된 {{product_category}}를 코지 홈카페 분위기의 감성 장면에 배치한다. 포근한 우드 테이블, 커피와 디저트가 암시되는 구성, 따뜻한 생활감, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, realistic lifestyle commerce image, preserve exact product identity, no text, no watermark.",
    promptKeywords: ["warm light", "coffee mood", "dessert props", "cozy atmosphere"],
    copyTone: "포근하고 친근한 어조. 일상 속 휴식과 홈카페 감성을 자연스럽게 강조한다.",
    palette: ["#f5eadc", "#cb9d6f", "#7a573b"],
    fitSignals: ["cup", "glassware", "tray", "plate"],
    sceneProfile: {
      spaceType: "warm home-cafe kitchen corner with amber lighting, wood shelving, and intimate dining atmosphere",
      tableSurface: "warm mid-tone wood tabletop or café table with a clear near-front placement area",
      requiredElements: ["visible cafe-style dining table", "clear wooden tabletop in the foreground", "empty placement zone kept free on the table"],
      backgroundElements: "coffee tools, chalkboard accents, tiled backsplash, wood shelves, soft lamps",
      accentProps: ["coffee dripper", "small pastry plate", "table lamp", "ceramic mug in background kept subtle"],
      composition: "close tabletop framing where the dining surface is dominant and the café details remain softly secondary",
      prohibitedElements: ["bright living room sofa", "open scenic lounge", "empty luxury salon", "bedroom decor", "wide landscape window view"]
    }
  },
  "japanese-simple-table": {
    id: "japanese-simple-table",
    name: "일본식 담백한 식탁",
    summary: "낮은 목재 테이블과 쇼지 창, 절제된 선으로 정갈한 식탁 무드를 만드는 스타일",
    lightingDescription: "잔잔하고 균일한 자연광을 사용하고 채도와 대비는 모두 낮게 유지한다.",
    sceneSetup:
      "낮은 목재 테이블 또는 정갈한 다이닝 상판 위에 최소한의 소품만 두고 제품을 둔다.",
    colorTone: "오프화이트, 애쉬 우드, 먹색, 올리브 그레이",
    promptTemplate:
      "업로드된 {{product_category}}를 일본식 담백한 식탁 무드로 연출한다. 절제된 상차림, 낮은 채도, 정갈한 배치, 최소한의 소품, {{lighting_description}}, {{scene_setup}}, {{color_tone}}, clean realistic tabletop photography, preserve product form exactly, no text, no watermark.",
    promptKeywords: ["clean layout", "low saturation", "calm mood", "simple plating"],
    copyTone: "차분하고 담백한 어조. 과장 없이 정갈한 인상과 균형감을 전달한다.",
    palette: ["#f1efe7", "#b8b2a3", "#494743"],
    fitSignals: ["bowl", "plate", "cup", "cutlery"],
    sceneProfile: {
      spaceType: "quiet japanese dining room with shoji screens, low wood table, and restrained natural materials",
      tableSurface: "low wooden dining tabletop with clean grain and a wide uncluttered placement area",
      requiredElements: ["visible low dining table", "clear tabletop surface with empty foreground zone", "placement area centered on the table"],
      backgroundElements: "shoji panels, tatami-like textures, simple ceramics, low seating, soft paper lantern light",
      accentProps: ["linen runner", "single branch vase", "small ceramic bowl", "subtle tea utensil"],
      composition: "calm low-table perspective with balanced negative space and the tabletop clearly defining the foreground",
      prohibitedElements: ["western sofa lounge", "grand chandelier salon", "busy open kitchen", "outdoor garden view as hero", "high dining bar counter"]
    }
  }
};

export const STYLE_LIST = Object.values(STYLE_PRESETS);
