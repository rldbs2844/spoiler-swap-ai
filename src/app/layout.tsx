import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Spoiler-Swap AI — 실시간 숏폼 스포일러 감지 및 힐링 밈 교체 웹 앱',
  description:
    '유튜브 쇼츠 URL 검사 및 4단계 멀티모달 파이프라인으로 스포일러를 사전 감지하고 고양이 힐링 밈으로 교체하는 Next.js 웹 애플리케이션'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased selection:bg-indigo-500/30 selection:text-indigo-200">
        {children}
      </body>
    </html>
  );
}
