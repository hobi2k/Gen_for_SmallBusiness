import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "리빙 소품 AI 콘텐츠 생성기",
  description: "상품 이미지와 감성 스타일만으로 온라인 판매용 콘텐츠 패키지를 생성합니다."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
