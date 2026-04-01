import {AssetPreviewGallery} from '@/components/asset-preview-gallery';
import {flattenPreviewAssets, AssetValue} from '@/lib/assets';

type AssetResultPanelProps = {
  title: string;
  description: string;
  status: string | null;
  result: {
    message?: string;
    project_root?: string;
    asset_paths?: Record<string, AssetValue>;
  } | null;
};

export function AssetResultPanel({title, description, status, result}: AssetResultPanelProps) {
  const assets = flattenPreviewAssets(result?.asset_paths);

  return (
    <section className="rounded-[32px] border border-black/10 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,32,0.08)]">
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#101828]">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-black/58">{description}</p>

      <div className="mt-6 rounded-[24px] bg-[#f7f5ef] p-4">
        <p className="text-sm font-medium text-black/72">{status ?? '아직 생성 전입니다.'}</p>
      </div>

      {result ? (
        <div className="mt-6 space-y-4">
          {result.message ? (
            <div className="rounded-[24px] border border-black/10 p-4">
              <p className="text-sm font-medium text-black/75">응답 문구</p>
              <p className="mt-2 text-sm leading-6 text-black/62">{result.message}</p>
            </div>
          ) : null}

          {result.project_root ? (
            <div className="rounded-[24px] border border-black/10 p-4">
              <p className="text-sm font-medium text-black/75">저장 위치</p>
              <p className="mt-2 break-all text-sm leading-6 text-black/62">{result.project_root}</p>
            </div>
          ) : null}

          <AssetPreviewGallery assets={assets} />
        </div>
      ) : null}
    </section>
  );
}
