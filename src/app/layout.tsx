import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SpoilerGuard | 실시간 유튜브 스포일러 차단 플레이어",
  description:
    "실제 유튜브 영상을 탐색하고 시청하는 동안 4단계 멀티모달 분석을 통해 기습 스포일러를 실시간으로 감지하고 가림막으로 차단합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#ffffff] text-[#0f172a]">
        {children}
      </body>
    </html>
  );
}
