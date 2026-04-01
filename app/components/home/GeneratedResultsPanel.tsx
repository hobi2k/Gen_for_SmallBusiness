import { GeneratedImage, GeneratedPackage } from "@/lib/types";

interface GeneratedResultsPanelProps {
  generatedPackage: GeneratedPackage;
  copiedKey: string | null;
  generating: boolean;
  sectionId: string;
  onCopy: (copyTarget: string, value: string) => Promise<void>;
  onRegenerate: () => Promise<void> | void;
  onChangeStyle: () => void;
}

interface CopyButtonProps {
  copied: boolean;
  onClick: () => Promise<void> | void;
}

interface TextOutputCardProps {
  title: string;
  text: string;
  copied: boolean;
  onCopy: () => Promise<void> | void;
}

interface ImageResultCardProps {
  title: string;
  images: GeneratedImage[];
}

function CopyButton({ copied, onClick }: CopyButtonProps) {
  return (
    <button
      className={`copy-button ${copied ? "is-copied" : ""}`}
      onClick={onClick}
      type="button"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

function TextOutputCard({ title, text, copied, onCopy }: TextOutputCardProps) {
  return (
    <div className="copy-card result-card">
      <div className="card-title-row">
        <strong>{title}</strong>
        <CopyButton copied={copied} onClick={onCopy} />
      </div>
      <p className="result-text">{text}</p>
    </div>
  );
}

function ImageResultCard({ title, images }: ImageResultCardProps) {
  return (
    <div className="copy-card result-card image-result-card">
      <div className="card-title-row">
        <strong>{title}</strong>
      </div>
      <div className="image-grid">
        {images.map((image) => (
          <div className="image-card" key={image.id}>
            <div className="image-frame">
              <img src={image.url} alt={`${title} ${image.aspectRatio}`} />
            </div>
            <p className="image-caption">비율 {image.aspectRatio}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GeneratedResultsPanel({
  generatedPackage,
  copiedKey,
  generating,
  sectionId,
  onCopy,
  onRegenerate,
  onChangeStyle
}: GeneratedResultsPanelProps) {
  return (
    <section className="panel" id={sectionId}>
      <div className="panel-header">
        <div>
          <div className="step-badge">Step 5-6. 결과 확인과 재생성</div>
          <h2 className="panel-title">생성 결과를 카드 단위로 바로 복사하고 재활용할 수 있습니다.</h2>
          <p className="panel-copy">
            각 텍스트 출력은 개별 복사 버튼을 제공하며, 같은 스타일로 재생성하거나 다른
            스타일로 전환할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="token-row">
        <span className="meta-badge">선택 스타일: {generatedPackage.selectedStyle.name}</span>
        <span className="meta-badge">LLM: {generatedPackage.generationMeta.llmModel}</span>
        <span className="meta-badge">
          fallback {generatedPackage.generationMeta.fallbackUsed ? "사용" : "미사용"}
        </span>
      </div>

      <div className="result-card-grid">
        <ImageResultCard
          images={generatedPackage.representativeImages}
          title="대표 감성 이미지"
        />
        <ImageResultCard
          images={generatedPackage.lifestyleImages}
          title="라이프스타일 이미지"
        />
        <TextOutputCard
          copied={copiedKey === "oneLineIntro"}
          onCopy={() => onCopy("oneLineIntro", generatedPackage.oneLineIntro)}
          text={generatedPackage.oneLineIntro}
          title="상품 한 줄 소개"
        />
        <TextOutputCard
          copied={copiedKey === "detailedDescription"}
          onCopy={() => onCopy("detailedDescription", generatedPackage.detailedDescription)}
          text={generatedPackage.detailedDescription}
          title="상세 설명"
        />
        <TextOutputCard
          copied={copiedKey === "shortStoreCopy"}
          onCopy={() => onCopy("shortStoreCopy", generatedPackage.shortStoreCopy)}
          text={generatedPackage.shortStoreCopy}
          title="스마트스토어용 짧은 소개문구"
        />
        <div className="copy-card result-card">
          <div className="card-title-row">
            <strong>키워드 / 해시태그</strong>
          </div>
          <div className="copy-row">
            <div>
              <strong className="sub-label">키워드</strong>
              <p className="result-text">{generatedPackage.keywords.join(" · ")}</p>
            </div>
            <CopyButton
              copied={copiedKey === "keywords"}
              onClick={() => onCopy("keywords", generatedPackage.keywords.join(", "))}
            />
          </div>
          <div className="copy-row">
            <div>
              <strong className="sub-label">해시태그</strong>
              <p className="result-text">{generatedPackage.hashtags.join(" ")}</p>
            </div>
            <CopyButton
              copied={copiedKey === "hashtags"}
              onClick={() => onCopy("hashtags", generatedPackage.hashtags.join(" "))}
            />
          </div>
        </div>
      </div>

      <div className="divider" />
      <div className="action-row">
        <button
          className="primary-button"
          disabled={generating}
          onClick={onRegenerate}
          type="button"
        >
          {generating ? "재생성 중..." : "같은 스타일로 다시 생성"}
        </button>
        <button className="secondary-button" onClick={onChangeStyle} type="button">
          스타일 바꾸기
        </button>
      </div>
    </section>
  );
}
