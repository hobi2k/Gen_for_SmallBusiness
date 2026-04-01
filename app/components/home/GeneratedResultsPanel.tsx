import { GeneratedImage, GeneratedPackage } from "@/lib/types";

interface GeneratedResultsPanelProps {
  generatedPackage: GeneratedPackage | null;
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

function PendingCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="copy-card result-card pending-card">
      <div className="card-title-row">
        <strong>{title}</strong>
        <span className="meta-badge">준비 중</span>
      </div>
      <div className="pending-skeleton" aria-hidden="true" />
      <p className="result-text">{description}</p>
    </div>
  );
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
  if (!generatedPackage) {
    return (
      <section className="panel" id={sectionId}>
        <div className="panel-header">
          <div>
            <div className="step-badge">Step 5-6. 결과 생성 중</div>
            <h2 className="panel-title">스마트스토어용 콘텐츠 패키지를 준비하고 있습니다.</h2>
            <p className="panel-copy">
              현재 선택한 스타일을 기준으로 대표 이미지, 라이프스타일 이미지, 상품 문구,
              태그 후보를 생성 중입니다.
            </p>
          </div>
        </div>

        <div className="token-row">
          <span className="meta-badge">{generating ? "콘텐츠 생성 중" : "결과 대기 중"}</span>
          <span className="meta-badge">스마트스토어 최적화 문구 생성</span>
          <span className="meta-badge">태그 후보 정리</span>
        </div>

        <div className="result-card-grid">
          <PendingCard
            title="대표 감성 이미지"
            description="대표 컷 1~2개를 준비합니다. worker가 연결되면 실제 생성 이미지를, 아니면 placeholder 이미지를 반환합니다."
          />
          <PendingCard
            title="라이프스타일 이미지"
            description="생활 장면형 컷 1~2개를 준비합니다. 상품 정체성은 유지한 상태로 구성됩니다."
          />
          <PendingCard
            title="상품 한 줄 소개"
            description="감성 톤은 유지하되 상품과 직접 연결되는 짧은 문장으로 정리합니다."
          />
          <PendingCard
            title="상세 설명"
            description="소재, 형태, 사용 장면이 드러나는 스마트스토어용 설명으로 생성합니다."
          />
          <PendingCard
            title="스마트스토어용 짧은 소개문구"
            description="링크 공유와 검색설정 문구로도 무리 없는 짧고 직접적인 문장으로 맞춥니다."
          />
          <PendingCard
            title="키워드 / 해시태그"
            description="상품과 직접 관련된 태그 후보와 SNS 해시태그를 함께 정리합니다."
          />
        </div>
      </section>
    );
  }

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
        <span className="meta-badge">이미지 엔진: {generatedPackage.generationMeta.imageEngine}</span>
        <span className="meta-badge">
          fallback {generatedPackage.generationMeta.fallbackUsed ? "사용" : "미사용"}
        </span>
        <span className="meta-badge">
          이미지 {generatedPackage.generationMeta.imageFallbackUsed ? "placeholder" : "worker"}
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
      <div className="token-row">
        <span className="meta-badge">Page title / Meta description 대응형 짧은 문구</span>
        <span className="meta-badge">상품 연관 태그 후보만 사용</span>
        <span className="meta-badge">스타일링 팁 제외</span>
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
