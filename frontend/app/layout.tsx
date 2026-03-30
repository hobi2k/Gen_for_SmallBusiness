import './globals.css';
import type {Metadata} from 'next';

export const metadata: Metadata = {
  title: '장사한컷',
  description: '소상공인을 위한 광고 콘텐츠 제작 플랫폼',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
