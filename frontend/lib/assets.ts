export type AssetLeafValue = string | string[];

export type AssetTree = {
  [key: string]: AssetLeafValue | AssetTree;
};

export type AssetValue = AssetLeafValue | AssetTree;

export type PreviewAsset = {
  label: string;
  path: string;
  kind: 'image' | 'video' | 'audio' | 'other';
};

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const videoExtensions = new Set(['.mp4', '.webm', '.mov']);
const audioExtensions = new Set(['.wav', '.mp3', '.m4a', '.aac']);

const labelMap: Record<string, string> = {
  banners: '배너 이미지',
  details: '상세 이미지',
  logos: '로고 초안',
  video: '광고 영상',
  music: '배경 음악',
  final_video: '합성 영상',
  finalVideo: '합성 영상',
};

function detectKind(path: string): PreviewAsset['kind'] {
  const lowerPath = path.toLowerCase();

  for (const extension of imageExtensions) {
    if (lowerPath.endsWith(extension)) {
      return 'image';
    }
  }

  for (const extension of videoExtensions) {
    if (lowerPath.endsWith(extension)) {
      return 'video';
    }
  }

  for (const extension of audioExtensions) {
    if (lowerPath.endsWith(extension)) {
      return 'audio';
    }
  }

  return 'other';
}

export function buildAssetUrl(path: string): string {
  return `/api/assets?path=${encodeURIComponent(path)}`;
}

function formatLabel(key: string): string {
  return labelMap[key] ?? key.replaceAll('_', ' ');
}

export function flattenPreviewAssets(
  assetPaths: AssetTree | undefined,
  prefix = '',
): PreviewAsset[] {
  if (!assetPaths) {
    return [];
  }

  const previews: PreviewAsset[] = [];

  for (const [key, value] of Object.entries(assetPaths)) {
    if (key === 'copy' || key === 'project_root') {
      continue;
    }

    const currentLabel = formatLabel(key);
    const label = prefix ? `${prefix} / ${currentLabel}` : currentLabel;

    if (typeof value === 'string') {
      const kind = detectKind(value);
      if (kind !== 'other') {
        previews.push({label, path: value, kind});
      }
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        const kind = detectKind(item);
        if (kind !== 'other') {
          previews.push({
            label: `${label} ${index + 1}`,
            path: item,
            kind,
          });
        }
      });
      continue;
    }

    previews.push(...flattenPreviewAssets(value, label));
  }

  return previews;
}
