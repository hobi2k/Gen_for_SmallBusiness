import {buildAssetUrl, PreviewAsset} from '@/lib/assets';

type AssetPreviewGalleryProps = {
  assets: PreviewAsset[];
  dark?: boolean;
};

export function AssetPreviewGallery({assets, dark = false}: AssetPreviewGalleryProps) {
  // 생성 결과가 없으면 미리보기 카드 자체를 렌더링하지 않는다.
  if (!assets.length) {
    return null;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {assets.map((asset) => {
        const titleClass = dark ? 'text-white/70' : 'text-black/52';
        const cardClass = dark
          ? 'border border-white/10 bg-white/[0.04]'
          : 'border border-black/10 bg-[#faf7f1]';
        const mediaClass = dark ? 'bg-black/30' : 'bg-white';
        const downloadClass = dark
          ? 'border border-white/12 bg-white/8 text-white/88 hover:bg-white/14'
          : 'border border-black/10 bg-white text-black/72 hover:bg-black/[0.03]';
        // 브라우저에서는 백엔드 파일 경로를 직접 열 수 없으므로 자산 프록시 URL로 바꿔서 쓴다.
        const assetUrl = buildAssetUrl(asset.path);
        const fileName = asset.path.split('/').pop() || asset.label;

        return (
          <div key={`${asset.label}-${asset.path}`} className={`rounded-[24px] p-4 ${cardClass}`}>
            <p className={`mb-3 text-xs font-medium uppercase tracking-[0.16em] ${titleClass}`}>
              {asset.label}
            </p>

            {asset.kind === 'image' ? (
              <img
                alt={asset.label}
                className={`h-56 w-full rounded-[20px] object-cover ${mediaClass}`}
                src={assetUrl}
              />
            ) : null}

            {asset.kind === 'video' ? (
              <video
                className={`h-56 w-full rounded-[20px] object-cover ${mediaClass}`}
                controls
                preload="metadata"
                src={assetUrl}
              />
            ) : null}

            {asset.kind === 'audio' ? (
              <div className={`rounded-[20px] p-5 ${mediaClass}`}>
                <audio className="w-full" controls preload="metadata" src={assetUrl} />
              </div>
            ) : null}

            <div className="mt-3 flex justify-end">
              <a
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${downloadClass}`}
                download={fileName}
                href={assetUrl}
              >
                다운로드
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}
