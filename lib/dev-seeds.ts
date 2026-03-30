import { createSeedPreviewUrl } from "@/lib/image-output";
import { DevSeed } from "@/lib/types";
import { createUploadToken } from "@/lib/utils";

export const DEV_SEEDS: DevSeed[] = [
  {
    id: "seed-plate",
    title: "화이트 세라믹 접시",
    description: "밝은 무채색 식탁웨어 추천을 빠르게 검증하는 시드",
    previewUrl: createSeedPreviewUrl({
      category: "plate",
      colorCue: "white",
      materialCue: "ceramic"
    }),
    analysis: {
      uploadToken: createUploadToken(["seed-plate", "plate", "white", "ceramic"]),
      fileName: "white_ceramic_plate_seed.jpg",
      mimeType: "image/jpeg",
      fileSize: 0,
      category: "plate",
      categoryLabel: "접시",
      materialNotes: "세라믹, 매끈한 표면감",
      visualSummary: "화이트 세라믹 접시의 단정한 원형과 얇은 림이 또렷한 상품",
      colorHints: ["white", "neutral"],
      materialHints: ["ceramic"],
      surfaceTone: "cool",
      detectedTags: ["plate", "white", "neutral", "ceramic"]
    }
  },
  {
    id: "seed-bowl",
    title: "어스톤 볼",
    description: "낮은 채도와 담백한 식탁 스타일 추천을 검증하는 시드",
    previewUrl: createSeedPreviewUrl({
      category: "bowl",
      colorCue: "earthy",
      materialCue: "ceramic"
    }),
    analysis: {
      uploadToken: createUploadToken(["seed-bowl", "bowl", "earthy", "ceramic"]),
      fileName: "earthy_ceramic_bowl_seed.jpg",
      mimeType: "image/jpeg",
      fileSize: 0,
      category: "bowl",
      categoryLabel: "볼",
      materialNotes: "세라믹, 차분한 무광 표면감",
      visualSummary: "낮은 채도의 어스톤 볼로 깊이감 있는 곡선이 부드럽게 드러나는 상품",
      colorHints: ["earthy", "low-saturation"],
      materialHints: ["ceramic"],
      surfaceTone: "warm",
      detectedTags: ["bowl", "earthy", "low-saturation", "ceramic"]
    }
  },
  {
    id: "seed-cup",
    title: "크림 머그컵",
    description: "홈카페 계열 추천과 카피 톤 차이를 검증하는 시드",
    previewUrl: createSeedPreviewUrl({
      category: "cup",
      colorCue: "cream",
      materialCue: "ceramic"
    }),
    analysis: {
      uploadToken: createUploadToken(["seed-cup", "cup", "cream", "ceramic"]),
      fileName: "cream_mug_seed.jpg",
      mimeType: "image/jpeg",
      fileSize: 0,
      category: "cup",
      categoryLabel: "컵",
      materialNotes: "세라믹, 부드러운 유광 표면감",
      visualSummary: "크림 톤 머그컵으로 손잡이 곡선과 포근한 인상이 살아 있는 상품",
      colorHints: ["cream", "beige"],
      materialHints: ["ceramic"],
      surfaceTone: "warm",
      detectedTags: ["cup", "cream", "beige", "ceramic"]
    }
  },
  {
    id: "seed-glassware",
    title: "투명 유리잔",
    description: "투명감과 밝은 톤 중심 추천을 검증하는 시드",
    previewUrl: createSeedPreviewUrl({
      category: "glassware",
      colorCue: "clear",
      materialCue: "glass"
    }),
    analysis: {
      uploadToken: createUploadToken(["seed-glassware", "glassware", "clear", "glass"]),
      fileName: "clear_glass_seed.jpg",
      mimeType: "image/jpeg",
      fileSize: 0,
      category: "glassware",
      categoryLabel: "유리잔",
      materialNotes: "유리, 맑은 투명감",
      visualSummary: "투명한 유리잔의 가벼운 실루엣과 맑은 반사광이 강조되는 상품",
      colorHints: ["clear", "white"],
      materialHints: ["glass"],
      surfaceTone: "cool",
      detectedTags: ["glassware", "clear", "white", "glass"]
    }
  },
  {
    id: "seed-tray",
    title: "우드 트레이",
    description: "우드 소재 기반 reranking을 검증하는 시드",
    previewUrl: createSeedPreviewUrl({
      category: "tray",
      colorCue: "brown",
      materialCue: "wood"
    }),
    analysis: {
      uploadToken: createUploadToken(["seed-tray", "tray", "brown", "wood"]),
      fileName: "wood_tray_seed.jpg",
      mimeType: "image/jpeg",
      fileSize: 0,
      category: "tray",
      categoryLabel: "트레이",
      materialNotes: "우드, 따뜻한 결감",
      visualSummary: "브라운 톤 우드 트레이로 평평한 면과 둥근 모서리가 안정적으로 보이는 상품",
      colorHints: ["brown", "earthy"],
      materialHints: ["wood"],
      surfaceTone: "warm",
      detectedTags: ["tray", "brown", "earthy", "wood"]
    }
  },
  {
    id: "seed-cutlery",
    title: "실버 커트러리",
    description: "메탈 광택과 미니멀/담백 계열 추천을 검증하는 시드",
    previewUrl: createSeedPreviewUrl({
      category: "cutlery",
      colorCue: "gray",
      materialCue: "metal"
    }),
    analysis: {
      uploadToken: createUploadToken(["seed-cutlery", "cutlery", "gray", "metal"]),
      fileName: "silver_cutlery_seed.jpg",
      mimeType: "image/jpeg",
      fileSize: 0,
      category: "cutlery",
      categoryLabel: "커트러리",
      materialNotes: "메탈, 단정한 광택",
      visualSummary: "실버 커트러리의 슬림한 라인과 반사광이 간결하게 보이는 상품",
      colorHints: ["gray", "neutral"],
      materialHints: ["metal"],
      surfaceTone: "cool",
      detectedTags: ["cutlery", "gray", "neutral", "metal"]
    }
  }
];
