import './globals.css';
import type {Metadata} from 'next';

import {TopNavigation} from '@/components/top-navigation';

export const metadata: Metadata = {
  title: '장사한컷',
  description: '소상공인을 위한 광고 콘텐츠 제작 플랫폼',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ko">
      <body>
        {/* 모든 페이지에서 공통으로 보이는 상단 네비게이션이다. */}
        <TopNavigation />
        {/* 실제 페이지 내용은 각 route의 page.tsx에서 내려온다. */}
        {children}
      </body>
    </html>
  );
}
