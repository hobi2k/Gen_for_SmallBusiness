import { ChangeEvent } from "react";

import {
  ProductCategory,
  ProductColorCue,
  ProductInputOverrides,
  ProductMaterialCue,
  ProductSurfaceTone
} from "@/lib/types";

interface UploadPanelProps {
  file: File | null;
  activeSeedId: string | null;
  previewUrl: string | null;
  recommending: boolean;
  inputOverrides: ProductInputOverrides;
  onInputOverridesChange: (patch: Partial<ProductInputOverrides>) => void;
  onApplyInputOverrides: () => Promise<void>;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

const CATEGORY_OPTIONS: Array<{ value: ProductCategory; label: string }> = [
  { value: "plate", label: "접시" },
  { value: "bowl", label: "볼" },
  { value: "cup", label: "컵" },
  { value: "glassware", label: "유리잔" },
  { value: "tray", label: "트레이" },
  { value: "cutlery", label: "커트러리" },
  { value: "tableware", label: "테이블웨어" }
];

const COLOR_OPTIONS: Array<{ value: ProductColorCue; label: string }> = [
  { value: "white", label: "화이트" },
  { value: "ivory", label: "아이보리" },
  { value: "cream", label: "크림" },
  { value: "beige", label: "베이지" },
  { value: "brown", label: "브라운" },
  { value: "gray", label: "그레이" },
  { value: "black", label: "블랙" },
  { value: "clear", label: "투명" },
  { value: "blue", label: "블루" },
  { value: "green", label: "그린" },
  { value: "pink", label: "핑크" },
  { value: "earthy", label: "어스톤" },
  { value: "low-saturation", label: "저채도" },
  { value: "neutral", label: "중성" }
];

const MATERIAL_OPTIONS: Array<{ value: ProductMaterialCue; label: string }> = [
  { value: "ceramic", label: "세라믹" },
  { value: "glass", label: "유리" },
  { value: "wood", label: "우드" },
  { value: "metal", label: "메탈" },
  { value: "stone", label: "스톤" },
  { value: "linen", label: "린넨" },
  { value: "mixed", label: "혼합 소재" }
];

const SURFACE_TONE_OPTIONS: Array<{ value: ProductSurfaceTone; label: string }> = [
  { value: "warm", label: "따뜻함" },
  { value: "cool", label: "차분함" },
  { value: "neutral", label: "중성" }
];

function nextMultiValue<T extends string>(current: T[], value: string, index: number): T[] {
  const next = [...current];

  if (!value) {
    next.splice(index, 1);
  } else {
    next[index] = value as T;
  }

  return Array.from(new Set(next.filter(Boolean)));
}

export function UploadPanel({
  file,
  activeSeedId,
  previewUrl,
  recommending,
  inputOverrides,
  onInputOverridesChange,
  onApplyInputOverrides,
  onUpload
}: UploadPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="step-badge">Step 1. 상품 이미지 업로드</div>
          <h2 className="panel-title">가장 먼저 상품 사진을 올려 주세요.</h2>
          <p className="panel-copy">
            업로드 직후 시스템이 상품 인상, 색감, 소재 단서를 읽고 가장 잘 맞는 스타일 3개를
            추천합니다.
          </p>
        </div>
      </div>

      <div className="upload-grid">
        <label className="upload-dropzone">
          <div>
            <strong>파일 선택</strong>
            <p className="help-text">JPG, PNG, WEBP 한 장이면 충분합니다.</p>
            <input type="file" accept="image/*" onChange={onUpload} />
          </div>
        </label>

        <div className="preview-frame">
          {previewUrl ? (
            <img src={previewUrl} alt="상품 미리보기" />
          ) : (
            <div className="upload-dropzone">
              <div>
                <strong>미리보기 영역</strong>
                <p className="help-text">업로드한 상품 사진 또는 테스트 시드가 표시됩니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="divider" />

      <div className="panel-header">
        <div>
          <h3 className="panel-title">선택 입력</h3>
          <p className="panel-copy">
            자동 분석이 애매하면 카테고리, 색감, 소재, 톤, 메모를 직접 보정할 수 있습니다. 비워두면
            `None` 기준으로 처리합니다.
          </p>
        </div>
      </div>

      <div className="metadata-form-grid">
        <label className="field-card">
          <strong>카테고리</strong>
          <select
            value={inputOverrides.category ?? ""}
            onChange={(event) =>
              onInputOverridesChange({
                category: (event.target.value || null) as ProductCategory | null
              })
            }
          >
            <option value="">None</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-card">
          <strong>색감 단서 1</strong>
          <select
            value={inputOverrides.colorHints[0] ?? ""}
            onChange={(event) =>
              onInputOverridesChange({
                colorHints: nextMultiValue(inputOverrides.colorHints, event.target.value, 0)
              })
            }
          >
            <option value="">None</option>
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-card">
          <strong>색감 단서 2</strong>
          <select
            value={inputOverrides.colorHints[1] ?? ""}
            onChange={(event) =>
              onInputOverridesChange({
                colorHints: nextMultiValue(inputOverrides.colorHints, event.target.value, 1)
              })
            }
          >
            <option value="">None</option>
            {COLOR_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-card">
          <strong>소재 단서 1</strong>
          <select
            value={inputOverrides.materialHints[0] ?? ""}
            onChange={(event) =>
              onInputOverridesChange({
                materialHints: nextMultiValue(inputOverrides.materialHints, event.target.value, 0)
              })
            }
          >
            <option value="">None</option>
            {MATERIAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-card">
          <strong>소재 단서 2</strong>
          <select
            value={inputOverrides.materialHints[1] ?? ""}
            onChange={(event) =>
              onInputOverridesChange({
                materialHints: nextMultiValue(inputOverrides.materialHints, event.target.value, 1)
              })
            }
          >
            <option value="">None</option>
            {MATERIAL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-card">
          <strong>전체 톤</strong>
          <select
            value={inputOverrides.surfaceTone ?? ""}
            onChange={(event) =>
              onInputOverridesChange({
                surfaceTone: (event.target.value || null) as ProductSurfaceTone | null
              })
            }
          >
            <option value="">None</option>
            {SURFACE_TONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-card field-card--wide">
          <strong>소재 메모</strong>
          <input
            placeholder="예: 무광 세라믹, 얇은 림"
            type="text"
            value={inputOverrides.materialNotes ?? ""}
            onChange={(event) =>
              onInputOverridesChange({
                materialNotes: event.target.value || null
              })
            }
          />
        </label>

        <label className="field-card field-card--wide">
          <strong>상품 인상 메모</strong>
          <input
            placeholder="예: 얇은 림이 또렷하고 차분한 인상"
            type="text"
            value={inputOverrides.visualSummary ?? ""}
            onChange={(event) =>
              onInputOverridesChange({
                visualSummary: event.target.value || null
              })
            }
          />
        </label>
      </div>

      {(file || activeSeedId) && previewUrl ? (
        <>
          <div className="divider" />
          <div className="token-row">
            <span className="meta-badge">
              {file ? `파일명: ${file.name}` : `시드: ${activeSeedId}`}
            </span>
            <span className="meta-badge">
              상태: {recommending ? "스타일 추천 중" : "추천 준비 완료"}
            </span>
          </div>
          {file ? (
            <div className="action-row">
              <button
                className="secondary-button"
                disabled={recommending}
                onClick={() => {
                  void onApplyInputOverrides();
                }}
                type="button"
              >
                {recommending ? "반영 중..." : "선택 사항 반영 후 다시 추천"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
