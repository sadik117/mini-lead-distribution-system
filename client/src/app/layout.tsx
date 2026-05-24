import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prowider Lead System",
  description: "Simplified lead generation and fair distribution system",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 selection:bg-teal-500/30 selection:text-teal-200">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 items-center justify-between">
              {/* Logo / Title */}
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                  <span className="font-mono font-bold text-zinc-950">P</span>
                </div>
                <span className="font-mono font-semibold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-300">
                  PROWIDER
                </span>
              </div>

              {/* Navigation Menu */}
              <nav className="flex items-center gap-1 sm:gap-4">
                <Link
                  href="/request-service"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100 hover:bg-zinc-900"
                >
                  Request Service
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100 hover:bg-zinc-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/test-tools"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100 hover:bg-zinc-900"
                >
                  Test Tools
                </Link>
              </nav>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 flex flex-col">{children}</main>

        {/* Footer */}
        <footer className="border-t border-zinc-900 bg-zinc-950/40 py-6">
          <div className="mx-auto max-w-7xl px-4 text-center text-xs text-zinc-600 sm:px-6 lg:px-8">
            &copy; {new Date().getFullYear()} Prowider Lead Distribution. All rights reserved.
          </div>
        </footer>
      </body>
    </html>
  );
}
