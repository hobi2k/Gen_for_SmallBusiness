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

// 결과 패널에서 사람에게 보일 한글 라벨을 여기서 통일한다.
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
  // 파일 확장자만 보고 미리보기 타입을 추정한다.
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
  // 브라우저는 로컬 절대 경로를 직접 열 수 없어서 프록시 라우트로 바꿔 준다.
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

  // 백엔드 응답은 중첩 딕셔너리일 수 있어서, 화면에서는 일단 평평한 카드 목록으로 바꾼다.
  const previews: PreviewAsset[] = [];

  for (const [key, value] of Object.entries(assetPaths)) {
    if (key === 'copy' || key === 'project_root' || key === 'hero_asset_path') {
      // 문구 묶음과 루트 경로는 미리보기가 아니므로 제외한다.
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
