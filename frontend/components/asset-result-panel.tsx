import {AssetPreviewGallery} from '@/components/asset-preview-gallery';
import {flattenPreviewAssets, AssetValue} from '@/lib/assets';

type AssetResultPanelProps = {
  title: string;
  status: string | null;
  progress?: number;
  result: {
    message?: string;
    project_root?: string;
    asset_paths?: Record<string, AssetValue>;
  } | null;
};

export function AssetResultPanel({
  title,
  status,
  progress = 0,
  result,
}: AssetResultPanelProps) {
  // 백엔드 응답 안의 중첩 구조를 미리보기 컴포넌트가 읽기 쉬운 배열로 바꾼다.
  const assets = flattenPreviewAssets(result?.asset_paths);

  return (
    <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,32,0.08)]">
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#101828]">{title}</h2>

      <div className="mt-6 rounded-[24px] bg-[#f7f5ef] p-4">
        {/* 생성 중, 완료, 실패 같은 상태 문구를 가장 먼저 보여준다. */}
        <p className="text-sm font-medium text-black/72">{status ?? '아직 생성 전입니다.'}</p>
        {progress > 0 && progress < 100 ? (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-black/8">
              <div
                className="h-full rounded-full bg-[#111827] transition-[width] duration-500"
                style={{width: `${progress}%`}}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-black/48">{progress}% 진행</p>
          </div>
        ) : null}
      </div>

      {result ? (
        <div className="mt-6 space-y-4">
          {/* 실제 미리보기는 이미지/영상/음성만 추려서 아래 카드로 보여준다. */}
          <AssetPreviewGallery assets={assets} />
        </div>
      ) : null}
    </section>
  );
}
