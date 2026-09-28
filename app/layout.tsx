import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "이로움 주문 운영",
  description: "주문 파일 검증, 실행 대기, 리포트 관리를 위한 온라인 업무도구",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
