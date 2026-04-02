import {readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';

import {NextRequest, NextResponse} from 'next/server';

// 생성 결과와 업로드 원본만 브라우저에서 미리보기로 열 수 있게 제한한다.
const allowedRoots = ['/home/hosung/Downloads/장사한컷', '/home/hosung/Downloads/uploads'];

function contentTypeFor(extension: string): string {
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.mp4':
      return 'video/mp4';
    case '.webm':
      return 'video/webm';
    case '.mov':
      return 'video/quicktime';
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    case '.aac':
      return 'audio/aac';
    default:
      return 'application/octet-stream';
  }
}

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get('path');

  if (!rawPath) {
    return NextResponse.json({detail: '경로가 없습니다.'}, {status: 400});
  }

  const targetPath = resolve(rawPath);
  // 임의의 로컬 파일을 열 수 없게, 허용 루트 안쪽 경로만 통과시킨다.
  const isAllowed = allowedRoots.some((root) => targetPath.startsWith(resolve(root)));

  if (!isAllowed) {
    return NextResponse.json({detail: '허용되지 않은 경로입니다.'}, {status: 403});
  }

  try {
    const body = await readFile(targetPath);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentTypeFor(extname(targetPath).toLowerCase()),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({detail: '파일을 읽을 수 없습니다.'}, {status: 404});
  }
}
