import { ChangeEvent } from "react";

interface UploadPanelProps {
  file: File | null;
  activeSeedId: string | null;
  previewUrl: string | null;
  recommending: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export function UploadPanel({
  file,
  activeSeedId,
  previewUrl,
  recommending,
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
        </>
      ) : null}
    </section>
  );
}
