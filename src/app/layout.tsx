import type { Metadata, Viewport } from "next";
import Logo from "@/components/Logo";
import "./globals.css";

export const metadata: Metadata = {
  title: "강원크루",
  description: "축제 현장 스태프 QR 출퇴근",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1F3864",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
            <Logo />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
