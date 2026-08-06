"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { DatasetProvider } from "@/store/DatasetContext";
import { ToastProvider } from "@/store/ToastContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ToastProvider>
        <DatasetProvider>{children}</DatasetProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
