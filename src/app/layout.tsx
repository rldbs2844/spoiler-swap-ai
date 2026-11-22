import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "나이트 러너 안전 코스 안내 | 야간 대기 역전층 분석",
  description:
    "낮(14시)과 밤(22시) 초미세먼지(PM2.5) 비교를 통해 야간 대기 역전층 위험 구간을 판별하고 안전 러닝 코스를 안내합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f8fafc] text-[#0f172a]">
        {children}
      </body>
    </html>
  );
}
