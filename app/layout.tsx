import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { FrameProvider } from "@/components/farcaster-provider";
import { HeaderActions } from "@/components/HeaderActions"; // Import the new component

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Happy World Vote",
  description: "Vote on how happy you feel and contribute to making the world a better place through blockchain voting on Monad and Base networks",
  openGraph: {
    title: "Happy World Vote",
    description: "Vote on how happy you feel and contribute to making the world a better place through blockchain voting on Monad and Base networks",
    siteName: "Happy World Vote",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Happy World Vote",
    description: "Vote on how happy you feel and contribute to making the world a better place through blockchain voting on Monad and Base networks",
  },
};

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
    <head>
      {/* Установка темы в зависимости от prefers-color-scheme */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
      (function() {
        try {
          var theme = localStorage.getItem('theme');
          if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
            document.documentElement.classList.toggle('dark', theme === 'dark');
          } else {
            var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
            document.documentElement.classList.toggle('dark', prefersDark);
          }
        } catch(e) {}
      })();
    `,
        }}
      />
    </head>
    <body className={`${inter.className}`}>
    <FrameProvider> {/* FrameProvider wraps everything that needs its context */}
      <header className="flex justify-end px-4 pt-4 pb-0.5">
        <HeaderActions />
      </header>
      {children}
    </FrameProvider>
    </body>
    </html>
  );
}
