import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// 使用仓库内本地字体，避免 build/dev 依赖外网字体服务。
const bodyFont = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-fira-sans",
  display: "swap",
});
const monoFont = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: "评测平台",
  description: "异构模型/算法/接口统一评测平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${monoFont.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
