import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Providers } from "./providers";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import "./globals.css";

const inter = localFont({
  src: "../src/fonts/inter-var.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
});

const sora = localFont({
  src: "../src/fonts/sora-var.woff2",
  variable: "--font-sora",
  display: "swap",
  weight: "100 800",
});

const jetbrains = localFont({
  src: "../src/fonts/jb-var.woff2",
  variable: "--font-jetbrains",
  display: "swap",
  weight: "100 800",
});

export const metadata: Metadata = {
  title: "AutoData — AI data analyst for your spreadsheets",
  description:
    "AutoData turns raw CSV and Excel files into clean, explored, insight-rich datasets. Upload, profile, clean, visualize and ask questions in plain English — locally, privately, instantly.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} ${jetbrains.variable}`}>
        <ErrorBoundary>
          <Providers>{children}</Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
